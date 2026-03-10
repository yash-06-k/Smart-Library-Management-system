import { useEffect, useState } from 'react';

import LoadingState from '../../components/LoadingState';
import PageHeader from '../../components/PageHeader';
import ScannerModal from '../../components/ScannerModal';
import { getBorrowRecords, returnBook, returnBookByBookId } from '../../services/api';

export default function BorrowedBooks() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [busyRecordId, setBusyRecordId] = useState('');
  const [error, setError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  const loadRecords = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getBorrowRecords({ status: 'Borrowed' });
      const overdueResponse = await getBorrowRecords({ status: 'Overdue' });
      setRecords([...response.data, ...overdueResponse.data]);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Failed to load borrow records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleReturn = async (recordId) => {
    setBusyRecordId(recordId);
    setError('');
    try {
      await returnBook(recordId);
      await loadRecords();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Return failed');
    } finally {
      setBusyRecordId('');
    }
  };

  const handleScanReturn = async (bookId) => {
    setError('');
    try {
      await returnBookByBookId(bookId);
      await loadRecords();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Return failed');
    }
  };

  if (loading) {
    return <LoadingState label="Loading borrowed books..." />;
  }

  return (
    <div>
      <PageHeader title="Borrowed Books" subtitle="Return books and monitor due dates." />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setScannerOpen(true)}
          className="rounded-xl bg-emerald-500/20 border border-emerald-300/30 px-4 py-2 text-sm hover:bg-emerald-500/30"
        >
          Return via QR
        </button>
      </div>

      {error ? <p className="text-rose-300 text-sm mb-4">{error}</p> : null}

      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/70 text-slate-300">
            <tr>
              <th className="text-left px-4 py-3">Book</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-left px-4 py-3">Borrow Date</th>
              <th className="text-left px-4 py-3">Due Date</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-400" colSpan={6}>No active borrowed books.</td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record._id} className="border-t border-white/10">
                  <td className="px-4 py-3 text-white">{record.book_title}</td>
                  <td className="px-4 py-3 text-slate-300">{record.category}</td>
                  <td className="px-4 py-3 text-slate-300">{new Date(record.borrow_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-300">{new Date(record.due_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-300">{record.status}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleReturn(record._id)}
                      disabled={busyRecordId === record._id}
                      className="px-3 py-1 rounded-lg border border-emerald-300/30 bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      {busyRecordId === record._id ? 'Returning...' : 'Return'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ScannerModal
        open={scannerOpen}
        title="Scan Book QR to Return"
        formats="qr"
        onResult={handleScanReturn}
        onClose={() => setScannerOpen(false)}
      />
    </div>
  );
}
