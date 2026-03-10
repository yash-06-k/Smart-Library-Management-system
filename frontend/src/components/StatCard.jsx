import { motion } from 'framer-motion';
import AnimatedCounter from './AnimatedCounter';

export default function StatCard({ title, value, icon: Icon, tone = 'indigo', delay = 0 }) {
  const toneClassMap = {
    indigo: 'from-indigo-500/20 to-indigo-500/5 text-indigo-300 border-indigo-400/20',
    emerald: 'from-emerald-500/20 to-emerald-500/5 text-emerald-300 border-emerald-400/20',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-300 border-amber-400/20',
    rose: 'from-rose-500/20 to-rose-500/5 text-rose-300 border-rose-400/20',
    cyan: 'from-cyan-500/20 to-cyan-500/5 text-cyan-300 border-cyan-400/20',
  };

  const toneClasses = toneClassMap[tone] || toneClassMap.indigo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      whileHover={{ y: -4 }}
      className="glass-card p-5 rounded-2xl"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs tracking-wide uppercase text-slate-400">{title}</p>
          <p className="text-3xl font-semibold mt-2 text-white">
            <AnimatedCounter value={value} />
          </p>
        </div>
        <div className={`w-12 h-12 rounded-xl border bg-gradient-to-br ${toneClasses} flex items-center justify-center`}>
          <Icon size={22} />
        </div>
      </div>
    </motion.div>
  );
}