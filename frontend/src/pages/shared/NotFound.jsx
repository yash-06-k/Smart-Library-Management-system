import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-app-gradient flex items-center justify-center px-4">
      <div className="glass-card rounded-2xl p-6 text-center max-w-md">
        <h1 className="text-2xl text-white font-semibold">Page Not Found</h1>
        <p className="text-sm text-slate-400 mt-2">The route does not exist.</p>
        <Link to="/" className="inline-block mt-4 text-cyan-300 hover:underline">Go to dashboard</Link>
      </div>
    </div>
  );
}