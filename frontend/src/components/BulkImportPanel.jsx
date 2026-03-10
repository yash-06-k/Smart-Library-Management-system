import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { UploadCloud } from 'lucide-react';

import { bulkCreateBooks, getBooks } from '../services/api';

const headerAliases = {
  title: ['title', 'book title', 'name'],
  author: ['author', 'writer'],
  category: ['category', 'genre'],
  isbn: ['isbn', 'isbn-13', 'isbn13', 'isbn10'],
  description: ['description', 'summary'],
  rack_location: ['rack', 'rack location', 'shelf', 'location'],
  total_copies: ['total copies', 'total', 'copies', 'quantity'],
  available_copies: ['available copies', 'available', 'available qty'],
  cover_image: ['cover', 'cover image', 'image', 'image url', 'cover url'],
};

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

GlobalWorkerOptions.workerSrc = pdfWorker;

const pickValue = (row, aliases) => {
  const keys = Object.keys(row);
  const normalized = keys.reduce((acc, key) => {
    acc[normalizeKey(key)] = key;
    return acc;
  }, {});

  for (const alias of aliases) {
    const actual = normalized[normalizeKey(alias)];
    if (actual) {
      return row[actual];
    }
  }

  return '';
};

const coerceNumber = (value, fallback) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const buildBookFromRow = (row) => {
  const title = String(pickValue(row, headerAliases.title) || '').trim();
  const author = String(pickValue(row, headerAliases.author) || '').trim();
  const category = String(pickValue(row, headerAliases.category) || '').trim();
  const isbn = String(pickValue(row, headerAliases.isbn) || '').trim();
  const description = String(pickValue(row, headerAliases.description) || '').trim();
  const rackLocation = String(pickValue(row, headerAliases.rack_location) || '').trim();
  const totalCopies = coerceNumber(pickValue(row, headerAliases.total_copies), 1);
  const availableCopies = coerceNumber(pickValue(row, headerAliases.available_copies), totalCopies);
  const coverImage = String(pickValue(row, headerAliases.cover_image) || '').trim();

  return {
    title,
    author,
    category,
    isbn,
    description,
    rack_location: rackLocation || null,
    total_copies: Math.max(1, Math.floor(totalCopies || 1)),
    available_copies: Math.max(0, Math.floor(availableCopies || 0)),
    cover_image: coverImage || null,
  };
};

const parseDelimitedLines = (text) => {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const books = [];

  lines.forEach((line) => {
    const lower = line.toLowerCase();
    if (lower.includes('title') && lower.includes('isbn')) {
      return;
    }
    const delimiter = line.includes('|') ? '|' : line.includes(',') ? ',' : null;
    if (!delimiter) {
      return;
    }

    const parts = line.split(delimiter).map((part) => part.trim());
    if (parts.length < 4) {
      return;
    }

    const [
      title,
      author,
      category,
      isbn,
      description,
      rackLocation,
      totalCopies,
      availableCopies,
      coverImage,
    ] = parts;

    books.push({
      title: title || '',
      author: author || '',
      category: category || '',
      isbn: isbn || '',
      description: description || '',
      rack_location: rackLocation || null,
      total_copies: coerceNumber(totalCopies, 1),
      available_copies: coerceNumber(availableCopies, coerceNumber(totalCopies, 1)),
      cover_image: coverImage || null,
    });
  });

  return books;
};

