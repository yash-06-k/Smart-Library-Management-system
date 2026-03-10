import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Mail, Sparkles, LogIn, ChevronRight, Library } from 'lucide-react';

import { auth } from '../../firebase';
import { loginUser } from '../../services/api';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const credential = await signInWithEmailAndPassword(auth, form.email, form.password);
      try {
        await loginUser({
          firebase_uid: credential.user.uid,
          email: credential.user.email,
        });
      } catch (e) {
        console.warn("Backend sync failed during login, proceeding to fallback UI:", e);
      }
      navigate('/');
    } catch (requestError) {
      if (requestError.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else {
        setError(requestError.response?.data?.detail || requestError.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-gradient flex items-center justify-center px-4 overflow-hidden relative">
      <div className="absolute inset-0 bg-slate-950/70 z-0" />

      {/* Background Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px] z-0 pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] z-0 pointer-events-none"
      />

      <div className="relative z-10 w-full max-w-[1000px] grid md:grid-cols-2 gap-8 items-center">

        {/* Left column / Hero text */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="hidden md:flex flex-col justify-center text-left pr-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-400/30">
              <Library className="w-8 h-8 text-indigo-300" />
            </div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-cyan-300">
              SmartLib SaaS
            </h1>
          </div>
          <h2 className="text-5xl font-extrabold text-white leading-tight mb-4 tracking-tight">
            The Future of <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
              Library Management
            </span>
          </h2>
          <p className="text-lg text-slate-400 mb-8 leading-relaxed">
            Experience AI-driven insights, seamless borrowing, and a stunning digital bookshelf specifically crafted to enhance the reading experience.
          </p>

          <div className="flex items-center gap-4 text-sm text-slate-400 font-medium">
            <div className="flex -space-x-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center object-cover overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`} alt="user" />
                </div>
              ))}
            </div>
            <p>Join 10,000+ students & librarians</p>
          </div>
        </motion.div>

        {/* Right column / Auth Form */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="glass-card rounded-[2rem] p-8 md:p-10 shadow-2xl relative overflow-hidden group border border-white/5"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-400/10 rounded-full blur-[80px] -mr-32 -mt-32 transition-opacity duration-500 opacity-50 group-hover:opacity-100 pointer-events-none" />

          <div className="relative z-10">
            <div className="mb-8">
              <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Welcome Back</h2>
              <p className="text-slate-400 text-sm">Sign in to your account to continue</p>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -10, height: 0 }}
                  className="bg-rose-500/10 border border-rose-500/20 text-rose-300 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2 overflow-hidden"
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <p>{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-cyan-400 transition-colors">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="Email address"
                    className="w-full bg-slate-800/50 border border-slate-700 focus:border-cyan-400/50 rounded-2xl pl-12 pr-4 py-3.5 text-slate-200 outline-none transition-all focus:ring-4 focus:ring-cyan-500/10 placeholder-slate-500"
                    required
                  />
                </div>

                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-indigo-400 transition-colors">
                    <Key className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Password"
                    className="w-full bg-slate-800/50 border border-slate-700 focus:border-indigo-400/50 rounded-2xl pl-12 pr-4 py-3.5 text-slate-200 outline-none transition-all focus:ring-4 focus:ring-indigo-500/10 placeholder-slate-500"
                    required
                  />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading}
                type="submit"
                className="w-full relative group overflow-hidden bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold py-3.5 px-4 rounded-2xl shadow-lg disabled:opacity-70 disabled:cursor-not-allowed transition-all mt-6"
              >
                <div className="absolute inset-0 w-full h-full bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative flex items-center justify-center gap-2">
                  {loading ? (
                    'Authenticating...'
                  ) : (
                    <>
                      Sign In to Dashboard
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </motion.button>
            </form>

            <div className="mt-8 text-center border-t border-slate-800/60 pt-6">
              <p className="text-slate-400 text-sm flex items-center justify-center gap-2">
                Don't have an account?
                <Link to="/signup" className="text-cyan-400 font-medium hover:text-cyan-300 inline-flex items-center gap-1 group/link">
                  Sign up free
                  <LogIn className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform" />
                </Link>
              </p>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}