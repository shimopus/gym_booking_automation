import React from 'react';
import { X, Loader2, Send } from 'lucide-react';
import { MergedSlot } from '../types';

interface PollModalProps {
  pollSlot: MergedSlot | null;
  setPollSlot: (slot: MergedSlot | null) => void;
  isBulkPoll: boolean;
  pollQuestion: string;
  setPollQuestion: (q: string) => void;
  pollOptions: { text: string; price2h?: number }[];
  setPollOptions: (opts: { text: string; price2h?: number }[]) => void;
  handleSendPoll: () => void;
  isSendingPoll: boolean;
}

export function PollModal({
  pollSlot,
  setPollSlot,
  isBulkPoll,
  pollQuestion,
  setPollQuestion,
  pollOptions,
  setPollOptions,
  handleSendPoll,
  isSendingPoll
}: PollModalProps) {
  if (!pollSlot) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-neutral-900">Create Poll</h3>
            {isBulkPoll && (
              <span className="bg-emerald-50 text-emerald-700 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                Multi-select
              </span>
            )}
          </div>
          <button 
            onClick={() => setPollSlot(null)}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Question</label>
            <input 
              type="text" 
              value={pollQuestion}
              onChange={e => setPollQuestion(e.target.value)}
              className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">Options</label>
            <div className="space-y-2">
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={opt.text}
                    onChange={e => {
                      const newOpts = [...pollOptions];
                      newOpts[i] = { ...newOpts[i], text: e.target.value };
                      setPollOptions(newOpts);
                    }}
                    className="flex-1 p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  />
                  {pollOptions.length > 2 && (
                    <button 
                      onClick={() => setPollOptions(pollOptions.filter((_, idx) => idx !== i))}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {pollOptions.length < 10 && (
              <button 
                onClick={() => setPollOptions([...pollOptions, { text: '' }])}
                className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                + Add Option
              </button>
            )}
          </div>
          <button
            onClick={handleSendPoll}
            disabled={isSendingPoll || !pollQuestion.trim() || pollOptions.filter(o => o.text?.trim()).length < 2}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
          >
            {isSendingPoll ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Poll to Telegram
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
