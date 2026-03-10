import { useEffect, useMemo, useState } from 'react';

import { cn } from '../lib/utils';

const GRADIENTS = [
  'bg-gradient-to-br from-amber-500/30 via-slate-900/80 to-rose-500/30',
  'bg-gradient-to-br from-cyan-500/30 via-slate-900/80 to-indigo-500/30',
  'bg-gradient-to-br from-emerald-500/30 via-slate-900/80 to-teal-500/30',
  'bg-gradient-to-br from-fuchsia-500/30 via-slate-900/80 to-purple-500/30',
  'bg-gradient-to-br from-orange-500/30 via-slate-900/80 to-yellow-500/30',
  'bg-gradient-to-br from-sky-500/30 via-slate-900/80 to-blue-500/30',
];

const hashText = (value) => {
  if (!value) return 0;
  return value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
};

const getInitials = (title, author) => {
  const source = (title || author || 'Book').trim();
  if (!source) return 'BK';
  const words = source.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

export default function BookCover({
  src,
  title,
  author,
  className,
  imgClassName,
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const initials = useMemo(() => getInitials(title, author), [title, author]);
  const gradient = useMemo(() => {
    const index = Math.abs(hashText(`${title || ''}${author || ''}`)) % GRADIENTS.length;
    return GRADIENTS[index];
  }, [title, author]);

  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-white/10 bg-slate-900/80',
        className
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt={title || 'Book cover'}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={cn('w-full h-full object-cover', imgClassName)}
        />
      ) : (
        <div
          className={cn(
            'w-full h-full flex flex-col items-center justify-center text-xs text-slate-200',
            gradient
          )}
        >
          <div className="text-sm font-semibold tracking-wide">{initials}</div>
          <div className="text-[10px] uppercase text-white/70">No cover</div>
        </div>
      )}
    </div>
  );
}
