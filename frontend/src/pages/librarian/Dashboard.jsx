import { useEffect, useMemo, useState } from 'react';
import { Activity, BookOpen, Clock3, LibraryBig, RefreshCcw, ShieldCheck, Users } from 'lucide-react';

import LoadingState from '../../components/LoadingState';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import BulkImportPanel from '../../components/BulkImportPanel';
import ReportDownloadPanel from '../../components/ReportDownloadPanel';
import BookCover from '../../components/BookCover';
import { getAdminMetrics, getBorrowRecords, getBooks, getUsers } from '../../services/api';

export default function LibrarianDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [metrics, setMetrics] = useState({
    total_books: 0,
    available_books: 0,
    issued_books: 0,
    total_students: 0,
    borrowed_books: 0,
    overdue_books: 0,
    total_borrow_records: 0,
  });
  const [latestRecords, setLatestRecords] = useState([]);
  const [books, setBooks] = useState([]);

  const load = async (mountedRef) => {
    setLoading(true);
    setError('');
    try {
      const [metricsResult, recordsResult, booksResult, usersResult] = await Promise.allSettled([
        getAdminMetrics(),
        getBorrowRecords(),
        getBooks(),
        getUsers({ role: 'student' }),
      ]);

      if (mountedRef && !mountedRef.current) {
        return;
      }

      const metricsResponse = metricsResult.status === 'fulfilled' ? metricsResult.value : null;
      const recordsResponse = recordsResult.status === 'fulfilled' ? recordsResult.value : null;
      const booksResponse = booksResult.status === 'fulfilled' ? booksResult.value : null;
      const usersResponse = usersResult.status === 'fulfilled' ? usersResult.value : null;

      const recordsData = recordsResponse?.data || [];
      const booksData = booksResponse?.data || [];
      const usersData = usersResponse?.data || [];

      const availableBooks = booksData.reduce((sum, book) => sum + (book.available_copies || 0), 0);
      const totalBooks = booksData.length;
      const issuedBooks = Math.max(totalBooks - availableBooks, 0);
      const now = new Date();
      const overdueRecords = recordsData.filter((record) => {
        if (record.status === 'Overdue') {
          return true;
        }
        if (record.status === 'Borrowed' && record.due_date) {
          return new Date(record.due_date) < now;
        }
        return false;
      });
      const borrowedCount = recordsData.filter((record) => ['Borrowed', 'Overdue'].includes(record.status)).length;

      const derivedMetrics = {
        total_books: totalBooks,
        available_books: availableBooks,
        issued_books: issuedBooks,
        total_students: usersData.length,
        borrowed_books: borrowedCount,
        overdue_books: overdueRecords.length,
        total_borrow_records: recordsData.length,
      };

      const resolveMetric = (apiValue, fallback) => {
        const apiNumber = Number(apiValue);
        if (Number.isFinite(apiNumber) && apiNumber > 0) {
          return apiNumber;
        }
        return fallback;
      };

      const apiMetrics = metricsResponse?.data || {};
      setMetrics({
        total_books: resolveMetric(apiMetrics.total_books, derivedMetrics.total_books),
        available_books: resolveMetric(apiMetrics.available_books, derivedMetrics.available_books),
        issued_books: resolveMetric(apiMetrics.issued_books, derivedMetrics.issued_books),
        total_students: resolveMetric(apiMetrics.total_students, derivedMetrics.total_students),
        borrowed_books: resolveMetric(apiMetrics.borrowed_books, derivedMetrics.borrowed_books),
        overdue_books: resolveMetric(apiMetrics.overdue_books, derivedMetrics.overdue_books),
        total_borrow_records: resolveMetric(apiMetrics.total_borrow_records, derivedMetrics.total_borrow_records),
      });

      setLatestRecords(recordsData.slice(0, 6));
      setBooks(booksData);
      setLastUpdated(new Date());
    } catch (requestError) {
      if (!mountedRef || mountedRef.current) {
        setError(requestError.response?.data?.detail || requestError.message || 'Failed to load dashboard data.');
      }
    } finally {
      if (!mountedRef || mountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const mountedRef = { current: true };
    load(mountedRef);

    return () => {
      mountedRef.current = false;
    };
  }, []);

  if (loading) {
    return <LoadingState label="Loading admin dashboard..." />;
  }

  const availabilityRate = metrics.total_books ? Math.round((metrics.available_books / metrics.total_books) * 100) : 0;
  const activeBorrows = metrics.borrowed_books;
  const overdueRate = activeBorrows ? Math.round((metrics.overdue_books / activeBorrows) * 100) : 0;

  return (
    <div>
      <PageHeader title="Librarian Dashboard" subtitle="Real-time view of books, students, and active borrowing." />
      {error ? <p className="text-rose-300 text-sm mb-4">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 text-xs text-slate-400">
        <span>Last updated: {lastUpdated ? lastUpdated.toLocaleString() : 'Unknown'}</span>
        <button
          onClick={() => load()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900"
        >
          <RefreshCcw size={14} />
          Refresh data
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Books" value={metrics.total_books} icon={LibraryBig} tone="indigo" delay={0.05} />
        <StatCard title="Available Books" value={metrics.available_books} icon={BookOpen} tone="emerald" delay={0.1} />
        <StatCard title="Issued Books" value={metrics.issued_books} icon={BookOpen} tone="amber" delay={0.15} />
        <StatCard title="Overdue Books" value={metrics.overdue_books} icon={Clock3} tone="rose" delay={0.2} />
        <StatCard title="Total Students" value={metrics.total_students} icon={Users} tone="cyan" delay={0.25} />
      </div>

      <section className="glass-card rounded-2xl p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Collection Health</h3>
            <p className="text-xs text-slate-400">Availability, active borrows, and overdue risk.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="px-3 py-1 rounded-full border border-white/10 bg-slate-900/70">
              Active Borrows: {activeBorrows}
            </span>
            <span className="px-3 py-1 rounded-full border border-white/10 bg-slate-900/70">
              Total Records: {metrics.total_borrow_records}
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Availability</span>
              <span>{availabilityRate}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-800">
              <div className="h-2 rounded-full bg-emerald-400/70" style={{ width: `${availabilityRate}%` }} />
            </div>
            <p className="text-xs text-slate-400 mt-3">Books currently available on shelves.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Overdue Risk</span>
              <span>{overdueRate}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-800">
              <div className="h-2 rounded-full bg-rose-400/70" style={{ width: `${overdueRate}%` }} />
            </div>
            <p className="text-xs text-slate-400 mt-3">Share of active borrows that are overdue.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-300/30 flex items-center justify-center text-cyan-200">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-sm text-white">System Status</p>
              <p className="text-xs text-slate-400">Borrow data synced and ready.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <BulkImportPanel onImportComplete={() => load()} />
        <ReportDownloadPanel />
      </div>

      <section className="glass-card rounded-2xl p-5 mt-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Borrow Activity</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-slate-400">
              <tr>
                <th className="text-left py-2">Student</th>
                <th className="text-left py-2">Book</th>
                <th className="text-left py-2">Borrow Date</th>
                <th className="text-left py-2">Due Date</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {latestRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-400">No borrow records yet.</td>
                </tr>
              ) : (
                latestRecords.map((record) => (
                  <tr key={record._id} className="border-t border-white/10">
                    <td className="py-3 text-white">{record.student_name}</td>
                    <td className="py-3 text-slate-300">{record.book_title}</td>
                    <td className="py-3 text-slate-300">{new Date(record.borrow_date).toLocaleDateString()}</td>
                    <td className="py-3 text-slate-300">{new Date(record.due_date).toLocaleDateString()}</td>
                    <td className="py-3 text-slate-300">{record.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-card rounded-2xl p-5 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Catalog Snapshot</h3>
            <p className="text-xs text-slate-400">Latest books from the library collection.</p>
          </div>
          <button
            onClick={() => window.location.assign('/manage-books')}
            className="rounded-xl bg-slate-900/70 border border-white/10 px-4 py-2 text-sm hover:bg-slate-900"
          >
            Manage Books
          </button>
        </div>

        {books.length === 0 ? (
          <p className="text-sm text-slate-400">No books available right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.slice(0, 6).map((book) => (
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
    </div>
  );
}
