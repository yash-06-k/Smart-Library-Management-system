import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

import LoadingState from '../../components/LoadingState';
import PageHeader from '../../components/PageHeader';
import ScannerModal from '../../components/ScannerModal';
import BookCover from '../../components/BookCover';
import { borrowBook, getBooks, getRecommendations, reserveBook } from '../../services/api';

export default function BrowseBooks() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [books, setBooks] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [busyBookId, setBusyBookId] = useState('');
  const [error, setError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanAction, setScanAction] = useState('view');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationSource, setRecommendationSource] = useState('smart');

  const loadBooks = async (searchQuery = '', categoryFilter = '') => {
    setLoading(true);
    setError('');
    try {
      const response = await getBooks({ search: searchQuery, category: categoryFilter });
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

  useEffect(() => {
    let mounted = true;
    const loadRecommendations = async () => {
      try {
        const response = await getRecommendations();
        if (!mounted) {
          return;
        }
        setRecommendations(response.data?.recommendations || []);
        setRecommendationSource(response.data?.source || 'smart');
      } catch {
        if (mounted) {
          setRecommendations([]);
        }
      }
    };
    loadRecommendations();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      loadBooks(search, category);
    }, 350);

    return () => clearTimeout(handle);
  }, [search, category]);

  const categories = useMemo(() => {
    return [...new Set(books.map((book) => book.category))].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [books]);

  const handleSearch = (event) => {
    event.preventDefault();
    loadBooks(search, category);
  };

  const handleBorrow = async (bookId) => {
    setBusyBookId(bookId);
    setError('');

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    try {
      await borrowBook({
        book_id: bookId,
        due_date: dueDate.toISOString(),
      });

      await loadBooks(search, category);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Borrow request failed');
    } finally {
      setBusyBookId('');
    }
  };

  const handleReserve = async (bookId) => {
    setBusyBookId(bookId);
    setError('');

    try {
      await reserveBook({ book_id: bookId });
      await loadBooks(search, category);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Reservation failed');
    } finally {
      setBusyBookId('');
    }
  };

  const openScanner = (action) => {
    setScanAction(action);
    setScannerOpen(true);
  };

  const handleScanResult = async (value) => {
    if (scanAction === 'view') {
      navigate(`/books/${value}`);
      return;
    }

    if (scanAction === 'borrow') {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      try {
        await borrowBook({
          book_id: value,
          due_date: dueDate.toISOString(),
        });
        await loadBooks(search, category);
      } catch (requestError) {
        setError(requestError.response?.data?.detail || 'Borrow request failed');
      }
    }
  };

  const visibleBooks = availableOnly ? books.filter((book) => (book.available_copies || 0) > 0) : books;

  return (
    <div>
      <PageHeader title="Browse Books" subtitle="Search by title, author, category, or ISBN and borrow instantly." />

      <form onSubmit={handleSearch} className="glass-card rounded-2xl p-4 mb-5 grid grid-cols-1 md:grid-cols-[1fr_220px_auto_auto_auto] gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title, author, category, or ISBN"
            className="w-full rounded-xl border border-white/10 bg-slate-900/70 pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-cyan-300/40"
          />
        </div>

        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm focus:outline-none focus:border-cyan-300/40"
        >
          <option value="">All Categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <button className="rounded-xl bg-cyan-500/20 border border-cyan-300/30 hover:bg-cyan-500/30 px-4 py-2 text-sm">
          Apply
        </button>

        <button
          type="button"
          onClick={() => openScanner('view')}
          className="rounded-xl bg-indigo-500/20 border border-indigo-300/30 hover:bg-indigo-500/30 px-4 py-2 text-sm"
        >
          Scan QR
        </button>

        <button
          type="button"
          onClick={() => openScanner('borrow')}
          className="rounded-xl bg-emerald-500/20 border border-emerald-300/30 hover:bg-emerald-500/30 px-4 py-2 text-sm"
        >
          Scan & Borrow
        </button>

        <button
          type="button"
          onClick={() => setAvailableOnly((prev) => !prev)}
          className={`rounded-xl px-4 py-2 text-sm border ${
            availableOnly
              ? 'bg-emerald-500/20 border-emerald-300/30 text-emerald-100'
              : 'bg-slate-900/70 border-white/10 text-slate-300'
          }`}
        >
          {availableOnly ? 'Showing Available' : 'All Books'}
        </button>
      </form>

      {error ? <p className="text-rose-300 text-sm mb-4">{error}</p> : null}

      {recommendations.length > 0 ? (
        <section className="glass-card rounded-2xl p-5 mb-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <h3 className="text-lg font-semibold text-white">Smart Suggestions</h3>
            <span className="text-xs rounded-full px-3 py-1 border border-cyan-300/20 bg-cyan-500/10 text-cyan-100">
              {recommendationSource === 'ai' ? 'AI-assisted' : 'Smart picks'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {recommendations.map((item) => (
              <button
                key={item.book._id}
                onClick={() => navigate(`/books/${item.book._id}`)}
                className="text-left rounded-2xl border border-white/10 bg-slate-900/60 hover:bg-slate-900/80 p-4 flex gap-3"
              >
                <BookCover
                  src={item.book.cover_image}
                  title={item.book.title}
                  author={item.book.author}
                  className="w-16 h-20 flex-shrink-0"
                />
                <div className="space-y-1">
                  <p className="text-white font-medium">{item.book.title}</p>
                  <p className="text-xs text-slate-400">{item.book.author}</p>
                  <p className="text-xs text-cyan-200">{item.reason}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {loading ? (
        <LoadingState label="Loading books..." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleBooks.length === 0 ? (
            <div className="glass-card rounded-2xl p-6 text-sm text-slate-400">
              No books match this filter.
            </div>
          ) : visibleBooks.map((book) => {
            const unavailable = book.available_copies <= 0;
            const pending = busyBookId === book._id;
            const status = book.availability_status || (unavailable ? 'Issued' : 'Available');
            const statusTone = status === 'Available'
              ? 'bg-emerald-500/20 border-emerald-300/30 text-emerald-200'
              : status === 'Reserved'
                ? 'bg-amber-500/20 border-amber-300/30 text-amber-200'
                : 'bg-rose-500/20 border-rose-300/30 text-rose-200';

            return (
              <article key={book._id} className="glass-card rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex gap-3">
                  <BookCover
                    src={book.cover_image}
                    title={book.title}
                    author={book.author}
                    className="w-16 h-20 flex-shrink-0"
                  />
                  <div>
                  <p className="text-xs text-cyan-300 uppercase tracking-wide">{book.category}</p>
                  <h3 className="text-lg font-semibold text-white">{book.title}</h3>
                  <p className="text-sm text-slate-400">{book.author}</p>
                  </div>
                </div>

                <p className="text-sm text-slate-300 flex-1">{book.description || 'No description available.'}</p>

                <div className="text-xs text-slate-400 space-y-1">
                  <p>ISBN: {book.isbn}</p>
                  <p>Rack: {book.rack_location || 'Not set'}</p>
                  <p>Copies: {book.available_copies} available / {book.total_copies} total</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border ${statusTone}`}>
                    {status}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleBorrow(book._id)}
                    disabled={unavailable || pending}
                    className="flex-1 rounded-xl bg-indigo-500/20 border border-indigo-300/30 hover:bg-indigo-500/30 py-2 text-sm disabled:opacity-50"
                  >
                    {pending ? 'Borrowing...' : unavailable ? 'Unavailable' : 'Borrow Book'}
                  </button>
                  <button
                    onClick={() => handleReserve(book._id)}
                    disabled={!unavailable || pending}
                    className="flex-1 rounded-xl bg-amber-500/20 border border-amber-300/30 hover:bg-amber-500/30 py-2 text-sm disabled:opacity-50"
                  >
                    Reserve
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ScannerModal
        open={scannerOpen}
        title="Scan Book QR"
        formats="qr"
        onResult={handleScanResult}
        onClose={() => setScannerOpen(false)}
      />
    </div>
  );
}
