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
      const response = await getBorrowRecords({ status: 'active' });
      setRecords(response.data || []);
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
      const response = await returnBook(recordId);
      if (!response.data) {
        throw new Error('Invalid response from server');
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadRecords();
    } catch (requestError) {
      const errorMsg = requestError.response?.data?.detail || requestError.message || 'Return failed';
      setError(errorMsg);
      console.error('Return error:', errorMsg);
    } finally {
      setBusyRecordId('');
    }
  };

  const handleScanReturn = async (bookId) => {
    setError('');
    try {
      const response = await returnBookByBookId(bookId);
      if (!response.data) {
        throw new Error('Invalid response from server');
      }
      setScannerOpen(false);
      await loadRecords();
    } catch (requestError) {
      const errorMsg = requestError.response?.data?.detail || requestError.message || 'Return failed';
      setError(errorMsg);
      console.error('Return error:', errorMsg);
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
          className="rounded-xl bg-emerald-500/20 border border-emerald-300/30 px-4 py-2 text-sm hover:bg-emerald-500/30 min-h-[44px]"
        >
          Return via QR
        </button>
      </div>

      {error ? <p className="text-rose-300 text-sm mb-4">{error}</p> : null}

      <div className="glass-card rounded-2xl overflow-auto -mx-4 px-4 md:mx-0 md:px-0">
        <table className="responsive-table">
          <thead className="bg-slate-900/70 text-slate-300">
            <tr>
              <th data-label="Book">Book</th>
              <th data-label="Category">Category</th>
              <th data-label="Borrow Date">Borrow Date</th>
              <th data-label="Due Date">Due Date</th>
              <th data-label="Status">Status</th>
              <th data-label="Action">Action</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-slate-400 md:px-4 md:py-3">No active borrowed books.</td>
              </tr>
            ) : (
              records.map((record) => (
                <tr key={record._id}>
                  <td data-label="Book" className="font-medium text-white">{record.book_title}</td>
                  <td data-label="Category">{record.category}</td>
                  <td data-label="Borrow Date">
                    {record.borrow_date ? new Date(record.borrow_date).toLocaleDateString() : '-'}
                  </td>
                  <td data-label="Due Date">
                    {record.due_date ? new Date(record.due_date).toLocaleDateString() : '-'}
                  </td>
                  <td data-label="Status">{record.status}</td>
                  <td data-label="Action">
                    <button
                      onClick={() => handleReturn(record._id)}
                      disabled={busyRecordId === record._id}
                      className="px-3 py-1 rounded-lg border border-emerald-300/30 bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50 min-h-[40px]"
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
