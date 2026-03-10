import { useEffect, useState } from 'react';
import { BookOpen, Clock3, LibraryBig, Users } from 'lucide-react';

import LoadingState from '../../components/LoadingState';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import BulkImportPanel from '../../components/BulkImportPanel';
import ReportDownloadPanel from '../../components/ReportDownloadPanel';
import { getAdminMetrics, getBorrowRecords } from '../../services/api';

export default function LibrarianDashboard() {
  const [loading, setLoading] = useState(true);
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

  const load = async (mountedRef) => {
    setLoading(true);
    try {
      const [metricsResponse, recordsResponse] = await Promise.all([
        getAdminMetrics(),
        getBorrowRecords(),
      ]);

      if (mountedRef && !mountedRef.current) {
        return;
      }

      setMetrics(metricsResponse.data);
      setLatestRecords(recordsResponse.data.slice(0, 6));
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

  return (
    <div>
      <PageHeader title="Librarian Dashboard" subtitle="Real-time view of books, students, and active borrowing." />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        <StatCard title="Total Books" value={metrics.total_books} icon={LibraryBig} tone="indigo" delay={0.05} />
        <StatCard title="Available Books" value={metrics.available_books} icon={BookOpen} tone="emerald" delay={0.1} />
        <StatCard title="Issued Books" value={metrics.issued_books} icon={BookOpen} tone="amber" delay={0.15} />
        <StatCard title="Overdue Books" value={metrics.overdue_books} icon={Clock3} tone="rose" delay={0.2} />
        <StatCard title="Total Students" value={metrics.total_students} icon={Users} tone="cyan" delay={0.25} />
      </div>

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
    </div>
  );
}
