import { motion } from 'framer-motion';

export default function PageHeader({ title, subtitle }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mb-6"
    >
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">{title}</h1>
      {subtitle ? <p className="text-sm mt-1 text-slate-400">{subtitle}</p> : null}
    </motion.div>
  );
}