import React, { useState } from 'react';
import { X, RotateCcw, Trash2, Link, MessageSquare, Loader2, AlertCircle, CalendarDays, CheckCircle2 } from 'lucide-react';
import { ActivePoll } from '../types';

interface RestorePollModalProps {
  isOpen: boolean;
  onClose: () => void;
  deletedPolls: ActivePoll[];
  onRestorePoll: (poll: ActivePoll) => Promise<boolean>;
  onPermanentlyDelete: (id: string) => Promise<void>;
  onRestoreFromTelegram: (messageIdOrLink: string) => Promise<boolean>;
  isRestoring: boolean;
}

export function RestorePollModal({
  isOpen,
  onClose,
  deletedPolls,
  onRestorePoll,
  onPermanentlyDelete,
  onRestoreFromTelegram,
  isRestoring
}: RestorePollModalProps) {
  const [activeTab, setActiveTab] = useState<'trash' | 'telegram'>('trash');
  const [telegramInput, setTelegramInput] = useState('');
  const [telegramError, setTelegramError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const handleTelegramRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setTelegramError('');
    setSuccessMessage('');

    if (!telegramInput.trim()) {
      setTelegramError('Please enter a Telegram message ID or link.');
      return;
    }

    const success = await onRestoreFromTelegram(telegramInput.trim());
    if (success) {
      setSuccessMessage('Poll restored successfully from Telegram!');
      setTelegramInput('');
      setTimeout(() => {
        onClose();
      }, 1200);
    }
  };

  const handleRestoreItem = async (poll: ActivePoll) => {
    const success = await onRestorePoll(poll);
    if (success) {
      setSuccessMessage(`Restored "${poll.question.slice(0, 30)}..."`);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-neutral-100 flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 leading-tight">Restore Poll</h2>
              <p className="text-xs text-neutral-500">Recover removed polls or reconnect from Telegram</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-5 pt-3 border-b border-neutral-100 flex gap-4">
          <button
            onClick={() => setActiveTab('trash')}
            className={`pb-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'trash'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Recently Removed ({deletedPolls.length})
          </button>
          <button
            onClick={() => setActiveTab('telegram')}
            className={`pb-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'telegram'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            Restore from Telegram Link / ID
          </button>
        </div>

        {/* Success toast */}
        {successMessage && (
          <div className="mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Tab content */}
        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === 'trash' ? (
            <div className="space-y-3">
              {deletedPolls.length > 0 ? (
                deletedPolls.map((poll) => (
                  <div
                    key={poll.id}
                    className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50 hover:bg-white hover:border-indigo-200 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 pr-2">
                      <p className="text-sm font-bold text-neutral-900 leading-snug">
                        {poll.question}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3 text-neutral-400" />
                          Created: {new Date(poll.createdAt).toLocaleDateString()}
                        </span>
                        <span>•</span>
                        <span>{poll.options?.length || 0} options</span>
                        {poll.totalVoterCount !== undefined && (
                          <>
                            <span>•</span>
                            <span className="text-indigo-600 font-semibold">{poll.totalVoterCount} votes</span>
                          </>
                        )}
                        {poll.deletedAt && (
                          <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">
                            Removed {new Date(poll.deletedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => handleRestoreItem(poll)}
                        disabled={isRestoring}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isRestoring ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        Restore
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Permanently delete this poll? This cannot be undone.')) {
                            onPermanentlyDelete(poll.id);
                          }
                        }}
                        className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete permanently"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-neutral-400 space-y-2">
                  <RotateCcw className="w-8 h-8 mx-auto text-neutral-300" />
                  <p className="text-sm font-medium text-neutral-600">No recently removed polls in trash</p>
                  <p className="text-xs max-w-sm mx-auto">
                    If your poll was sent to Telegram, you can still reconnect and restore it using the Telegram link or message ID tab!
                  </p>
                  <button
                    onClick={() => setActiveTab('telegram')}
                    className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 underline"
                  >
                    Restore from Telegram link &rarr;
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-blue-800">
                  <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>How to restore any poll from Telegram:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-blue-700/90 text-[11px]">
                  <li>Open your Telegram group chat where the poll was sent.</li>
                  <li>Right-click or tap the poll message and select <b>"Copy Link"</b> (or note its message ID).</li>
                  <li>Paste the link or message ID below and click <b>Restore</b>. The app will fetch the poll question, options, and sync votes!</li>
                </ol>
              </div>

              <form onSubmit={handleTelegramRestore} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Telegram Message Link or Message ID
                  </label>
                  <input
                    type="text"
                    value={telegramInput}
                    onChange={(e) => {
                      setTelegramInput(e.target.value);
                      setTelegramError('');
                    }}
                    placeholder="e.g. https://t.me/c/1234567890/105 or 105"
                    className="w-full text-xs px-3 py-2.5 rounded-xl border border-neutral-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition-all placeholder:text-neutral-400"
                  />
                  {telegramError && (
                    <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {telegramError}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-neutral-200 text-neutral-600 rounded-xl text-xs font-semibold hover:bg-neutral-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRestoring || !telegramInput.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isRestoring ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Fetching from Telegram...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore Poll
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
