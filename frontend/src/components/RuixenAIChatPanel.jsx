import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpIcon,
  BookOpen,
  CircleUserRound,
  Layers,
  Palette,
  Rocket,
  Sparkles,
} from 'lucide-react';

import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { askChatbot } from '../services/api';

const QUICK_ACTIONS = [
  { label: 'Recommend fiction', icon: BookOpen, prompt: 'Suggest fiction books available now.' },
  { label: 'Study focus', icon: Layers, prompt: 'Help me build a 4-week study plan.' },
  { label: 'Project ideas', icon: Rocket, prompt: 'Suggest project books for capstone topics.' },
  { label: 'Theme picks', icon: Palette, prompt: 'Recommend books for UI/UX and design.' },
  { label: 'Student help', icon: CircleUserRound, prompt: 'What should a student read next?' },
];

const CAPABILITIES = [
  {
    title: 'Smart Recommendations',
    description: 'Borrow history aware picks ranked by relevance and availability.',
  },
  {
    title: 'Learning Paths',
    description: 'Beginner to advanced steps with book milestones.',
  },
  {
    title: 'Semantic Search',
    description: 'Understands meaning beyond keywords for better discovery.',
  },
];

const COMMANDS = [
  'Suggest AI books',
  'Find Python books',
  'Popular books in programming',
  'Beginner machine learning books',
  'What should I read next?',
];

function useAutoResizeTextarea({ minHeight, maxHeight }) {
  const textareaRef = useRef(null);

  const adjustHeight = useCallback(
    (reset) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Infinity)
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight]
  );

  useEffect(() => {
    if (textareaRef.current) textareaRef.current.style.height = `${minHeight}px`;
  }, [minHeight]);

  return { textareaRef, adjustHeight };
}

export default function RuixenAIChatPanel({ title = 'Smart Library AI' }) {
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 52,
    maxHeight: 170,
  });

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending) {
      return;
    }

    const nextHistory = [...history, { role: 'user', content: trimmed }];
    setHistory(nextHistory);
    setMessage('');
    adjustHeight(true);
    setSending(true);
    setError('');

    try {
      const response = await askChatbot({
        message: trimmed,
        history: nextHistory,
      });

      setHistory((prev) => [
        ...prev,
        { role: 'assistant', content: response.data.response || 'No response generated.' },
      ]);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Chatbot request failed.');
    } finally {
      setSending(false);
    }
  };

  const handleQuickAction = (prompt) => {
    setMessage(prompt);
    setTimeout(() => adjustHeight(), 0);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative w-full min-h-[85vh] rounded-[32px] overflow-hidden border border-white/10"
      style={{
        backgroundImage:
          'radial-gradient(circle at 12% 18%, rgba(34,211,238,0.25), transparent 38%),' +
          'radial-gradient(circle at 88% 20%, rgba(99,102,241,0.3), transparent 40%),' +
          'radial-gradient(circle at 50% 80%, rgba(236,72,153,0.2), transparent 45%),' +
          'linear-gradient(140deg, #05070f 0%, #0b1220 55%, #0a0f1c 100%)',
      }}
    >
      <div className="absolute inset-0">
        <div className="absolute -top-24 -left-16 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10 flex h-full flex-col gap-6 p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.35em] text-cyan-200/80">
              Advanced AI Librarian
            </p>
            <h2 className="text-3xl font-semibold text-white md:text-4xl">{title}</h2>
            <p className="max-w-2xl text-sm text-slate-300">
              Ask for curated learning paths, category insights, and the most relevant books for your goals.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
              Live knowledge sync
            </div>
            <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2">
              Context aware
            </div>
            <div className="rounded-full border border-white/10 bg-black/40 px-4 py-2">
              Multi-step reasoning
            </div>
          </div>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="flex min-h-0 flex-col rounded-3xl border border-white/10 bg-slate-950/70 shadow-[0_18px_40px_rgba(2,6,23,0.55)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-white">Conversation</p>
                <p className="text-xs text-slate-400">Personalized recommendations and summaries.</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-slate-200">
                <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
                Smart Mode
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-slate-300">
                  Start typing below to get intelligent book recommendations and learning paths.
                </p>
              ) : null}

              {history.map((item, index) => (
                <motion.div
                  key={`${item.role}-${index}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    'max-w-[85%] rounded-2xl border px-4 py-3 text-sm whitespace-pre-wrap shadow-[0_12px_30px_rgba(2,6,23,0.35)]',
                    item.role === 'user'
                      ? 'ml-auto border-cyan-300/30 bg-cyan-500/20 text-cyan-100'
                      : 'border-white/10 bg-slate-900/70 text-slate-200'
                  )}
                >
                  {item.content}
                </motion.div>
              ))}

              {sending ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-bounce" style={{ animationDelay: '120ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-bounce" style={{ animationDelay: '240ms' }} />
                  </div>
                  AI Librarian is thinking...
                </div>
              ) : null}
            </div>

            <form onSubmit={submit} className="border-t border-white/10 p-4">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                <Textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    adjustHeight();
                  }}
                  placeholder="Ask for book recommendations, summaries, or a learning path..."
                  className={cn(
                    'w-full resize-none border-none bg-transparent px-3 py-3 text-sm text-white',
                    'focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-slate-400'
                  )}
                  style={{ overflow: 'hidden' }}
                />

                <div className="mt-2 flex items-center justify-between">
                  {error ? <p className="text-xs text-rose-300">{error}</p> : <span />}
                  <Button
                    disabled={sending}
                    className={cn(
                      'flex items-center gap-1 rounded-xl px-4 py-2 text-xs',
                      sending
                        ? 'cursor-not-allowed bg-slate-800 text-slate-500'
                        : 'border border-emerald-300/30 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30'
                    )}
                  >
                    <ArrowUpIcon className="h-4 w-4" />
                    <span>{sending ? 'Sending...' : 'Send'}</span>
                  </Button>
                </div>
              </div>
            </form>
          </section>

          <aside className="flex min-h-0 flex-col gap-4">
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-[0_18px_36px_rgba(2,6,23,0.55)]">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-200/70">
                <Sparkles className="h-4 w-4" />
                Capabilities
              </div>
              <div className="mt-4 space-y-3">
                {CAPABILITIES.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-black/40 p-3">
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="text-xs text-slate-400">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-[0_18px_36px_rgba(2,6,23,0.55)]">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Command Palette</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {COMMANDS.map((command) => (
                  <button
                    key={command}
                    onClick={() => handleQuickAction(command)}
                    className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] text-slate-200 hover:bg-white/10"
                  >
                    {command}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-[0_18px_36px_rgba(2,6,23,0.55)]">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">Smart Shortcuts</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {QUICK_ACTIONS.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    onClick={() => handleQuickAction(action.prompt)}
                    className="flex items-center gap-2 rounded-full border-white/10 bg-black/40 text-[11px] text-slate-200 hover:bg-white/10"
                  >
                    <action.icon className="h-3.5 w-3.5" />
                    <span>{action.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </motion.div>
  );
}
