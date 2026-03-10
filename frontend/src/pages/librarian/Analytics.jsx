import { useEffect, useMemo, useState } from 'react';

import LoadingState from '../../components/LoadingState';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { getAdminMetrics, getBorrowRecords } from '../../services/api';
import { BarChart3, BookOpenText, CalendarClock, UsersRound } from 'lucide-react';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [metrics, setMetrics] = useState({
    total_books: 0,
    available_books: 0,
    issued_books: 0,
    total_students: 0,
    borrowed_books: 0,
    overdue_books: 0,
    total_borrow_records: 0,
  });
  const [records, setRecords] = useState([]);

  useEffect(() => {
    let mounted = true;

    const resolveMetric = (value, fallback) => (Number.isFinite(value) ? value : fallback);

    const deriveMetricsFromRecords = (items) => {
      const now = new Date();
      const studentIds = new Set();
      let borrowed = 0;
      let overdue = 0;

      items.forEach((record) => {
        if (record.student_id) {
          studentIds.add(record.student_id);
        }
        const isBorrowed = record.status === 'Borrowed' || record.status === 'Overdue';
        if (isBorrowed) {
          borrowed += 1;
        }
        if (record.status === 'Overdue') {
          overdue += 1;
        } else if (record.status === 'Borrowed' && record.due_date) {
          const dueDate = new Date(record.due_date);
          if (!Number.isNaN(dueDate.valueOf()) && dueDate < now) {
            overdue += 1;
          }
        }
      });

      return {
        total_students: studentIds.size,
        borrowed_books: borrowed,
        overdue_books: overdue,
        total_borrow_records: items.length,
      };
    };

    const load = async () => {
      setLoading(true);
      setError('');
      setWarning('');
      try {
        const [metricsResult, recordsResult] = await Promise.allSettled([
          getAdminMetrics(),
          getBorrowRecords(),
        ]);

        if (!mounted) {
          return;
        }

        const warnings = [];
        const recordsData = recordsResult.status === 'fulfilled' ? (recordsResult.value.data || []) : [];
        if (recordsResult.status === 'rejected') {
          warnings.push(recordsResult.reason?.response?.data?.detail || recordsResult.reason?.message || 'Borrow records unavailable');
        }

        const metricsData = metricsResult.status === 'fulfilled' ? (metricsResult.value.data || {}) : {};
        if (metricsResult.status === 'rejected') {
          warnings.push(metricsResult.reason?.response?.data?.detail || metricsResult.reason?.message || 'Metrics unavailable');
        }

        const derived = deriveMetricsFromRecords(recordsData);
        const resolved = {
          ...metrics,
          ...metricsData,
          total_students: resolveMetric(metricsData.total_students, derived.total_students),
          borrowed_books: resolveMetric(metricsData.borrowed_books, derived.borrowed_books),
          overdue_books: resolveMetric(metricsData.overdue_books, derived.overdue_books),
          total_borrow_records: resolveMetric(metricsData.total_borrow_records, derived.total_borrow_records),
        };

        setRecords(recordsData);
        setMetrics(resolved);
        if (warnings.length) {
          setWarning(warnings.join(' | '));
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError.response?.data?.detail || requestError.message || 'Failed to load analytics.');
        }
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

  const categoryStats = useMemo(() => {
    const map = new Map();
    records.forEach((record) => {
      const current = map.get(record.category) || 0;
      map.set(record.category, current + 1);
    });

    return [...map.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [records]);

  const overdueRecords = useMemo(() => {
    const now = new Date();
    return records.filter((record) => {
      if (record.status === 'Overdue') {
        return true;
      }
      if (record.status === 'Borrowed' && record.due_date) {
        return new Date(record.due_date) < now;
      }
      return false;
    });
  }, [records]);

  if (loading) {
    return <LoadingState label="Loading analytics..." />;
  }

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Borrow behavior and category demand trends." />
      {error ? <p className="text-rose-300 text-sm mb-4">{error}</p> : null}
      {warning ? <p className="text-amber-200 text-xs mb-4">{warning}</p> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Records" value={metrics.total_borrow_records} icon={BarChart3} tone="indigo" />
        <StatCard title="Borrowed" value={metrics.borrowed_books} icon={BookOpenText} tone="emerald" />
        <StatCard title="Overdue" value={metrics.overdue_books} icon={CalendarClock} tone="rose" />
        <StatCard title="Students" value={metrics.total_students} icon={UsersRound} tone="cyan" />
      </div>

      <section className="glass-card rounded-2xl p-5">
        <h3 className="text-lg font-semibold text-white mb-4">Top Categories By Borrow Count</h3>
        {categoryStats.length === 0 ? (
          <p className="text-sm text-slate-400">No borrow data available yet.</p>
        ) : (
          <div className="space-y-2">
            {categoryStats.map((item) => (
              <div key={item.category} className="flex items-center justify-between rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2">
                <span className="text-slate-200 text-sm">{item.category}</span>
                <span className="text-cyan-300 text-sm font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card rounded-2xl p-5 mt-6">
        <h3 className="text-lg font-semibold text-white mb-4">Overdue Books</h3>
        {overdueRecords.length === 0 ? (
          <p className="text-sm text-slate-400">No overdue books right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left py-2">Student</th>
                  <th className="text-left py-2">Book</th>
                  <th className="text-left py-2">Due Date</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {overdueRecords.map((record) => (
                  <tr key={record._id} className="border-t border-white/10">
                    <td className="py-3 text-white">{record.student_name}</td>
                    <td className="py-3 text-slate-300">{record.book_title}</td>
                    <td className="py-3 text-slate-300">{new Date(record.due_date).toLocaleDateString()}</td>
                    <td className="py-3 text-rose-300">{record.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
