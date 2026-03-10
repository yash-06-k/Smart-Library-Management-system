import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Key, Mail, Sparkles, LogIn, ChevronRight, Library, Shield } from 'lucide-react';

import { auth } from '../../firebase';
import { signupUser } from '../../services/api';

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    if (form.password.length < 6) {
      setError('Password should be at least 6 characters.');
      setLoading(false);
      return;
    }

    try {
      const credential = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await updateProfile(credential.user, { displayName: form.name });

      try {
        await signupUser({
          name: form.name,
          email: form.email,
          role: form.role,
          firebase_uid: credential.user.uid,
        });
      } catch (e) {
        console.warn("Backend sync failed during signup:", e);
      }

      navigate('/');
    } catch (requestError) {
      if (requestError.code === 'auth/email-already-in-use') {
        setError('Email is already registered.');
      } else {
        setError(requestError.response?.data?.detail || requestError.message || 'Signup failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-gradient flex items-center justify-center px-4 py-12 overflow-hidden relative">
      <div className="absolute inset-0 bg-slate-950/70 z-0" />

      {/* Background Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] z-0 pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px] z-0 pointer-events-none"
      />

      <div className="relative z-10 w-full max-w-[1000px] grid md:grid-cols-2 gap-8 items-center">

        {/* Left column / Hero text - reversed for variety */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="hidden md:flex flex-col justify-center text-left pr-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-cyan-500/20 rounded-2xl border border-cyan-400/30">
              <Sparkles className="w-8 h-8 text-cyan-300" />
            </div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 to-indigo-300">
              Join SmartLib
            </h1>
          </div>
          <h2 className="text-5xl font-extrabold text-white leading-tight mb-4 tracking-tight">
            Unlock the World <br />
            of <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Knowledge</span>
          </h2>
          <p className="text-lg text-slate-400 mb-8 leading-relaxed">
            Create an account to track your reading history, reserve upcoming books, and chat with our powerful AI librarian.
          </p>

          <div className="flex flex-col gap-4 text-sm text-slate-300 p-6 bg-slate-900/50 border border-white/5 rounded-2xl glass-card">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-cyan-400" />
              </div>
              <span>End-to-end encrypted security</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <Library className="w-4 h-4 text-indigo-400" />
              </div>
              <span>Access to 50,000+ digital editions</span>
            </div>
          </div>
        </motion.div>

        {/* Right column / Auth Form */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="glass-card rounded-[2rem] p-8 md:p-10 shadow-2xl relative overflow-hidden group border border-white/5"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-400/10 rounded-full blur-[80px] -mr-32 -mt-32 transition-opacity duration-500 opacity-50 group-hover:opacity-100 pointer-events-none" />

          <div className="relative z-10">
            <div className="mb-8">
              <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Create Account</h2>
              <p className="text-slate-400 text-sm">Register as a student or librarian admin</p>
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-cyan-400 transition-colors">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Full name"
                  className="w-full bg-slate-800/50 border border-slate-700 focus:border-cyan-400/50 rounded-2xl pl-12 pr-4 py-3.5 text-slate-200 outline-none transition-all focus:ring-4 focus:ring-cyan-500/10 placeholder-slate-500"
                  required
                />
              </div>

              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-indigo-400 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Email address"
                  className="w-full bg-slate-800/50 border border-slate-700 focus:border-indigo-400/50 rounded-2xl pl-12 pr-4 py-3.5 text-slate-200 outline-none transition-all focus:ring-4 focus:ring-indigo-500/10 placeholder-slate-500"
                  required
                />
              </div>

              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-cyan-400 transition-colors">
                  <Key className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Password (min 6 chars)"
                  className="w-full bg-slate-800/50 border border-slate-700 focus:border-cyan-400/50 rounded-2xl pl-12 pr-4 py-3.5 text-slate-200 outline-none transition-all focus:ring-4 focus:ring-cyan-500/10 placeholder-slate-500"
                  required
                />
              </div>

              <div className="relative group/select">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within/select:text-indigo-400 transition-colors">
                  <Shield className="w-5 h-5" />
                </div>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full appearance-none bg-slate-800/50 border border-slate-700 focus:border-indigo-400/50 rounded-2xl pl-12 pr-10 py-3.5 text-slate-200 outline-none transition-all focus:ring-4 focus:ring-indigo-500/10 cursor-pointer"
                >
                  <option value="student">Student Account</option>
                  <option value="librarian">Librarian (Admin Panel)</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-500">
                  <ChevronRight className="w-5 h-5 rotate-90" />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading}
                type="submit"
                className="w-full relative group overflow-hidden bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-semibold py-3.5 px-4 rounded-2xl shadow-lg disabled:opacity-70 disabled:cursor-not-allowed transition-all mt-4"
              >
                <div className="absolute inset-0 w-full h-full bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative flex items-center justify-center gap-2">
                  {loading ? (
                    'Creating Account...'
                  ) : (
                    <>
                      Sign Up Now
                      <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </motion.button>
            </form>

            <div className="mt-6 text-center border-t border-slate-800/60 pt-6">
              <p className="text-slate-400 text-sm flex items-center justify-center gap-2">
                Already registered?
                <Link to="/login" className="text-indigo-400 font-medium hover:text-indigo-300 inline-flex items-center gap-1 group/link">
                  Sign in instead
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
