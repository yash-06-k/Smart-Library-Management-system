import { useEffect, useState } from 'react';

import PageHeader from '../../components/PageHeader';
import { getBooks } from '../../services/api';

export default function WishlistPage() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await getBooks();
        if (!mounted) {
          return;
        }

        const uniqueCategories = [...new Set(response.data.map((book) => book.category))].filter(Boolean);
        setCategories(uniqueCategories.slice(0, 8));
      } catch (error) {
        if (mounted) {
          setCategories([]);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div>
      <PageHeader title="Wishlist" subtitle="Pin your favorite categories and keep reading goals visible." />
      <div className="glass-card rounded-2xl p-6">
        {categories.length === 0 ? (
          <p className="text-sm text-slate-400">Browse books to build your wishlist.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <span key={category} className="text-sm px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-300/30">
                {category}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}