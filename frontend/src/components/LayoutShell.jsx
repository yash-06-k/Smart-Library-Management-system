import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Moon, Sun, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function LayoutShell({ user, navItems, onLogout, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('app-theme') !== 'light';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('app-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const sidebarContent = (
    <>
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-3 text-left mb-8"
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-500 shadow-lg shadow-cyan-500/20 flex-shrink-0" />
        <div>
          <p className="text-xl font-semibold tracking-tight">Smart Library</p>
          <p className="text-xs text-slate-400">SaaS Control Plane</p>
        </div>
      </button>

      <nav className="space-y-2 flex-1 overflow-auto pr-1">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <motion.button
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.99 }}
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition min-h-[44px] ${
                active
                  ? 'bg-indigo-500/25 border border-indigo-400/30 text-white'
                  : 'hover:bg-slate-900/60 text-slate-300 border border-transparent'
              }`}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className="text-sm">{item.label}</span>
            </motion.button>
          );
        })}
      </nav>

      <div className="mt-4 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-cyan-300 capitalize truncate">{user.role}</p>
          </div>
          <button
            onClick={() => setDarkMode((prev) => !prev)}
            className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 flex-shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
            title="Toggle theme"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 hover:bg-rose-500/20 py-2 text-sm min-h-[44px]"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-app-gradient text-slate-100">
      <div className="min-h-screen bg-slate-950/65 backdrop-blur-sm">
        <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-4 sm:py-4 lg:px-6">
          {/* Desktop Layout */}
          <div className="hidden lg:grid grid-cols-[280px_1fr] gap-4">
            <aside className="glass-card rounded-3xl p-5 h-[calc(100vh-2rem)] sticky top-4 flex flex-col">
              {sidebarContent}
            </aside>

            <main className="min-h-[calc(100vh-2rem)] glass-card rounded-3xl p-4 sm:p-6 lg:p-8 overflow-auto">
              {children}
            </main>
          </div>

          {/* Mobile & Tablet Layout */}
          <div className="lg:hidden">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 shadow-lg shadow-cyan-500/20" />
                <div className="hidden xs:block">
                  <p className="text-sm font-semibold tracking-tight">Smart Library</p>
                  <p className="text-xs text-slate-400 hidden sm:block">SaaS</p>
                </div>
              </button>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>

            {/* Mobile Sidebar */}
            <AnimatePresence>
              {mobileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="glass-card rounded-2xl p-4 mb-4"
                >
                  {sidebarContent}
                </motion.div>
              )}
            </AnimatePresence>

            <main className="glass-card rounded-2xl p-4 sm:p-6 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
