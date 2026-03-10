import { useEffect, useState } from 'react';

import LoadingState from '../../components/LoadingState';
import PageHeader from '../../components/PageHeader';
import { getBorrowRecords } from '../../services/api';

export default function HistoryPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const response = await getBorrowRecords();
        if (mounted) {
          setRecords(response.data);
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

  if (loading) {
    return <LoadingState label="Loading history..." />;
  }

  return (
    <div>
      <PageHeader title="Borrow History" subtitle="Complete borrowing timeline from Firestore records." />

      <div className="space-y-3">
        {records.length === 0 ? (
          <div className="glass-card rounded-2xl p-6 text-sm text-slate-400">No history available.</div>
        ) : (
          records.map((record) => (
            <article key={record._id} className="glass-card rounded-2xl p-4 border border-white/10">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <h3 className="text-white font-medium">{record.book_title}</h3>
                <span className="text-xs rounded-lg px-2 py-1 bg-slate-900/70 border border-white/10 text-slate-300">{record.status}</span>
              </div>
              <p className="text-sm text-slate-400 mt-1">Category: {record.category}</p>
              <p className="text-xs text-slate-400 mt-2">
                Borrowed: {new Date(record.borrow_date).toLocaleDateString()} | Due: {new Date(record.due_date).toLocaleDateString()} |
                Returned: {record.return_date ? new Date(record.return_date).toLocaleDateString() : 'Pending'}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
