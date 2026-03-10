import { useEffect, useState } from 'react';

import LoadingState from '../../components/LoadingState';
import PageHeader from '../../components/PageHeader';
import ScannerModal from '../../components/ScannerModal';
import {
  createManualBorrowRecord,
  deleteBorrowRecord,
  extendBorrow,
  getBooks,
  getBorrowRecords,
  getUsers,
  markBorrowReturned,
} from '../../services/api';

export default function BorrowRecordsPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [books, setBooks] = useState([]);
  const [busyRecordId, setBusyRecordId] = useState('');
  const [error, setError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMode, setScanMode] = useState('issue');
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueBookId, setIssueBookId] = useState('');
  const [issueStudentId, setIssueStudentId] = useState('');
  const [issueDueDate, setIssueDueDate] = useState('');
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnCandidates, setReturnCandidates] = useState([]);
  const [manualForm, setManualForm] = useState({
    student_id: '',
    book_id: '',
    due_date: '',
  });

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const [recordsResult, studentsResult, booksResult] = await Promise.allSettled([
        getBorrowRecords(),
        getUsers({ role: 'student' }),
        getBooks(),
      ]);

      const errors = [];

      if (recordsResult.status === 'fulfilled') {
        setRecords(recordsResult.value.data || []);
      } else {
        errors.push(recordsResult.reason?.response?.data?.detail || recordsResult.reason?.message || 'Borrow records unavailable');
        setRecords([]);
      }

      if (studentsResult.status === 'fulfilled') {
        setStudents(studentsResult.value.data || []);
      } else {
        errors.push(studentsResult.reason?.response?.data?.detail || studentsResult.reason?.message || 'Students list unavailable');
        setStudents([]);
      }

      if (booksResult.status === 'fulfilled') {
        setBooks(booksResult.value.data || []);
      } else {
        errors.push(booksResult.reason?.response?.data?.detail || booksResult.reason?.message || 'Books list unavailable');
        setBooks([]);
      }

      if (errors.length) {
        setError(errors.join(' | '));
      }
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Failed to load borrow records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markReturned = async (recordId) => {
    setBusyRecordId(recordId);
    setError('');
    try {
      await markBorrowReturned(recordId);
      await load();
      setReturnModalOpen(false);
      setReturnCandidates([]);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to mark returned');
    } finally {
      setBusyRecordId('');
    }
  };

  const extendDue = async (recordId, dueDate) => {
    const currentDue = new Date(dueDate);
    currentDue.setDate(currentDue.getDate() + 7);

    setBusyRecordId(recordId);
    setError('');
    try {
      await extendBorrow(recordId, currentDue.toISOString());
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to extend due date');
    } finally {
      setBusyRecordId('');
    }
  };

  const removeRecord = async (recordId) => {
    const confirmed = window.confirm('Delete this borrow record?');
    if (!confirmed) {
      return;
    }

    setBusyRecordId(recordId);
    setError('');

    try {
      await deleteBorrowRecord(recordId);
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Unable to delete record');
    } finally {
      setBusyRecordId('');
    }
  };

  const submitManualRecord = async (event) => {
    event.preventDefault();
    if (!manualForm.student_id || !manualForm.book_id) {
      setError('Student and book are required for manual borrow.');
      return;
    }

    setError('');
    try {
      await createManualBorrowRecord({
        student_id: manualForm.student_id,
        book_id: manualForm.book_id,
        due_date: manualForm.due_date ? new Date(manualForm.due_date).toISOString() : undefined,
      });
      setManualForm({ student_id: '', book_id: '', due_date: '' });
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Manual borrow creation failed');
    }
  };

  const openScanner = (mode) => {
    setScanMode(mode);
    setScannerOpen(true);
  };

  const openIssueModal = (bookId) => {
    const book = books.find((item) => item._id === bookId);
    if (!book) {
      setError('Book not found for this QR code.');
      return;
    }
    const due = new Date();
    due.setDate(due.getDate() + 7);
    setIssueBookId(bookId);
    setIssueStudentId('');
    setIssueDueDate(due.toISOString().slice(0, 10));
    setIssueModalOpen(true);
  };

  const handleIssueSubmit = async () => {
    if (!issueStudentId || !issueBookId) {
      setError('Select a student before issuing this book.');
      return;
    }
    setError('');
    try {
      await createManualBorrowRecord({
        student_id: issueStudentId,
        book_id: issueBookId,
        due_date: issueDueDate ? new Date(issueDueDate).toISOString() : undefined,
      });
      setIssueModalOpen(false);
      setIssueBookId('');
      setIssueStudentId('');
      setIssueDueDate('');
      await load();
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Issue failed');
    }
  };

  const handleScanResult = async (value) => {
    if (scanMode === 'issue') {
      openIssueModal(value);
      return;
    }

    if (scanMode === 'return') {
      const activeMatches = records.filter(
        (record) => record.book_id === value && ['Borrowed', 'Overdue'].includes(record.status)
      );
      if (activeMatches.length === 0) {
        setError('No active borrow found for this book.');
        return;
      }
      if (activeMatches.length === 1) {
        setBusyRecordId(activeMatches[0]._id);
        setError('');
        try {
          await markBorrowReturned(activeMatches[0]._id);
          await load();
        } catch (requestError) {
          setError(requestError.response?.data?.detail || 'Unable to return book');
        } finally {
          setBusyRecordId('');
        }
        return;
      }

      setReturnCandidates(activeMatches);
      setReturnModalOpen(true);
    }
  };

  const issueBook = books.find((book) => book._id === issueBookId);
  const hasStudents = students.length > 0;

  if (loading) {
    return <LoadingState label="Loading borrow records..." />;
  }

  return (
    <div>
      <PageHeader title="Borrow Records" subtitle="Track all book borrow transactions and return workflows." />

      {error ? <p className="text-rose-300 text-sm mb-4">{error}</p> : null}

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={() => openScanner('issue')}
          className="rounded-xl bg-cyan-500/20 border border-cyan-300/30 px-4 py-2 text-sm hover:bg-cyan-500/30"
        >
          Scan QR to Issue
        </button>
        <button
          type="button"
          onClick={() => openScanner('return')}
          className="rounded-xl bg-emerald-500/20 border border-emerald-300/30 px-4 py-2 text-sm hover:bg-emerald-500/30"
        >
          Scan QR to Return
        </button>
      </div>

      <form onSubmit={submitManualRecord} className="glass-card rounded-2xl p-4 mb-5 grid grid-cols-1 md:grid-cols-[1fr_1fr_220px_auto] gap-3">
        {hasStudents ? (
          <select
            value={manualForm.student_id}
            onChange={(event) => setManualForm((prev) => ({ ...prev, student_id: event.target.value }))}
            className="field"
            required
          >
            <option value="">Select Student</option>
            {students.map((student) => (
              <option key={student._id} value={student._id}>{student.name} ({student.email})</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={manualForm.student_id}
            onChange={(event) => setManualForm((prev) => ({ ...prev, student_id: event.target.value }))}
            className="field"
            placeholder="Enter student email or UID"
            required
          />
        )}

        <select
          value={manualForm.book_id}
          onChange={(event) => setManualForm((prev) => ({ ...prev, book_id: event.target.value }))}
          className="field"
          required
        >
          <option value="">Select Book</option>
          {books.map((book) => (
            <option key={book._id} value={book._id}>{book.title} ({book.available_copies} available)</option>
          ))}
        </select>

        <input
          type="date"
          value={manualForm.due_date}
          onChange={(event) => setManualForm((prev) => ({ ...prev, due_date: event.target.value }))}
          className="field"
        />

        <button className="rounded-xl bg-indigo-500/20 border border-indigo-300/30 px-4 py-2 text-sm hover:bg-indigo-500/30">
          Add Borrow Record
        </button>
      </form>

      <div className="glass-card rounded-2xl overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/70 text-slate-300">
            <tr>
              <th className="text-left px-4 py-3">Student Name</th>
              <th className="text-left px-4 py-3">Book Title</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-left px-4 py-3">Borrow Date</th>
              <th className="text-left px-4 py-3">Return Date</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const pending = busyRecordId === record._id;

              return (
                <tr key={record._id} className="border-t border-white/10">
                  <td className="px-4 py-3 text-white">{record.student_name}</td>
                  <td className="px-4 py-3 text-slate-300">{record.book_title}</td>
                  <td className="px-4 py-3 text-slate-300">{record.category}</td>
                  <td className="px-4 py-3 text-slate-300">{new Date(record.borrow_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-slate-300">{record.return_date ? new Date(record.return_date).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-slate-300">{record.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => markReturned(record._id)}
                        disabled={pending || record.status === 'Returned'}
                        className="px-2 py-1 rounded-lg text-xs bg-emerald-500/20 border border-emerald-300/30 hover:bg-emerald-500/30 disabled:opacity-40"
                      >
                        Mark Returned
                      </button>
                      <button
                        onClick={() => extendDue(record._id, record.due_date)}
                        disabled={pending || record.status === 'Returned'}
                        className="px-2 py-1 rounded-lg text-xs bg-amber-500/20 border border-amber-300/30 hover:bg-amber-500/30 disabled:opacity-40"
                      >
                        Extend 7d
                      </button>
                      <button
                        onClick={() => removeRecord(record._id)}
                        disabled={pending}
                        className="px-2 py-1 rounded-lg text-xs bg-rose-500/20 border border-rose-300/30 hover:bg-rose-500/30 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ScannerModal
        open={scannerOpen}
        title={scanMode === 'issue' ? 'Scan Book QR to Issue' : 'Scan Book QR to Return'}
        formats="qr"
        onResult={handleScanResult}
        onClose={() => setScannerOpen(false)}
      />

      {issueModalOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/90 shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Issue Book</h3>
              <button
                onClick={() => setIssueModalOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-300"
              >
                Close
              </button>
            </div>

            {issueBook ? (
              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">
                <p className="font-semibold">{issueBook.title}</p>
                <p className="text-xs text-slate-400">{issueBook.author} • {issueBook.category}</p>
                <p className="text-xs text-slate-400 mt-1">Available: {issueBook.available_copies}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Select a student to issue this book.</p>
            )}

            {hasStudents ? (
              <select
                value={issueStudentId}
                onChange={(event) => setIssueStudentId(event.target.value)}
                className="field"
              >
                <option value="">Select Student</option>
                {students.map((student) => (
                  <option key={student._id} value={student._id}>{student.name} ({student.email})</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={issueStudentId}
                onChange={(event) => setIssueStudentId(event.target.value)}
                className="field"
                placeholder="Enter student email or UID"
              />
            )}

            <input
              type="date"
              value={issueDueDate}
              onChange={(event) => setIssueDueDate(event.target.value)}
              className="field"
            />

            <button
              onClick={handleIssueSubmit}
              className="w-full rounded-xl bg-emerald-500/20 border border-emerald-300/30 py-2 text-sm hover:bg-emerald-500/30"
            >
              Issue Book
            </button>
          </div>
        </div>
      ) : null}

      {returnModalOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950/90 shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Select Borrow Record to Return</h3>
              <button
                onClick={() => setReturnModalOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-300"
              >
                Close
              </button>
            </div>
            <div className="space-y-2">
              {returnCandidates.map((record) => (
                <div key={record._id} className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{record.student_name}</p>
                    <p className="text-xs text-slate-400">
                      Due: {record.due_date ? new Date(record.due_date).toLocaleDateString() : 'Not set'}
                    </p>
                  </div>
                  <button
                    onClick={() => markReturned(record._id)}
                    className="px-3 py-1 rounded-lg text-xs bg-emerald-500/20 border border-emerald-300/30 hover:bg-emerald-500/30"
                  >
                    Return
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
