import { useEffect, useState } from 'react';

import LoadingState from '../../components/LoadingState';
import PageHeader from '../../components/PageHeader';
import { getUsers } from '../../services/api';

export default function StudentsPage() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await getUsers({ role: 'student' });
        if (mounted) {
          setStudents(response.data);
        }
      } catch (requestError) {
        if (mounted) {
          setError(requestError.response?.data?.detail || 'Failed to load students');
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
    return <LoadingState label="Loading students..." />;
  }

  return (
    <div>
      <PageHeader title="Students" subtitle="Student user list from Firestore users collection." />

      {error ? <p className="text-rose-300 text-sm mb-4">{error}</p> : null}

      <div className="glass-card rounded-2xl overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/70 text-slate-300">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-slate-400" colSpan={4}>No students found.</td>
              </tr>
            ) : (
              students.map((student) => (
                <tr key={student._id} className="border-t border-white/10">
                  <td className="px-4 py-3 text-white">{student.name}</td>
                  <td className="px-4 py-3 text-slate-300">{student.email}</td>
                  <td className="px-4 py-3 text-slate-300 capitalize">{student.role}</td>
                  <td className="px-4 py-3 text-slate-300">{new Date(student.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
