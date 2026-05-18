import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Pencil, Plus, Trash2, UploadCloud } from 'lucide-react';
import LoadingState from '../../components/LoadingState';
import PageHeader from '../../components/PageHeader';
import ScannerModal from '../../components/ScannerModal';
import BookCover from '../../components/BookCover';
import QrCodePreview from '../../components/QrCodePreview';
import BulkImportPanel from '../../components/BulkImportPanel';
import { createBook, deleteBook, getBooks, updateBook } from '../../services/api';

const defaultFormState = {
  title: '',
  author: '',
  category: '',
  isbn: '',
  description: '',
  rack_location: '',
  total_copies: 1,
  available_copies: 1,
  cover_image: '',
};

const normalizeIsbn = (value) => String(value || '').replace(/[^0-9Xx]/g, '').toUpperCase();
const resolveBookId = (book) => book?._id || book?.id || '';

export default function ManageBooks() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState([]);
  const [formState, setFormState] = useState(defaultFormState);
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [scannedBook, setScannedBook] = useState(null);
  const [scanNotice, setScanNotice] = useState('');
  const [qrModalBook, setQrModalBook] = useState(null);
  const [showImportPanel, setShowImportPanel] = useState(false);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const response = await getBooks({ limit: 500 });
      setBooks(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Failed to load books');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  const resetForm = () => {
    setFormState(defaultFormState);
    setEditingId('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    const title = String(formState.title || '').trim();
    const author = String(formState.author || '').trim();
    const category = String(formState.category || '').trim();
    const isbn = normalizeIsbn(formState.isbn);
    const description = String(formState.description || '').trim();
    const rackLocation = String(formState.rack_location || '').trim();
    const totalCopies = Number(formState.total_copies);
    const availableCopies = Number(formState.available_copies);

    if (!title || !author || !category || !isbn) {
      setSubmitting(false);
      setError('Title, author, category, and ISBN are required.');
      return;
    }

    if (!Number.isFinite(totalCopies) || totalCopies < 1) {
      setSubmitting(false);
      setError('Total copies must be at least 1.');
      return;
    }

    if (!Number.isFinite(availableCopies) || availableCopies < 0) {
      setSubmitting(false);
      setError('Available copies cannot be negative.');
      return;
    }

    if (availableCopies > totalCopies) {
      setSubmitting(false);
      setError('Available copies cannot be greater than total copies.');
      return;
    }

    const payload = {
      title,
      author,
      category,
      isbn,
      description,
      rack_location: rackLocation || null,
      total_copies: totalCopies,
      available_copies: availableCopies,
      cover_image: String(formState.cover_image || '').trim() || null,
    };

    try {
      if (editingId) {
        await updateBook(editingId, payload);
        setSuccess('Book updated successfully.');
      } else {
        const response = await createBook(payload);
        setQrModalBook(response.data);
        setSuccess('Book added successfully and saved to Firebase.');
      }
      resetForm();
      await loadBooks();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Book save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (bookId) => {
    if (!bookId) {
      setError('Missing book ID. Please refresh and try again.');
      return;
    }
    const confirmed = window.confirm('Delete this book?');
    if (!confirmed) {
      return;
    }

    try {
      await deleteBook(bookId);
      await loadBooks();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Delete failed');
    }
  };

  const startEdit = (book) => {
    const id = resolveBookId(book);
    if (!id) {
      setError('Missing book ID. Please refresh and try again.');
      return;
    }
    setEditingId(id);
    setFormState({
      title: book.title,
      author: book.author,
      category: book.category,
      isbn: book.isbn,
      description: book.description || '',
      rack_location: book.rack_location || '',
      total_copies: book.total_copies,
      available_copies: book.available_copies,
      cover_image: book.cover_image || '',
    });
  };

  const handleIsbnScan = async (isbn) => {
    setError('');
    setScannedBook(null);
    setScanNotice('');
    try {
      const cleanedIsbn = normalizeIsbn(isbn);
      const response = await getBooks({ search: cleanedIsbn });
      const match = (response.data || []).find((book) => normalizeIsbn(book.isbn) === cleanedIsbn);
      if (match) {
        setScannedBook(match);
        setScanNotice('ISBN matched an existing book. You can view or edit it.');
      } else {
        setFormState((prev) => ({ ...prev, isbn: cleanedIsbn }));
        setScanNotice('ISBN not found. Fill the remaining fields to add this book quickly.');
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'ISBN lookup failed');
    }
  };

  const handleShowQr = async (book) => {
    if (!resolveBookId(book) && !book?.isbn) {
      setError('QR not available: missing book ID/ISBN.');
      return;
    }
    setQrModalBook(book);
  };

  const filteredBooks = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return books;
    }
    return books.filter((book) =>
      [book.title, book.author, book.category, book.isbn].some((value) =>
        (value || '').toLowerCase().includes(needle)
      )
    );
  }, [books, search]);

  if (loading) {
    return <LoadingState label="Loading books..." />;
  }

  return (
    <div>
      <PageHeader title="Manage Books" subtitle="Add, edit, and delete Firestore book records." />

      {error ? <p className="text-rose-300 text-sm mb-4">{error}</p> : null}
      {success ? (
        <p className="text-emerald-300 text-sm mb-4 flex items-center gap-2">
          <CheckCircle2 size={14} />
          {success}
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowImportPanel((prev) => !prev)}
          className="rounded-xl bg-emerald-500/20 border border-emerald-300/30 px-4 py-2 text-sm hover:bg-emerald-500/30 min-h-[44px] inline-flex items-center gap-2"
        >
          <UploadCloud size={16} />
          {showImportPanel ? 'Hide Upload Panel' : 'Add Books via File Upload'}
        </button>
      </div>

      {showImportPanel ? (
        <div className="mb-5">
          <BulkImportPanel
            onImportComplete={async () => {
              setSuccess('Bulk import completed and saved to Firebase.');
              await loadBooks();
            }}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-5">
        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-4 space-y-3 h-fit xl:sticky xl:top-6">
          <h3 className="text-white text-lg font-medium flex items-center gap-2">
            <Plus size={16} />
            {editingId ? 'Edit Book' : 'Add Book'}
          </h3>

          <input className="field" placeholder="Title" value={formState.title} onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))} required />
          <input className="field" placeholder="Author" value={formState.author} onChange={(event) => setFormState((prev) => ({ ...prev, author: event.target.value }))} required />
          <input className="field" placeholder="Category" value={formState.category} onChange={(event) => setFormState((prev) => ({ ...prev, category: event.target.value }))} required />
          <div className="flex gap-2">
            <input className="field flex-1" placeholder="ISBN" value={formState.isbn} onChange={(event) => setFormState((prev) => ({ ...prev, isbn: event.target.value }))} required />
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="px-3 rounded-xl border border-white/20 text-xs hover:bg-white/10 min-h-[44px] flex-shrink-0"
            >
              Scan ISBN
            </button>
          </div>
          <input className="field" placeholder="Rack Location (e.g., A-3-2)" value={formState.rack_location} onChange={(event) => setFormState((prev) => ({ ...prev, rack_location: event.target.value }))} />

          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              min={1}
              className="field"
              placeholder="Total"
              value={formState.total_copies}
              onChange={(event) =>
                setFormState((prev) => {
                  const nextTotal = event.target.value;
                  const parsedTotal = Number(nextTotal);
                  const parsedAvailable = Number(prev.available_copies);
                  return {
                    ...prev,
                    total_copies: nextTotal,
                    available_copies:
                      Number.isFinite(parsedTotal) && Number.isFinite(parsedAvailable) && parsedAvailable > parsedTotal
                        ? nextTotal
                        : prev.available_copies,
                  };
                })
              }
              required
            />
            <input
              type="number"
              min={0}
              className="field"
              placeholder="Available"
              value={formState.available_copies}
              onChange={(event) => setFormState((prev) => ({ ...prev, available_copies: event.target.value }))}
              required
            />
          </div>

          <input className="field" placeholder="Cover Image URL (optional)" value={formState.cover_image} onChange={(event) => setFormState((prev) => ({ ...prev, cover_image: event.target.value }))} />
          <textarea className="field min-h-[90px]" placeholder="Description" value={formState.description} onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))} />

          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="flex-1 rounded-xl bg-indigo-500/20 border border-indigo-300/30 py-2 text-sm hover:bg-indigo-500/30 disabled:opacity-50 min-h-[44px]">
              {submitting ? 'Saving...' : editingId ? 'Update Book' : 'Add Book'}
            </button>
            {editingId ? (
              <button type="button" className="px-4 rounded-xl border border-white/20 text-sm min-h-[44px]" onClick={resetForm}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>

        <div className="glass-card rounded-2xl p-4 overflow-auto space-y-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title, author, category, or ISBN"
              className="field flex-1"
            />
            <button
              onClick={() => setQrScannerOpen(true)}
              className="rounded-xl bg-indigo-500/20 border border-indigo-300/30 px-4 py-2 text-sm hover:bg-indigo-500/30 min-h-[44px] flex-shrink-0"
            >
              Scan QR
            </button>
            {scannedBook ? (
              <button
                onClick={() => navigate(`/books/${resolveBookId(scannedBook)}`)}
                className="rounded-xl bg-cyan-500/20 border border-cyan-300/30 px-4 py-2 text-sm hover:bg-cyan-500/30 min-h-[44px] flex-shrink-0"
              >
                View
              </button>
            ) : null}
          </div>

          {scannedBook ? (
            <div className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              Found ISBN match: <span className="font-semibold">{scannedBook.title}</span> by {scannedBook.author}
            </div>
          ) : null}
          {scanNotice && !scannedBook ? (
            <div className="rounded-xl border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-100">
              {scanNotice}
            </div>
          ) : null}

          <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
            <table className="responsive-table">
              <thead className="text-slate-400">
                <tr>
                  <th data-label="Cover">Cover</th>
                  <th data-label="Title">Title</th>
                  <th data-label="Author">Author</th>
                  <th data-label="Category">Category</th>
                  <th data-label="Rack">Rack</th>
                  <th data-label="Status">Status</th>
                  <th data-label="Available">Available</th>
                  <th data-label="Actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBooks.map((book) => (
                  <tr key={resolveBookId(book)}>
                    <td data-label="Cover">
                      <BookCover
                        src={book.cover_image}
                        title={book.title}
                        author={book.author}
                        className="w-10 h-14 rounded-lg"
                      />
                    </td>
                    <td data-label="Title" className="font-medium text-white">{book.title}</td>
                    <td data-label="Author">{book.author}</td>
                    <td data-label="Category">{book.category}</td>
                    <td data-label="Rack">{book.rack_location || '-'}</td>
                    <td data-label="Status">{book.availability_status || 'Available'}</td>
                    <td data-label="Available">{book.available_copies}/{book.total_copies}</td>
                    <td data-label="Actions">
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => startEdit(book)} className="p-2 rounded-lg bg-slate-900/70 border border-white/10 hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center" title="Edit">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => handleShowQr(book)} className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-300/20 hover:bg-cyan-500/30 min-h-[44px] min-w-[44px] flex items-center justify-center text-xs font-medium" title="Show QR">
                          QR
                        </button>
                        <button onClick={() => handleDelete(resolveBookId(book))} className="p-2 rounded-lg bg-rose-500/20 border border-rose-300/20 hover:bg-rose-500/30 min-h-[44px] min-w-[44px] flex items-center justify-center" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ScannerModal
        open={scannerOpen}
        title="Scan ISBN Barcode"
        formats="isbn"
        onResult={handleIsbnScan}
        onClose={() => setScannerOpen(false)}
      />

      <ScannerModal
        open={qrScannerOpen}
        title="Scan Book QR"
        formats="qr"
        onResult={(value) => navigate(`/books/${value}`)}
        onClose={() => setQrScannerOpen(false)}
      />

      {qrModalBook ? (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Book QR Code</h3>
              <button
                onClick={() => setQrModalBook(null)}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-300"
              >
                Close
              </button>
            </div>
            <p className="text-sm text-slate-400">{qrModalBook.title}</p>
            {(() => {
              const qrValue = resolveBookId(qrModalBook) || qrModalBook?.isbn || '';
              return (
                <>
                  <QrCodePreview
                    value={qrValue}
                    size={220}
                    alt="Book QR"
                    className="w-56 h-56 mx-auto rounded-xl border border-white/10 bg-white p-3"
                    emptyLabel={
                      <div className="w-56 h-56 mx-auto rounded-xl border border-white/10 bg-slate-900/70 flex items-center justify-center text-xs text-slate-400 text-center px-6">
                        QR not available. Missing book ID/ISBN.
                      </div>
                    }
                  />
                  <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-xs text-slate-300 break-all">
                    <span className="text-slate-400">QR value:</span> {qrValue || 'Unavailable'}
                  </div>
                </>
              );
            })()}
            <div className="flex justify-center">
              <button
                onClick={() => {
                  const targetId = resolveBookId(qrModalBook);
                  if (!targetId) {
                    setError('Open details failed: missing book ID.');
                    return;
                  }
                  navigate(`/books/${targetId}`);
                }}
                className="rounded-xl bg-cyan-500/20 border border-cyan-300/30 px-4 py-2 text-sm hover:bg-cyan-500/30"
              >
                Open Book Details
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