export default function BulkImportPanel({ onImportComplete }) {
  const [existingIsbns, setExistingIsbns] = useState(new Set());
  const [fileName, setFileName] = useState('');
  const [parsedBooks, setParsedBooks] = useState([]);
  const [parseError, setParseError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    let mounted = true;
    const loadExisting = async () => {
      try {
        const response = await getBooks();
        if (!mounted) {
          return;
        }
        const isbnSet = new Set((response.data || []).map((book) => String(book.isbn || '').trim()));
        setExistingIsbns(isbnSet);
      } catch {
        if (mounted) {
          setExistingIsbns(new Set());
        }
      }
    };
    loadExisting();
    return () => {
      mounted = false;
    };
  }, []);

  const duplicatesInFile = useMemo(() => {
    const seen = new Set();
    const duplicates = new Set();
    parsedBooks.forEach((book) => {
      if (!book.isbn) {
        return;
      }
      if (seen.has(book.isbn)) {
        duplicates.add(book.isbn);
      }
      seen.add(book.isbn);
    });
    return duplicates;
  }, [parsedBooks]);

  const duplicatesInDatabase = useMemo(() => {
    return new Set(parsedBooks.filter((book) => book.isbn && existingIsbns.has(book.isbn)).map((book) => book.isbn));
  }, [parsedBooks, existingIsbns]);

  const validBooks = useMemo(() => {
    return parsedBooks.filter((book) => book.title && book.author && book.category && book.isbn);
  }, [parsedBooks]);

  const importableBooks = useMemo(() => {
    return validBooks.filter((book) => !duplicatesInFile.has(book.isbn) && !duplicatesInDatabase.has(book.isbn));
  }, [validBooks, duplicatesInFile, duplicatesInDatabase]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setFileName(file.name);
    setParseError('');
    setImportResult(null);
    setParsedBooks([]);

    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const buffer = await file.arrayBuffer();
        const pdf = await getDocument({ data: buffer }).promise;
        let text = '';
        for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
          const page = await pdf.getPage(pageIndex);
          const content = await page.getTextContent();
          let currentY = null;
          let line = '';
          const lines = [];

          content.items.forEach((item) => {
            const y = item.transform?.[5];
            if (currentY === null || Math.abs(y - currentY) > 2) {
              if (line) {
                lines.push(line.trim());
              }
              line = item.str;
              currentY = y;
            } else {
              line = `${line} ${item.str}`.trim();
            }
          });

          if (line) {
            lines.push(line.trim());
          }

          text += `${lines.join('\n')}\n`;
        }
        const parsed = parseDelimitedLines(text);
        if (parsed.length === 0) {
          throw new Error('PDF format not recognized. Use comma or | separated columns.');
        }
        setParsedBooks(parsed);
        return;
      }

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const normalized = rawRows.map(buildBookFromRow);
      setParsedBooks(normalized);
    } catch (err) {
      setParseError(err?.message || 'Unable to parse this file.');
    }
  };

  const handleImport = async () => {
    setUploading(true);
    setParseError('');
    setImportResult(null);
    try {
      const response = await bulkCreateBooks({ books: importableBooks });
      setImportResult(response.data);
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      setParseError(err?.response?.data?.detail || 'Import failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Bulk Import Books</h3>
          <p className="text-xs text-slate-400 mt-1">
            Upload Excel (.xlsx), CSV, or text-based PDF with columns: title, author, category, isbn, description,
            rack_location, total_copies, available_copies, cover_image.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-slate-900/70 text-xs text-slate-200 cursor-pointer hover:bg-slate-800/70">
          <UploadCloud size={16} />
          <span>{fileName ? 'Replace file' : 'Choose file'}</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      </div>

      {parseError ? <p className="text-rose-300 text-sm">{parseError}</p> : null}

      {parsedBooks.length > 0 ? (
        <div className="space-y-3 text-sm text-slate-300">
          <div className="flex flex-wrap gap-3">
            <span className="px-3 py-1 rounded-full bg-slate-900/70 border border-white/10">
              Rows parsed: {parsedBooks.length}
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-300/20 text-emerald-200">
              Ready to import: {importableBooks.length}
            </span>
            {duplicatesInFile.size > 0 ? (
              <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-300/20 text-amber-200">
                Duplicates in file: {duplicatesInFile.size}
              </span>
            ) : null}
            {duplicatesInDatabase.size > 0 ? (
              <span className="px-3 py-1 rounded-full bg-rose-500/10 border border-rose-300/20 text-rose-200">
                Existing ISBNs: {duplicatesInDatabase.size}
              </span>
            ) : null}
          </div>

          <div className="max-h-48 overflow-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-slate-900/70 text-slate-400">
                <tr>
                  <th className="text-left px-3 py-2">Title</th>
                  <th className="text-left px-3 py-2">Author</th>
                  <th className="text-left px-3 py-2">ISBN</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {parsedBooks.slice(0, 6).map((book, index) => {
                  const duplicateFile = duplicatesInFile.has(book.isbn);
                  const duplicateDb = duplicatesInDatabase.has(book.isbn);
                  const invalid = !book.title || !book.author || !book.category || !book.isbn;
                  const status = invalid
                    ? 'Missing fields'
                    : duplicateFile
                      ? 'Duplicate in file'
                      : duplicateDb
                        ? 'Already exists'
                        : 'Ready';
                  return (
                    <tr key={`${book.isbn}-${index}`} className="border-t border-white/10">
                      <td className="px-3 py-2 text-white">{book.title || '-'}</td>
                      <td className="px-3 py-2 text-slate-300">{book.author || '-'}</td>
                      <td className="px-3 py-2 text-slate-300">{book.isbn || '-'}</td>
                      <td className="px-3 py-2 text-slate-300">{status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={uploading || importableBooks.length === 0}
            className="px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-300/30 text-sm hover:bg-indigo-500/30 disabled:opacity-50"
          >
            {uploading ? 'Importing...' : 'Import Books'}
          </button>
        </div>
      ) : null}

      {importResult ? (
        <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-sm text-cyan-100">
          Imported {importResult.created_count} books. Skipped {importResult.skipped_count}.
        </div>
      ) : null}
    </section>
  );
}
