export default function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="min-h-[300px] flex items-center justify-center">
      <div className="flex items-center gap-3 text-slate-300">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  );
}