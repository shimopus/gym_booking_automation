import React from 'react';
import { X, CheckSquare, Send, Loader2 } from 'lucide-react';

interface LineupPreviewModalProps {
  lineupPreviews: { optionIndex: number; text: string; users?: any[] }[] | null;
  setLineupPreviews: (previews: { optionIndex: number; text: string; users?: any[] }[] | null) => void;
  handleSendFinalLineups: () => void;
  isSendingLineup: boolean;
}

export function LineupPreviewModal({
  lineupPreviews,
  setLineupPreviews,
  handleSendFinalLineups,
  isSendingLineup
}: LineupPreviewModalProps) {
  if (!lineupPreviews) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-emerald-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900">Review Lineups</h3>
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                Edit messages before sending to Telegram
              </p>
            </div>
          </div>
          <button 
            onClick={() => setLineupPreviews(null)}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
          {lineupPreviews.map((preview, idx) => (
            <div key={idx} className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-tight">
                Message {idx + 1}
              </label>
              <textarea
                value={preview.text}
                onChange={(e) => {
                  const next = [...lineupPreviews];
                  next[idx].text = e.target.value;
                  setLineupPreviews(next);
                }}
                rows={10}
                className="w-full p-4 text-sm font-mono bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none"
              />
              <p className="text-[10px] text-neutral-400 italic">
                Note: HTML tags like &lt;b&gt; and &lt;a&gt; are supported.
              </p>
            </div>
          ))}
        </div>

        <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex justify-between items-center">
          <button 
            onClick={() => setLineupPreviews(null)}
            className="px-6 py-2 bg-white border border-neutral-200 rounded-xl text-sm font-bold text-neutral-700 hover:bg-neutral-100 transition-all shadow-sm"
          >
            Back to Details
          </button>
          <button 
            onClick={handleSendFinalLineups}
            disabled={isSendingLineup}
            className="flex items-center gap-2 px-8 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-md disabled:opacity-50"
          >
            {isSendingLineup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send to Telegram
          </button>
        </div>
      </div>
    </div>
  );
}
