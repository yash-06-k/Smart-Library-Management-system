import axios from 'axios';
import { auth } from '../firebase';

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

const isNotFound = (error) => error?.response?.status === 404;

const withResponseData = (response, data) => ({ ...response, data });

const normalizeBorrowRecords = (records) =>
  records.map((record) => ({
    ...record,
    borrow_date: record.borrow_date || record.issue_date,
    due_date: record.due_date,
    return_date: record.return_date ?? null,
    student_name: record.student_name || record.student_id || 'Unknown Student',
    book_title: record.book_title || record.book_id || 'Unknown Book',
    category: record.category || 'General',
  }));

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

const buildStatusFromAnalytics = (analytics) => ({
  database_connected: true,
  message: 'Connected (derived from analytics endpoint)',
  total_users: analytics?.metrics?.active_students ?? analytics?.total_students ?? 0,
  total_books: analytics?.metrics?.total_books ?? analytics?.total_books ?? 0,
  total_borrow_records: analytics?.metrics?.total_borrow_records ?? analytics?.total_borrow_records ?? 0,
});

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

export const getBooks = (params = {}) =>
  requestWithFallback([
    () => api.get('/api/books/', { params }),
    () => api.get('/books', { params }),
  ]);

export const getBookById = (bookId) =>
  requestWithFallback([
    () => api.get(`/api/books/${bookId}`),
    () => api.get(`/books/${bookId}`),
  ]);

export const createBook = (payload) =>
  requestWithFallback([
    () => api.post('/api/books/', payload),
    () => api.post('/books', payload),
  ]);

export const updateBook = (bookId, payload) =>
  requestWithFallback([
    () => api.put(`/api/books/${bookId}`, payload),
    () => api.put(`/books/${bookId}`, payload),
  ]);

export const deleteBook = (bookId) =>
  requestWithFallback([
    () => api.delete(`/api/books/${bookId}`),
    () => api.delete(`/books/${bookId}`),
  ]);

export const bulkCreateBooks = (payload) =>
  requestWithFallback([
    () => api.post('/api/books/bulk', payload),
    () => api.post('/books/bulk', payload),
  ]);

export const borrowBook = (payload) =>
  requestWithFallback([
    () => api.post('/api/borrow', payload),
    () => api.post('/borrow', payload),
  ]);

export const reserveBook = (payload) =>
  requestWithFallback([
    () => api.post('/api/reserve', payload),
    () => api.post('/reserve', payload),
  ]);

export const getBorrowRecords = async (params = {}) => {
  const dualPrefix = await requestWithFallback([
    () => api.get('/api/borrow-records', { params }),
    () => api.get('/borrow-records', { params }),
  ]);
  return withResponseData(dualPrefix, normalizeBorrowRecords(dualPrefix.data || []));
};

export const returnBook = (borrowRecordId) =>
  requestWithFallback([
    () => api.put(`/api/borrow/return/${borrowRecordId}`),
    () => api.post('/return', { borrow_record_id: borrowRecordId }),
  ]);

export const returnBookByBookId = (bookId) =>
  requestWithFallback([
    () => api.post(`/api/return-by-book/${bookId}`),
    () => api.post(`/return-by-book/${bookId}`),
  ]);

export const markBorrowReturned = (borrowRecordId) =>
  requestWithFallback([
    () => api.put(`/api/borrow/return/${borrowRecordId}`),
    () => api.put(`/borrow-records/${borrowRecordId}/mark-returned`),
  ]);

export const extendBorrow = (borrowRecordId, dueDate) =>
  api.put(`/borrow-records/${borrowRecordId}/extend`, { due_date: dueDate });

export const deleteBorrowRecord = (borrowRecordId) =>
  api.delete(`/borrow-records/${borrowRecordId}`);

export const createManualBorrowRecord = (payload) =>
  api.post('/borrow-records/manual', payload);

export const getUsers = (params = {}) =>
  requestWithFallback([
    () => api.get('/api/users', { params }),
    () => api.get('/users', { params }),
  ]);

export const getAdminMetrics = async () => {
  const response = await requestWithFallback([
    () => api.get('/api/admin/metrics'),
    () => api.get('/admin/metrics'),
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
