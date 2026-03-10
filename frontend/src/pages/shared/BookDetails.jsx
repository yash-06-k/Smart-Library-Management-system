import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import QRCode from 'qrcode';

import LoadingState from '../../components/LoadingState';
import PageHeader from '../../components/PageHeader';
import BookCover from '../../components/BookCover';
import { getBookById } from '../../services/api';

export default function BookDetailsPage() {
  const { bookId } = useParams();
  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState(null);
  const [qrUrl, setQrUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getBookById(bookId);
        if (mounted) {
          setBook(response.data);
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError.response?.data?.detail || 'Book not found');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (bookId) {
      load();
    }

    return () => {
      mounted = false;
    };
  }, [bookId]);

  useEffect(() => {
    let active = true;

    const buildQr = async () => {
      if (!book?._id) {
        setQrUrl('');
        return;
      }
      try {
        const url = await QRCode.toDataURL(book._id, { margin: 1, width: 240 });
        if (active) {
          setQrUrl(url);
        }
      } catch {
        if (active) {
          setQrUrl('');
        }
      }
    };

    buildQr();

    return () => {
      active = false;
    };
  }, [book]);

  if (loading) {
    return <LoadingState label="Loading book details..." />;
  }

  if (error || !book) {
    return (
      <div>
        <PageHeader title="Book Details" subtitle="Unable to load this book." />
        <p className="text-rose-300 text-sm">{error || 'Book not found.'}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={book.title} subtitle={`by ${book.author}`} />

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap gap-4">
            <BookCover
              src={book.cover_image}
              title={book.title}
              author={book.author}
              className="w-32 h-40 rounded-2xl"
            />
            <div className="flex-1 min-w-[220px] space-y-3">
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="px-2 py-1 rounded-full bg-cyan-500/20 border border-cyan-300/30">{book.category}</span>
            <span className="px-2 py-1 rounded-full bg-slate-900/70 border border-white/10">
              Status: {book.availability_status || 'Unknown'}
            </span>
            <span className="px-2 py-1 rounded-full bg-slate-900/70 border border-white/10">
              Rack: {book.rack_location || 'Not set'}
            </span>
          </div>

          <p className="text-sm text-slate-300">{book.description || 'No description available.'}</p>

          <div className="text-xs text-slate-400 space-y-1">
            <p>ISBN: {book.isbn}</p>
            <p>Available: {book.available_copies} / Total: {book.total_copies}</p>
            <p>Issued: {book.issued_count ?? 0} | Reserved: {book.reserved_count ?? 0}</p>
          </div>
            </div>
          </div>
        </section>

        <aside className="glass-card rounded-2xl p-5 flex flex-col items-center gap-4">
          <h3 className="text-white font-semibold">Book QR Code</h3>
          {qrUrl ? (
            <img src={qrUrl} alt="Book QR code" className="w-56 h-56 rounded-xl border border-white/10 bg-white p-3" />
          ) : (
            <div className="w-56 h-56 rounded-xl border border-white/10 bg-slate-900/70 flex items-center justify-center text-xs text-slate-400">
              QR not available
            </div>
          )}
          <p className="text-xs text-slate-400 text-center">
            Scan this QR code to open this book profile instantly.
          </p>
        </aside>
      </div>
    </div>
  );
}
