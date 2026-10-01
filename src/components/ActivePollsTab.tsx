import React, { useState } from 'react';
import { Send, Loader2, Download, X, CalendarDays, RotateCcw, AlertTriangle, Trash2, ArrowUpRight } from 'lucide-react';
import { ActivePoll } from '../types';
import { RestorePollModal } from './RestorePollModal';

interface ActivePollsTabProps {
  activePolls: ActivePoll[];
  deletedPolls: ActivePoll[];
  refreshPolls: () => void;
  isRefreshingPolls: boolean;
  setSelectedPollForDetails: (poll: ActivePoll) => void;
  removePoll: (id: string) => void;
  lastRemovedPoll: ActivePoll | null;
  onRestorePoll: (poll: ActivePoll) => Promise<boolean>;
  onPermanentlyDelete: (id: string) => Promise<void>;
  onRestoreFromTelegram: (messageIdOrLink: string) => Promise<boolean>;
  isRestoringPoll: boolean;
  onDismissLastRemoved: () => void;
}

export function ActivePollsTab({
  activePolls,
  deletedPolls,
  refreshPolls,
  isRefreshingPolls,
  setSelectedPollForDetails,
  removePoll,
  lastRemovedPoll,
  onRestorePoll,
  onPermanentlyDelete,
  onRestoreFromTelegram,
  isRestoringPoll,
  onDismissLastRemoved
}: ActivePollsTabProps) {
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [pollConfirmDelete, setPollConfirmDelete] = useState<ActivePoll | null>(null);

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Header bar */}
      <div className="p-4 border-b border-neutral-100 bg-neutral-50/30 flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
          <Send className="w-4 h-4" />
          Poll Management
        </h3>
        
        <div className="flex items-center gap-2">
          {/* Restore Polls button */}
          <button
            onClick={() => setShowRestoreModal(true)}
            className="text-xs font-semibold text-neutral-700 hover:text-indigo-600 flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:border-indigo-300 shadow-sm transition-all"
            title="Restore removed polls or reconnect from Telegram"
          >
            <RotateCcw className="w-3.5 h-3.5 text-indigo-500" />
            <span>Restore Poll</span>
            {deletedPolls.length > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {deletedPolls.length}
              </span>
            )}
          </button>

          {activePolls.length > 0 && (
            <button 
              onClick={refreshPolls}
              disabled={isRefreshingPolls}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-indigo-200 shadow-sm transition-all disabled:opacity-50"
            >
              {isRefreshingPolls ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Refresh Results
            </button>
          )}
        </div>
      </div>

      {/* Undo Toast Banner if a poll was recently removed */}
      {lastRemovedPoll && (
        <div className="mx-6 mt-4 p-3.5 bg-neutral-900 text-white rounded-xl shadow-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 z-20">
          <div className="flex items-center gap-2 text-xs truncate">
            <span className="font-semibold text-neutral-300">Poll removed:</span>
            <span className="font-medium text-white truncate max-w-xs sm:max-w-md">"{lastRemovedPoll.question}"</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onRestorePoll(lastRemovedPoll)}
              disabled={isRestoringPoll}
              className="px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50"
            >
              <RotateCcw className="w-3 h-3" />
              Undo
            </button>
            <button
              onClick={onDismissLastRemoved}
              className="p-1 text-neutral-400 hover:text-white rounded transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="p-6 flex-1">
        {activePolls.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activePolls.map(poll => (
              <div 
                key={poll.id} 
                onClick={() => setSelectedPollForDetails(poll)}
                className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm relative group cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all"
              >
                {/* Delete button triggering confirmation */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setPollConfirmDelete(poll);
                  }}
                  className="absolute top-3 right-3 p-2 sm:p-1.5 text-neutral-400 hover:text-red-600 active:text-red-700 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all z-10 bg-white hover:bg-red-50 rounded-lg shadow-sm border border-neutral-200/90 sm:border-neutral-100 active:scale-95"
                  title="Remove poll"
                  aria-label="Remove poll"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="mb-2">
                  {poll.sentSummaries && poll.sentSummaries.length > 0 ? (
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 w-fit">
                      <div className="w-1 h-1 bg-indigo-500 rounded-full" />
                      Finalized
                    </span>
                  ) : (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 w-fit">
                      <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold text-neutral-900 mb-4 pr-8 line-clamp-2 leading-tight">{poll.question}</p>
                <div className="space-y-2.5">
                  {poll.options.map((opt, i) => {
                    const totalVoterCount = poll.totalVoterCount || 0;
                    const voterCount = opt.voter_count || 0;
                    const percentage = totalVoterCount > 0 ? (voterCount / totalVoterCount) * 100 : 0;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-[11px] text-neutral-600 font-medium">
                          <span className="truncate pr-2">{opt.text}</span>
                          <span className="font-bold text-indigo-600">{voterCount}</span>
                        </div>
                        <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 transition-all duration-500" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-neutral-50 text-[10px] text-neutral-400 flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {new Date(poll.createdAt).toLocaleDateString()}
                  </span>
                  <span className="font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">
                    {poll.totalVoterCount || 0} votes
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-4 py-16">
            <div className="w-20 h-20 rounded-full bg-neutral-50 flex items-center justify-center">
              <Send className="w-10 h-10 text-neutral-300" />
            </div>
            <div className="text-center max-w-sm">
              <p className="text-neutral-700 font-semibold text-base">No active polls</p>
              <p className="text-xs text-neutral-500 mt-1">
                Create a poll from the Available Slots tab, or restore a previously removed poll.
              </p>
            </div>
            
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowRestoreModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore Removed Poll
                {deletedPolls.length > 0 && (
                  <span className="bg-indigo-700 px-1.5 py-0.2 rounded-full text-[10px]">
                    {deletedPolls.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {pollConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div 
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-neutral-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-50 text-red-600 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Remove Poll?</h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Are you sure you want to remove <b>"{pollConfirmDelete.question}"</b>?
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Don't worry, the poll will be moved to <b>Recently Removed</b> and can be restored at any time.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPollConfirmDelete(null)}
                className="px-3.5 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  removePoll(pollConfirmDelete.id);
                  setPollConfirmDelete(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-colors"
              >
                Remove Poll
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Poll Modal */}
      <RestorePollModal
        isOpen={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        deletedPolls={deletedPolls}
        onRestorePoll={onRestorePoll}
        onPermanentlyDelete={onPermanentlyDelete}
        onRestoreFromTelegram={onRestoreFromTelegram}
        isRestoring={isRestoringPoll}
      />
    </div>
  );
}
