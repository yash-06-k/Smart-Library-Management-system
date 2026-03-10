import { motion } from 'framer-motion';
import { SendHorizontal } from 'lucide-react';
import { useState } from 'react';

import { askChatbot } from '../services/api';

export default function AIChatPanel({ title = 'AI Librarian' }) {
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sending) {
      return;
    }

    const nextHistory = [...history, { role: 'user', content: trimmed }];
    setHistory(nextHistory);
    setMessage('');
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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-slate-400">Ask for recommendations, categories, and book discovery help.</p>
      </div>

      <div className="glass-card rounded-2xl p-4 h-[62vh] flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {history.length === 0 ? (
            <div className="text-slate-400 text-sm">Start a conversation with the AI librarian.</div>
          ) : null}

          {history.map((item, index) => (
            <motion.div
              key={`${item.role}-${index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`max-w-[80%] p-3 rounded-xl text-sm whitespace-pre-wrap ${
                item.role === 'user'
                  ? 'ml-auto bg-cyan-500/20 border border-cyan-300/20 text-cyan-100'
                  : 'bg-slate-900/70 border border-white/10 text-slate-200'
              }`}
            >
              {item.content}
            </motion.div>
          ))}
        </div>

        <form onSubmit={submit} className="pt-3 mt-3 border-t border-white/10 flex items-center gap-2">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="flex-1 bg-slate-900/70 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-cyan-300/40"
            placeholder="Ask for a book recommendation..."
          />
          <button
            type="submit"
            disabled={sending}
            className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-300/30 hover:bg-cyan-500/30 disabled:opacity-50"
          >
            <SendHorizontal size={16} />
          </button>
        </form>

        {error ? <p className="text-rose-300 text-xs mt-2">{error}</p> : null}
      </div>
    </div>
  );
}