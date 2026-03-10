import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Filter, FileDown, ChevronDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { getBooks, getBorrowRecords, getUsers } from '../services/api';

const buildCsv = (rows) => {
  const header = [
    'Student Name',
    'Student Email',
    'Book Title',
    'ISBN',
    'Category',
    'Status',
    'Borrow Date',
    'Due Date',
    'Return Date',
    'Rack Location',
    'Book ID',
    'Student ID',
  ];

  const escapeValue = (value) => {
    const text = `${value ?? ''}`.replace(/"/g, '""');
    return `"${text}"`;
  };

  const lines = [
    header.map(escapeValue).join(','),
    ...rows.map((row) =>
      [
        row.student_name,
        row.student_email,
        row.book_title,
        row.book_isbn,
        row.category,
        row.status,
        row.borrow_date,
        row.due_date,
        row.return_date,
        row.rack_location,
        row.book_id,
        row.student_id,
      ]
        .map(escapeValue)
        .join(',')
    ),
  ];

  return lines.join('\n');
};

const downloadFile = (content, name, type) => {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.URL.revokeObjectURL(url);
};

export default function ReportDownloadPanel() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [books, setBooks] = useState([]);

  const [scope, setScope] = useState('overall');
  const [reportType, setReportType] = useState('history');
  const [studentId, setStudentId] = useState('');
  const [bookId, setBookId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [range, setRange] = useState('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [downloadOpen, setDownloadOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClick = (event) => {
      if (!downloadOpen) {
        return;
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDownloadOpen(false);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [downloadOpen, dropdownRef]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [recordsResponse, studentsResponse, booksResponse] = await Promise.all([
          getBorrowRecords(),
          getUsers({ role: 'student' }),
          getBooks(),
        ]);
        if (!mounted) {
          return;
        }
        setRecords(recordsResponse.data || []);
        setStudents(studentsResponse.data || []);
        setBooks(booksResponse.data || []);
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

  const filteredRecords = useMemo(() => {
    let data = [...records];

    if (scope === 'student' && studentId) {
      data = data.filter((record) => record.student_id === studentId);
    }

    if (scope === 'book' && bookId) {
      data = data.filter((record) => record.book_id === bookId);
    }

    if (scope === 'student' && bookId) {
      data = data.filter((record) => record.book_id === bookId);
    }

    if (scope === 'book' && studentId) {
      data = data.filter((record) => record.student_id === studentId);
    }

    if (statusFilter !== 'all') {
      data = data.filter((record) => record.status === statusFilter);
    }

    if (range !== 'all') {
      const now = new Date();
      let fromDate = null;
      if (range === '7') {
        fromDate = new Date(now);
        fromDate.setDate(fromDate.getDate() - 7);
      } else if (range === '30') {
        fromDate = new Date(now);
        fromDate.setDate(fromDate.getDate() - 30);
      } else if (range === 'custom' && customStart) {
        fromDate = new Date(customStart);
      }

      let toDate = null;
      if (range === 'custom' && customEnd) {
        toDate = new Date(customEnd);
      }

      if (fromDate) {
        data = data.filter((record) => new Date(record.borrow_date) >= fromDate);
      }
      if (toDate) {
        data = data.filter((record) => new Date(record.borrow_date) <= toDate);
      }
    }

    return data;
  }, [records, scope, studentId, bookId, statusFilter, range, customStart, customEnd]);

  const reportRows = useMemo(() => {
    const studentMap = new Map(students.map((student) => [student._id, student]));
    const bookMap = new Map(books.map((book) => [book._id, book]));

    return filteredRecords.map((record) => {
      const student = studentMap.get(record.student_id);
      const book = bookMap.get(record.book_id);
      return {
        student_name: student?.name || record.student_name || 'Unknown Student',
        student_email: student?.email || record.student_email || '',
        book_title: book?.title || record.book_title || 'Unknown Book',
        book_isbn: book?.isbn || record.book_isbn || '',
        category: book?.category || record.category || '',
        status: record.status,
        borrow_date: record.borrow_date ? new Date(record.borrow_date).toLocaleDateString() : '',
        due_date: record.due_date ? new Date(record.due_date).toLocaleDateString() : '',
        return_date: record.return_date ? new Date(record.return_date).toLocaleDateString() : '',
        rack_location: book?.rack_location || record.rack_location || '',
        book_id: record.book_id,
        student_id: record.student_id,
      };
    });
  }, [filteredRecords, students, books]);

  const reportStats = useMemo(() => {
    const totals = {
      Borrowed: 0,
      Returned: 0,
      Overdue: 0,
      Reserved: 0,
    };
    reportRows.forEach((row) => {
      if (totals[row.status] !== undefined) {
        totals[row.status] += 1;
      }
    });
    return totals;
  }, [reportRows]);

  const selectedStudent = useMemo(
    () => students.find((student) => student._id === studentId),
    [students, studentId]
  );
  const selectedBook = useMemo(
    () => books.find((book) => book._id === bookId),
    [books, bookId]
  );

  const buildStructuredReport = () => {
    if (reportType === 'student_profile') {
      return {
        type: 'student_profile',
        student: selectedStudent || null,
        filters: { scope, statusFilter, range, customStart, customEnd },
        stats: reportStats,
        records: reportRows,
      };
    }
    if (reportType === 'book_profile') {
      return {
        type: 'book_profile',
        book: selectedBook || null,
        filters: { scope, statusFilter, range, customStart, customEnd },
        stats: reportStats,
        records: reportRows,
      };
    }
    return {
      type: 'history',
      filters: { scope, statusFilter, range, customStart, customEnd },
      stats: reportStats,
      records: reportRows,
    };
  };

  const ensureReady = (typeOverride) => {
    const activeType = typeOverride || reportType;
    setDownloadError('');
    if (activeType === 'student_profile' && !selectedStudent) {
      setDownloadError('Select a student to download the student profile report.');
      return false;
    }
    if (activeType === 'book_profile' && !selectedBook) {
      setDownloadError('Select a book to download the book profile report.');
      return false;
    }
    return true;
  };

  const handleDownloadCsv = () => {
    if (!ensureReady()) {
      return;
    }
    const csv = buildCsv(reportRows);
    const suffix = reportType === 'history' ? scope : reportType;
    downloadFile(csv, `library-report-${suffix}.csv`, 'text/csv');
  };

  const handleDownloadJson = () => {
    if (!ensureReady()) {
      return;
    }
    const content = JSON.stringify(buildStructuredReport(), null, 2);
    const suffix = reportType === 'history' ? scope : reportType;
    downloadFile(content, `library-report-${suffix}.json`, 'application/json');
  };

  const handleDownloadPdf = (typeOverride) => {
    const activeType = typeOverride || reportType;
    if (!ensureReady(activeType)) {
      return;
    }

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    let cursorY = 50;

    const titleMap = {
      history: 'Library Borrow History',
      student_profile: 'Student Profile Report',
      book_profile: 'Book Summary Report',
    };

    doc.setFontSize(18);
    doc.text(titleMap[activeType] || 'Library Report', margin, cursorY);
    cursorY += 24;

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, cursorY);
    cursorY += 16;

    if (activeType === 'student_profile' && selectedStudent) {
      doc.setFontSize(12);
      doc.text(`Student: ${selectedStudent.name} (${selectedStudent.email})`, margin, cursorY);
      cursorY += 18;
    }

    if (activeType === 'book_profile' && selectedBook) {
      doc.setFontSize(12);
      doc.text(`Book: ${selectedBook.title}`, margin, cursorY);
      cursorY += 16;
      doc.setFontSize(10);
      doc.text(`Author: ${selectedBook.author} | ISBN: ${selectedBook.isbn}`, margin, cursorY);
      cursorY += 16;
      doc.text(`Category: ${selectedBook.category} | Rack: ${selectedBook.rack_location || '-'}`, margin, cursorY);
      cursorY += 16;
    }

    doc.setFontSize(10);
    doc.text(
      `Scope: ${scope} | Status: ${statusFilter} | Range: ${range}`,
      margin,
      cursorY
    );
    cursorY += 16;

    doc.text(
      `Totals - Borrowed: ${reportStats.Borrowed} | Returned: ${reportStats.Returned} | Overdue: ${reportStats.Overdue} | Reserved: ${reportStats.Reserved}`,
      margin,
      cursorY
    );
    cursorY += 20;

    const headers = [
      [
        'Student',
        'Book',
        'ISBN',
        'Status',
        'Borrow Date',
        'Due Date',
        'Return Date',
      ],
    ];

    const body = reportRows.map((row) => [
      row.student_name,
      row.book_title,
      row.book_isbn,
      row.status,
      row.borrow_date,
      row.due_date,
      row.return_date,
    ]);

    autoTable(doc, {
      head: headers,
      body,
      startY: cursorY,
      styles: { fontSize: 8 },
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
      margin: { left: margin, right: margin },
    });

    const suffix = activeType === 'history' ? scope : activeType;
    doc.save(`library-report-${suffix}.pdf`);
  };

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Reports & Downloads</h3>
          <p className="text-xs text-slate-400 mt-1">
            Export borrower history by student, book, or overall library activity.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Loading report data...</p>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-4">
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Report Type</label>
                <select
                  value={reportType}
                  onChange={(event) => setReportType(event.target.value)}
                  className="field"
                >
                  <option value="history">History Report</option>
                  <option value="student_profile">Student Profile</option>
                  <option value="book_profile">Book Summary</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Scope</label>
                <select
                  value={scope}
                  onChange={(event) => setScope(event.target.value)}
                  className="field"
                >
                  <option value="overall">Overall Library</option>
                  <option value="student">By Student</option>
                  <option value="book">By Book</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Status</label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="field"
                >
                  <option value="all">All Statuses</option>
                  <option value="Borrowed">Borrowed</option>
                  <option value="Returned">Returned</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Reserved">Reserved</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Date Range</label>
                <select
                  value={range}
                  onChange={(event) => setRange(event.target.value)}
                  className="field"
                >
                  <option value="all">All Time</option>
                  <option value="7">Last 7 Days</option>
                  <option value="30">Last 30 Days</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            {range === 'custom' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="field"
                />
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="field"
                />
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Student</label>
                <select
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  className="field"
                >
                  <option value="">All Students</option>
                  {students.map((student) => (
                    <option key={student._id} value={student._id}>
                      {student.name} ({student.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-slate-400">Book</label>
                <select
                  value={bookId}
                  onChange={(event) => setBookId(event.target.value)}
                  className="field"
                >
                  <option value="">All Books</option>
                  {books.map((book) => (
                    <option key={book._id} value={book._id}>
                      {book.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setDownloadOpen((prev) => !prev)}
                  className="rounded-xl bg-slate-900/70 border border-white/10 px-4 py-2 text-sm hover:bg-slate-900/90 flex items-center gap-2"
                >
                  Download Actions
                  <ChevronDown size={14} />
                </button>

                {downloadOpen ? (
                  <div className="absolute mt-2 w-56 rounded-2xl border border-white/10 bg-slate-950/90 shadow-xl p-2 z-10">
                    <button
                      onClick={() => {
                        handleDownloadCsv();
                        setDownloadOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs text-slate-200 hover:bg-slate-900/80"
                    >
                      Download CSV
                      <Download size={14} />
                    </button>
                    <button
                      onClick={() => {
                        handleDownloadJson();
                        setDownloadOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs text-slate-200 hover:bg-slate-900/80"
                    >
                      Download JSON
                      <FileText size={14} />
                    </button>
                    <button
                      onClick={() => {
                        handleDownloadPdf();
                        setDownloadOpen(false);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs text-slate-200 hover:bg-slate-900/80"
                    >
                      Download PDF
                      <FileDown size={14} />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {downloadError ? <p className="text-xs text-rose-300">{downloadError}</p> : null}

            <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300 space-y-2">
              <p className="text-slate-200 font-medium">Quick Actions</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setReportType('history');
                    handleDownloadPdf('history');
                  }}
                  className="rounded-lg border border-white/10 px-3 py-1 hover:bg-slate-900/80"
                >
                  Overall PDF
                </button>
                <button
                  onClick={() => {
                    setReportType('student_profile');
                    handleDownloadPdf('student_profile');
                  }}
                  className="rounded-lg border border-white/10 px-3 py-1 hover:bg-slate-900/80"
                >
                  Student Profile PDF
                </button>
                <button
                  onClick={() => {
                    setReportType('book_profile');
                    handleDownloadPdf('book_profile');
                  }}
                  className="rounded-lg border border-white/10 px-3 py-1 hover:bg-slate-900/80"
                >
                  Book Summary PDF
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Select a student or book before using profile exports.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 space-y-3 text-sm text-slate-300">
            <div className="flex items-center gap-2 text-slate-200">
              <Filter size={14} />
              <span>Report Summary</span>
            </div>
            <p>Total records: {reportRows.length}</p>
            <p>Borrowed: {reportStats.Borrowed}</p>
            <p>Returned: {reportStats.Returned}</p>
            <p>Overdue: {reportStats.Overdue}</p>
            <p>Reserved: {reportStats.Reserved}</p>
            <p>
              Scope:{' '}
              {scope === 'overall' ? 'Overall' : scope === 'student' ? 'Student' : 'Book'}
            </p>
            <p>Status filter: {statusFilter === 'all' ? 'All' : statusFilter}</p>
            <p>
              Range:{' '}
              {range === 'all'
                ? 'All time'
                : range === '7'
                  ? 'Last 7 days'
                  : range === '30'
                    ? 'Last 30 days'
                    : 'Custom'}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
