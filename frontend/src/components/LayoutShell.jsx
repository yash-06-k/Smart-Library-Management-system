import { motion } from 'framer-motion';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function LayoutShell({ user, navItems, onLogout, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-app-gradient text-slate-100">
      <div className="min-h-screen bg-slate-950/65 backdrop-blur-sm">
        <div className="mx-auto max-w-[1500px] px-4 py-4 lg:px-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
            <aside className="glass-card rounded-3xl p-5 h-[calc(100vh-2rem)] sticky top-4 flex flex-col">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-3 text-left mb-8"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-500 shadow-lg shadow-cyan-500/20" />
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
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                        active
                          ? 'bg-indigo-500/25 border border-indigo-400/30 text-white'
                          : 'hover:bg-slate-900/60 text-slate-300 border border-transparent'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="text-sm">{item.label}</span>
                    </motion.button>
                  );
                })}
              </nav>

              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-cyan-300 capitalize">{user.role}</p>
                  </div>
                  <button
                    onClick={() => setDarkMode((prev) => !prev)}
                    className="p-2 rounded-lg bg-slate-900/60 hover:bg-slate-800"
                    title="Toggle theme"
                  >
                    {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                  </button>
                </div>
                <button
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 hover:bg-rose-500/20 py-2 text-sm"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            </aside>

            <main className="min-h-[calc(100vh-2rem)] glass-card rounded-3xl p-4 sm:p-6 lg:p-8 overflow-hidden">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
