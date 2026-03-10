import { useEffect, useState } from 'react';
import { Database, RefreshCw } from 'lucide-react';

import LoadingState from '../../components/LoadingState';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import { checkDatabaseConnection, getDatabaseStatus } from '../../services/api';

export default function DatabaseMonitorPage() {
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState({
    database_connected: false,
    message: '',
    total_users: 0,
    total_books: 0,
    total_borrow_records: 0,
  });
  const [error, setError] = useState('');

  const loadStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await getDatabaseStatus();
      setStatus(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Failed to fetch database status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const checkConnection = async () => {
    setChecking(true);
    setError('');
    try {
      const response = await checkDatabaseConnection();
      setStatus(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Connection check failed');
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return <LoadingState label="Checking Firestore status..." />;
  }

  return (
    <div>
      <PageHeader title="Database Monitor" subtitle="Firestore health and collection counters." />

      {error ? <p className="text-rose-300 text-sm mb-4">{error}</p> : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Users" value={status.total_users} icon={Database} tone="cyan" />
        <StatCard title="Total Books" value={status.total_books} icon={Database} tone="indigo" />
        <StatCard title="Borrow Records" value={status.total_borrow_records} icon={Database} tone="emerald" />
      </div>

      <section className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Firestore Connection Status</p>
            <p className={`text-lg font-semibold ${status.database_connected ? 'text-emerald-300' : 'text-rose-300'}`}>
              {status.message}
            </p>
          </div>
          <button
            onClick={checkConnection}
            disabled={checking}
            className="rounded-xl px-4 py-2 text-sm bg-cyan-500/20 border border-cyan-300/30 hover:bg-cyan-500/30 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
            Check Firestore Connection
          </button>
        </div>
      </section>
    </div>
  );
}
