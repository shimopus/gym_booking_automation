import React from 'react';
import { Send, Loader2, Download, X, CalendarDays } from 'lucide-react';
import { ActivePoll } from '../types';

interface ActivePollsTabProps {
  activePolls: ActivePoll[];
  refreshPolls: () => void;
  isRefreshingPolls: boolean;
  setSelectedPollForDetails: (poll: ActivePoll) => void;
  removePoll: (id: string) => void;
}

export function ActivePollsTab({
  activePolls,
  refreshPolls,
  isRefreshingPolls,
  setSelectedPollForDetails,
  removePoll
}: ActivePollsTabProps) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-neutral-100 bg-neutral-50/30 flex items-center justify-between">
        <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-2">
          <Send className="w-4 h-4" />
          Poll Management
        </h3>
        {activePolls.length > 0 && (
          <button 
            onClick={refreshPolls}
            disabled={isRefreshingPolls}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-sm transition-all disabled:opacity-50"
          >
            {isRefreshingPolls ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
            Refresh Results
          </button>
        )}
      </div>
      
      <div className="p-6 flex-1">
        {activePolls.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activePolls.map(poll => (
              <div 
                key={poll.id} 
                onClick={() => setSelectedPollForDetails(poll)}
                className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm relative group cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all"
              >
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    removePoll(poll.id);
                  }}
                  className="absolute top-3 right-3 p-1.5 text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white rounded-lg shadow-sm border border-neutral-100"
                  title="Remove from list"
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
                    const percentage = poll.totalVoterCount > 0 ? (opt.voter_count / poll.totalVoterCount) * 100 : 0;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex justify-between text-[11px] text-neutral-600 font-medium">
                          <span className="truncate pr-2">{opt.text}</span>
                          <span className="font-bold text-indigo-600">{opt.voter_count}</span>
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
                    {poll.totalVoterCount} total votes
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-neutral-400 space-y-4 py-20">
            <div className="w-20 h-20 rounded-full bg-neutral-50 flex items-center justify-center">
              <Send className="w-10 h-10 text-neutral-300" />
            </div>
            <div className="text-center">
              <p className="text-neutral-600 font-medium">No active polls</p>
              <p className="text-sm mt-1">Create a poll from the Available Slots tab to see it here.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
