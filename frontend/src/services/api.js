import axios from 'axios';
import { auth } from '../firebase';
import { cachedRequest, APICache, invalidateCachePattern } from './cache';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
});

api.interceptors.request.use(async (config) => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
      config.headers['X-Firebase-UID'] = currentUser.uid;
    } catch {
      config.headers['X-Firebase-UID'] = currentUser.uid;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error?.response?.data?.detail;
    if (Array.isArray(detail)) {
      error.response.data.detail = detail.map((item) => item?.msg || 'Validation error').join(', ');
    } else if (detail && typeof detail === 'object') {
      error.response.data.detail = JSON.stringify(detail);
    }
    return Promise.reject(error);
  }
);

const isNotFound = (error) => {
  const status = error?.response?.status;
  return status === 404 || status === 405;
};

const withResponseData = (response, data) => ({ ...response, data });

const BORROW_STATUS_MAP = {
  borrowed: 'Borrowed',
  issued: 'Borrowed',
  overdue: 'Overdue',
  returned: 'Returned',
  reserved: 'Reserved',
};

const ACTIVE_BORROW_STATUSES = new Set(['Borrowed', 'Overdue']);

const toTimestamp = (value) => {
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const canonicalBorrowStatus = (status) => {
  if (!status || typeof status !== 'string') {
    return '';
  }
  const trimmed = status.trim();
  if (!trimmed) {
    return '';
  }
  const mapped = BORROW_STATUS_MAP[trimmed.toLowerCase()];
  return mapped || trimmed;
};

const resolveBorrowStatus = (rawStatus, dueDate, returnDate) => {
  const canonical = canonicalBorrowStatus(rawStatus);
  if (canonical === 'Returned' || returnDate) {
    return 'Returned';
  }
  if (canonical === 'Reserved') {
    return 'Reserved';
  }

  const dueTimestamp = toTimestamp(dueDate);
  if (dueTimestamp > 0 && dueTimestamp < Date.now()) {
    return 'Overdue';
  }
  return canonical || 'Borrowed';
};

const normalizeBorrowRecord = (record) => {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const normalized = {
    ...record,
    _id: record._id || record.id,
    borrow_date: record.borrow_date || record.issue_date || null,
    due_date: record.due_date || null,
    return_date: record.return_date ?? null,
    student_name: record.student_name || record.student_id || 'Unknown Student',
    book_title: record.book_title || record.book_id || 'Unknown Book',
    category: record.category || 'General',
  };
  normalized.status = resolveBorrowStatus(normalized.status, normalized.due_date, normalized.return_date);
  normalized.is_active = ACTIVE_BORROW_STATUSES.has(normalized.status);
  return normalized;
};

const normalizeBorrowRecords = (records) => {
  if (!Array.isArray(records)) {
    return [];
  }

  const byId = new Map();
  for (const raw of records) {
    const record = normalizeBorrowRecord(raw);
    if (!record) {
      continue;
    }

    const key = record._id || `${record.student_id || 'student'}:${record.book_id || 'book'}:${record.borrow_date || ''}`;
    const existing = byId.get(key);
    if (!existing) {
      byId.set(key, record);
      continue;
    }

    const existingUpdatedAt = toTimestamp(existing.updated_at);
    const candidateUpdatedAt = toTimestamp(record.updated_at);
    if (candidateUpdatedAt >= existingUpdatedAt) {
      byId.set(key, record);
    }
  }

  return [...byId.values()].sort((a, b) => toTimestamp(b.borrow_date) - toTimestamp(a.borrow_date));
};

const filterBorrowRecordsByStatus = (records, statusFilter) => {
  if (!statusFilter || typeof statusFilter !== 'string') {
    return records;
  }

  const normalized = statusFilter.trim().toLowerCase();
  if (!normalized || normalized === 'all') {
    return records;
  }

  if (normalized === 'active') {
    return records.filter((record) => record.is_active);
  }

  const target = canonicalBorrowStatus(normalized);
  if (!target) {
    return records;
  }

  return records.filter((record) => record.status === target);
};

const invalidateBorrowingCaches = () => {
  invalidateCachePattern('GET:/borrow-records');
  invalidateCachePattern('GET:/books');
  invalidateCachePattern('GET:/admin/metrics');
  invalidateCachePattern('GET:/admin/analytics');
};

const invalidateCatalogCaches = () => {
  invalidateCachePattern('GET:/books');
  invalidateCachePattern('GET:/admin/metrics');
  invalidateCachePattern('GET:/admin/analytics');
};

const withNormalizedBorrowRecord = (response) => {
  const normalized = normalizeBorrowRecord(response?.data);
  return withResponseData(response, normalized || response.data);
};

const isAlreadyReturnedError = (error) => {
  const status = error?.response?.status;
  const detail = (error?.response?.data?.detail || error?.message || '').toString().toLowerCase();
  return status === 400 && detail.includes('already returned');
};

const isNoActiveBorrowError = (error) => {
  const status = error?.response?.status;
  const detail = (error?.response?.data?.detail || error?.message || '').toString().toLowerCase();
  return status === 404 && detail.includes('no active borrow record');
};

const buildSyntheticReturnResponse = (borrowRecordId) =>
  withResponseData(
    { data: {} },
    normalizeBorrowRecord({
      _id: borrowRecordId,
      status: 'Returned',
      return_date: new Date().toISOString(),
    })
  );

const normalizeBook = (book) => {
  if (!book || typeof book !== 'object') {
    return book;
  }
  return {
    ...book,
    _id: book._id || book.id,
    available_copies: book.available_copies ?? book.availableCopies ?? 0,
    total_copies: book.total_copies ?? book.totalCopies ?? book.available_copies ?? 0,
  };
};

const normalizeBooks = (books) => (Array.isArray(books) ? books.map(normalizeBook) : books);

const normalizeUser = (user) => {
  if (!user || typeof user !== 'object') {
    return user;
  }
  return {
    ...user,
    _id: user._id || user.id || user.firebase_uid,
  };
};

const normalizeUsers = (users) => (Array.isArray(users) ? users.map(normalizeUser) : users);

const normalizeAdminMetrics = (data) => {
  if (!data || typeof data !== 'object') {
    return data;
  }
  if (!data.metrics) {
    return data;
  }

  return {
    total_books: data.metrics.total_books ?? 0,
    available_books: data.metrics.available_books ?? 0,
    issued_books: data.metrics.issued_books ?? 0,
    total_students: data.metrics.total_students ?? data.metrics.active_students ?? 0,
    borrowed_books: data.metrics.borrowed_books ?? 0,
    overdue_books: data.metrics.overdue_books ?? 0,
    total_borrow_records: data.metrics.total_borrow_records ?? 0,
  };
};

async function requestWithFallback(requests) {
  let lastNotFoundError;

  for (const request of requests) {
    try {
      return await request();
    } catch (error) {
      if (isNotFound(error)) {
        lastNotFoundError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastNotFoundError;
}

export const signupUser = (payload) =>
  requestWithFallback([
    () => api.post('/api/signup', payload),
    () => api.post('/signup', payload),
  ]);

export const loginUser = (payload) =>
  requestWithFallback([
    () => api.post('/api/login', payload),
    () => api.post('/login', payload),
  ]);

export const getBooks = (params = {}) => {
  const cacheKey = APICache.generateKey('GET', '/books', params);
  return cachedRequest(
    () => requestWithFallback([
      () => api.get('/api/books', { params }),
      () => api.get('/books', { params }),
      () => api.get('/api/books/', { params }),
    ]).then((response) => withResponseData(response, normalizeBooks(response.data))),
    cacheKey,
    10 * 60 * 1000 // 10 minute cache for books
  );
};

export const getBookById = (bookId) => {
  const cacheKey = APICache.generateKey('GET', `/books/${bookId}`);
  return cachedRequest(
    () => requestWithFallback([
      () => api.get(`/api/books/${bookId}`),
      () => api.get(`/books/${bookId}`),
    ]).then((response) => withResponseData(response, normalizeBook(response.data))),
    cacheKey,
    10 * 60 * 1000 // 10 minute cache for individual books
  );
};

export const createBook = (payload) =>
  requestWithFallback([
    () => api.post('/api/books', payload),
    () => api.post('/books', payload),
    () => api.post('/api/books/', payload),
  ]).then((response) => {
    invalidateCatalogCaches();
    return withResponseData(response, normalizeBook(response.data));
  });

export const updateBook = (bookId, payload) =>
  requestWithFallback([
    () => api.put(`/api/books/${bookId}`, payload),
    () => api.put(`/books/${bookId}`, payload),
  ]).then((response) => {
    invalidateCatalogCaches();
    return withResponseData(response, normalizeBook(response.data));
  });

export const deleteBook = (bookId) =>
  requestWithFallback([
    () => api.delete(`/api/books/${bookId}`),
    () => api.delete(`/books/${bookId}`),
  ]).then((response) => {
    invalidateCatalogCaches();
    return response;
  });

export const bulkCreateBooks = (payload) =>
  requestWithFallback([
    () => api.post('/api/books/bulk', payload),
    () => api.post('/books/bulk', payload),
  ]).then((response) => {
    invalidateCatalogCaches();
    return withResponseData(
      response,
      normalizeBooks(response.data?.created || []).length
        ? {
            ...response.data,
            created: normalizeBooks(response.data.created || []),
          }
        : response.data
    );
  });

export const borrowBook = async (payload) => {
  // Ensure due_date is in proper format (ISO string for API)
  const processedPayload = {
    ...payload,
    due_date: payload.due_date instanceof Date 
      ? payload.due_date.toISOString() 
      : payload.due_date,
  };
  
  const response = await requestWithFallback([
    () => api.post('/api/borrow', processedPayload),
    () => api.post('/borrow', processedPayload),
  ]);
  
  invalidateBorrowingCaches();
  return withNormalizedBorrowRecord(response);
};

export const reserveBook = async (payload) => 
  requestWithFallback([
    () => api.post('/api/reserve', payload),
    () => api.post('/reserve', payload),
  ]).then((response) => {
    invalidateBorrowingCaches();
    return withNormalizedBorrowRecord(response);
  });

export const getBorrowRecords = async (params = {}) => {
  const { status, ...restParams } = params || {};
  const statusToken = typeof status === 'string' ? status.trim() : '';
  const serverParams = { ...restParams };
  const cacheKey = APICache.generateKey('GET', '/borrow-records', serverParams);
  
  const dualPrefix = await cachedRequest(
    () => requestWithFallback([
      () => api.get('/api/borrow-records', { params: serverParams }),
      () => api.get('/borrow-records', { params: serverParams }),
      () => api.get('/api/admin/borrow-history', { params: serverParams }),
      () => api.get('/api/borrow/history', { params: serverParams }),
      () => api.get('/admin/borrow-history', { params: serverParams }),
      () => api.get('/borrow/history', { params: serverParams }),
    ]),
    cacheKey,
    2 * 60 * 1000 // 2 minute cache for borrow records (shorter due to status changes)
  );
  
  let records = normalizeBorrowRecords(dualPrefix.data || []);
  records = filterBorrowRecordsByStatus(records, statusToken);
  return withResponseData(dualPrefix, records);
};

export const returnBook = async (borrowRecordId) => {
  const requests = [
    () => api.post('/api/return', { borrow_record_id: borrowRecordId }),
    () => api.post('/return', { borrow_record_id: borrowRecordId }),
    () => api.put(`/api/borrow/return/${borrowRecordId}`),
    () => api.put(`/borrow/return/${borrowRecordId}`),
  ];

  try {
    const response = await requestWithFallback(requests);
    invalidateBorrowingCaches();
    return withNormalizedBorrowRecord(response);
  } catch (error) {
    if (isAlreadyReturnedError(error)) {
      invalidateBorrowingCaches();
      return buildSyntheticReturnResponse(borrowRecordId);
    }

    if (error?.response?.status === 500) {
      try {
        const retry = await requestWithFallback(requests);
        invalidateBorrowingCaches();
        return withNormalizedBorrowRecord(retry);
      } catch (retryError) {
        if (isAlreadyReturnedError(retryError)) {
          invalidateBorrowingCaches();
          return buildSyntheticReturnResponse(borrowRecordId);
        }
        throw retryError;
      }
    }

    throw error;
  }
};

export const returnBookByBookId = (bookId) =>
  requestWithFallback([
    () => api.post(`/api/return-by-book/${bookId}`),
    () => api.post(`/return-by-book/${bookId}`),
  ])
    .then((response) => {
      invalidateBorrowingCaches();
      return withNormalizedBorrowRecord(response);
    })
    .catch(async (error) => {
      if (error?.response?.status === 500) {
        try {
          const retry = await requestWithFallback([
            () => api.post(`/api/return-by-book/${bookId}`),
            () => api.post(`/return-by-book/${bookId}`),
          ]);
          invalidateBorrowingCaches();
          return withNormalizedBorrowRecord(retry);
        } catch (retryError) {
          if (isNoActiveBorrowError(retryError)) {
            invalidateBorrowingCaches();
            return withResponseData({ data: {} }, { status: 'Returned' });
          }
          throw retryError;
        }
      }
      throw error;
    });

export const markBorrowReturned = (borrowRecordId) =>
  requestWithFallback([
    () => api.put(`/api/borrow-records/${borrowRecordId}/mark-returned`),
    () => api.put(`/borrow-records/${borrowRecordId}/mark-returned`),
    () => api.put(`/api/admin/borrow-history/${borrowRecordId}/mark-returned`),
    () => api.put(`/admin/borrow-history/${borrowRecordId}/mark-returned`),
  ])
    .then((response) => {
      invalidateBorrowingCaches();
      return withNormalizedBorrowRecord(response);
    })
    .catch(async (error) => {
      if (isAlreadyReturnedError(error)) {
        invalidateBorrowingCaches();
        return buildSyntheticReturnResponse(borrowRecordId);
      }

      if (error?.response?.status === 500) {
        try {
          const retry = await requestWithFallback([
            () => api.put(`/api/borrow-records/${borrowRecordId}/mark-returned`),
            () => api.put(`/borrow-records/${borrowRecordId}/mark-returned`),
            () => api.put(`/api/admin/borrow-history/${borrowRecordId}/mark-returned`),
            () => api.put(`/admin/borrow-history/${borrowRecordId}/mark-returned`),
          ]);
          invalidateBorrowingCaches();
          return withNormalizedBorrowRecord(retry);
        } catch (retryError) {
          if (isAlreadyReturnedError(retryError)) {
            invalidateBorrowingCaches();
            return buildSyntheticReturnResponse(borrowRecordId);
          }
          throw retryError;
        }
      }

      throw error;
    });

export const extendBorrow = (borrowRecordId, dueDate) =>
  requestWithFallback([
    () => api.put(`/api/borrow-records/${borrowRecordId}/extend`, { due_date: dueDate }),
    () => api.put(`/borrow-records/${borrowRecordId}/extend`, { due_date: dueDate }),
    () => api.put(`/api/admin/borrow-history/${borrowRecordId}/extend`, { due_date: dueDate }),
    () => api.put(`/admin/borrow-history/${borrowRecordId}/extend`, { due_date: dueDate }),
  ]).then((response) => {
    invalidateBorrowingCaches();
    return withNormalizedBorrowRecord(response);
  });

export const deleteBorrowRecord = (borrowRecordId) =>
  requestWithFallback([
    () => api.delete(`/api/borrow-records/${borrowRecordId}`),
    () => api.delete(`/borrow-records/${borrowRecordId}`),
    () => api.delete(`/api/admin/borrow-history/${borrowRecordId}`),
    () => api.delete(`/admin/borrow-history/${borrowRecordId}`),
  ]).then((response) => {
    invalidateBorrowingCaches();
    return response;
  });

export const createManualBorrowRecord = (payload) =>
  requestWithFallback([
    () => api.post('/api/borrow-records/manual', payload),
    () => api.post('/borrow-records/manual', payload),
    () => api.post('/api/admin/borrow-history/manual', payload),
    () => api.post('/admin/borrow-history/manual', payload),
  ]).then((response) => {
    invalidateBorrowingCaches();
    return withNormalizedBorrowRecord(response);
  });

export const getUsers = (params = {}) =>
  requestWithFallback([
    () => api.get('/api/users', { params }),
    () => api.get('/users', { params }),
    () => api.get('/api/admin/students', { params }),
    () => api.get('/admin/students', { params }),
  ]).then((response) => {
    const payload = response.data?.users || response.data?.students || response.data;
    return withResponseData(response, normalizeUsers(payload));
  });

export const getAdminMetrics = async () => {
  const response = await requestWithFallback([
    () => api.get('/api/admin/metrics'),
    () => api.get('/admin/metrics'),
    () => api.get('/api/admin/analytics'),
    () => api.get('/admin/analytics'),
  ]);

  return withResponseData(response, normalizeAdminMetrics(response.data));
};

export const getRecommendations = () =>
  requestWithFallback([
    () => api.get('/api/recommendations'),
    () => api.get('/recommendations'),
  ]);

export const getNotifications = () =>
  requestWithFallback([
    () => api.get('/api/notifications'),
    () => api.get('/notifications'),
  ]);

export const getDatabaseStatus = async () => {
  return await requestWithFallback([
    () => api.get('/database-status'),
    () => api.get('/api/database-status'),
  ]);
};

export const checkDatabaseConnection = async () => {
  return await requestWithFallback([
    () => api.post('/database-status/check'),
    () => api.post('/api/database-status/check'),
  ]);
};

export const askChatbot = (payload) =>
  requestWithFallback([
    () => api.post('/api/chatbot', payload),
    () => api.post('/chatbot', payload),
  ]);

export default api;
