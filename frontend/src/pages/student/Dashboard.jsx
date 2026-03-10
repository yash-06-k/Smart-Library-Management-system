import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Clock3, History, ScanLine, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import LoadingState from '../../components/LoadingState';
import BookCover from '../../components/BookCover';
import PageHeader from '../../components/PageHeader';
import ScannerModal from '../../components/ScannerModal';
import StatCard from '../../components/StatCard';
import { borrowBook, getBooks, getBorrowRecords, getNotifications } from '../../services/api';

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [borrowRecords, setBorrowRecords] = useState([]);
  const [books, setBooks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanAction, setScanAction] = useState('view');
  const [scanError, setScanError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [borrowResponse, booksResponse] = await Promise.all([
          getBorrowRecords(),
          getBooks(),
        ]);

        const notificationsResponse = await getNotifications();

        if (!mounted) {
          return;
        }

        setBorrowRecords(borrowResponse.data);
        setBooks(booksResponse.data);
        setNotifications(notificationsResponse.data || []);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const derived = useMemo(() => {
    const now = new Date();
    const active = borrowRecords.filter((record) => record.status === 'Borrowed' || record.status === 'Overdue');
    const dueSoon = active.filter((record) => {
      const due = new Date(record.due_date);
      const diff = due.getTime() - now.getTime();
      return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000;
    });
    const history = borrowRecords.filter((record) => record.status === 'Returned');

    return { active, dueSoon, history };
  }, [borrowRecords]);

  const featuredBooks = useMemo(() => {
    return books.slice(0, 6);
  }, [books]);

  const recommendedBooks = useMemo(() => {
    const borrowedBookIds = new Set(derived.active.map((record) => record.book_id));
    return books
      .filter((book) => book.available_copies > 0 && !borrowedBookIds.has(book._id))
      .slice(0, 4);
  }, [books, derived.active]);

  const openScanner = (action) => {
    setScanAction(action);
    setScanError('');
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
        setScanError('');
      } catch (requestError) {
        setScanError(requestError.response?.data?.detail || 'Borrow request failed');
      }
    }
  };

  if (loading) {
    return <LoadingState label="Loading student dashboard..." />;
  }

  return (
    <div>
      <PageHeader title="Student Dashboard" subtitle="Track borrowed books, due dates, and personalized recommendations." />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard title="Borrowed Books" value={derived.active.length} icon={BookOpen} tone="indigo" delay={0.05} />
        <StatCard title="Due Soon" value={derived.dueSoon.length} icon={Clock3} tone="amber" delay={0.1} />
        <StatCard title="Borrow History" value={derived.history.length} icon={History} tone="cyan" delay={0.15} />
        <StatCard title="Recommendations" value={recommendedBooks.length} icon={Sparkles} tone="emerald" delay={0.2} />
      </div>

      <section className="glass-card rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Quick Scan</h3>
            <p className="text-xs text-slate-400">Scan a QR code to view details or borrow instantly.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => openScanner('view')}
              className="rounded-xl bg-cyan-500/20 border border-cyan-300/30 px-4 py-2 text-sm hover:bg-cyan-500/30 flex items-center gap-2"
            >
              <ScanLine size={16} />
              Scan for Details
            </button>
            <button
              onClick={() => openScanner('borrow')}
              className="rounded-xl bg-emerald-500/20 border border-emerald-300/30 px-4 py-2 text-sm hover:bg-emerald-500/30 flex items-center gap-2"
            >
              <ScanLine size={16} />
              Scan & Borrow (7d)
            </button>
          </div>
        </div>
        {scanError ? <p className="text-xs text-rose-300 mt-3">{scanError}</p> : null}
      </section>

      <section className="glass-card rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Library Shelf</h3>
            <p className="text-xs text-slate-400">Recent additions from the catalog.</p>
          </div>
          <button
            onClick={() => navigate('/browse-books')}
            className="rounded-xl bg-slate-900/70 border border-white/10 px-4 py-2 text-sm hover:bg-slate-900"
          >
            Browse All
          </button>
        </div>

        {featuredBooks.length === 0 ? (
          <p className="text-sm text-slate-400">No books available right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredBooks.map((book) => (
              <article key={book._id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 flex gap-4">
                <BookCover
                  src={book.cover_image}
                  title={book.title}
                  author={book.author}
                  className="w-16 h-20 flex-shrink-0"
                />
                <div className="space-y-1">
                  <p className="text-xs text-cyan-300 uppercase tracking-wide">{book.category}</p>
                  <h4 className="font-semibold text-white line-clamp-2">{book.title}</h4>
                  <p className="text-xs text-slate-400">by {book.author}</p>
                  <p className="text-xs text-emerald-300">{book.available_copies} copies available</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Recommended Books</h3>
        {recommendedBooks.length === 0 ? (
          <p className="text-sm text-slate-400">No recommendations yet. Borrow history will improve suggestions.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recommendedBooks.map((book) => (
              <article key={book._id} className="rounded-xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-sm text-cyan-300">{book.category}</p>
                <h4 className="font-semibold mt-1 text-white line-clamp-2">{book.title}</h4>
                <p className="text-xs text-slate-400 mt-1">by {book.author}</p>
                <p className="text-xs text-emerald-300 mt-3">{book.available_copies} copies available</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card rounded-2xl p-5 mt-6">
        <h3 className="text-lg font-semibold text-white mb-4">Reservation Alerts</h3>
        {notifications.length === 0 ? (
          <p className="text-sm text-slate-400">No reservation notifications yet.</p>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <div key={notification._id} className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm">
                <p className="text-slate-200">{notification.message}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {notification.created_at ? new Date(notification.created_at).toLocaleString() : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <ScannerModal
        open={scannerOpen}
        title={scanAction === 'view' ? 'Scan Book QR' : 'Scan Book QR to Borrow'}
        formats="qr"
        onResult={handleScanResult}
        onClose={() => setScannerOpen(false)}
      />
    </div>
  );
}
