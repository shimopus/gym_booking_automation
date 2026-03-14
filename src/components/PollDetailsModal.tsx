import React from 'react';
import { X, Send, CheckSquare, Square, Loader2 } from 'lucide-react';
import { ActivePoll, VoterInfo } from '../types';

interface PollDetailsModalProps {
  selectedPollForDetails: ActivePoll | null;
  setSelectedPollForDetails: (poll: ActivePoll | null) => void;
  togglePaidStatus: (pollId: string, summaryIndex: number, userIndex: number) => void;
  editingLineup: { index: number; text: string } | null;
  setEditingLineup: (lineup: { index: number; text: string } | null) => void;
  handleSaveEditedLineup: () => void;
  isSavingLineup: boolean;
  showPollDetails: boolean;
  setShowPollDetails: (show: boolean) => void;
  prepareLineups: (poll: ActivePoll) => void;
  isSendingLineup: boolean;
  ignoreVoteLimit: boolean;
  setIgnoreVoteLimit: (ignore: boolean) => void;
}

export function PollDetailsModal({
  selectedPollForDetails,
  setSelectedPollForDetails,
  togglePaidStatus,
  editingLineup,
  setEditingLineup,
  handleSaveEditedLineup,
  isSavingLineup,
  showPollDetails,
  setShowPollDetails,
  prepareLineups,
  isSendingLineup,
  ignoreVoteLimit,
  setIgnoreVoteLimit
}: PollDetailsModalProps) {
  if (!selectedPollForDetails) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900">Poll Details</h3>
              <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                Created {new Date(selectedPollForDetails.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setSelectedPollForDetails(null)}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>
        
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {selectedPollForDetails.sentSummaries && selectedPollForDetails.sentSummaries.length > 0 && (
            <div className="mb-10 space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Sent Summaries & Payments</h3>
              </div>
              <div className="space-y-4">
                {selectedPollForDetails.sentSummaries.map((summary, sIdx) => (
                  <div key={sIdx} className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase">
                        Sent {new Date(summary.timestamp).toLocaleString()}
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                        Live on Telegram
                      </span>
                    </div>
                    <div className="space-y-2">
                      {summary.users.map((user, uIdx) => (
                        <div key={uIdx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-neutral-100 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${user.paid ? 'bg-emerald-100 text-emerald-600' : 'bg-neutral-100 text-neutral-400'}`}>
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-neutral-900 leading-tight">{user.name}</p>
                              <p className="text-[10px] text-neutral-500">
                                {user.username ? `@${user.username}` : 'No username'} • ${user.total.toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => togglePaidStatus(selectedPollForDetails.id, sIdx, uIdx)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              user.paid 
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm' 
                                : 'bg-white text-neutral-400 border border-neutral-200 hover:border-indigo-300 hover:text-indigo-600'
                            }`}
                          >
                            {user.paid ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                            {user.paid ? 'Paid' : 'Mark Paid'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedPollForDetails.sentLineups && selectedPollForDetails.sentLineups.length > 0 && (
            <div className="mb-10 space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Sent Lineups</h3>
              </div>
              <div className="space-y-4">
                {selectedPollForDetails.sentLineups.map((lineup, lIdx) => (
                  <div key={lIdx} className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase">
                        Sent {new Date(lineup.timestamp).toLocaleString()}
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                        <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                        Live on Telegram
                      </span>
                    </div>
                    {editingLineup?.index === lIdx ? (
                      <div className="space-y-3">
                        <textarea
                          value={editingLineup.text}
                          onChange={(e) => setEditingLineup({ ...editingLineup, text: e.target.value })}
                          rows={8}
                          className="w-full p-3 text-sm font-mono bg-white border border-neutral-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setEditingLineup(null)}
                            className="px-4 py-1.5 text-xs font-bold text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveEditedLineup}
                            disabled={isSavingLineup}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {isSavingLineup ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckSquare className="w-3 h-3" />}
                            Save & Update
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-white border border-neutral-100 rounded-xl shadow-sm">
                          <pre className="text-xs font-mono text-neutral-700 whitespace-pre-wrap font-sans" dangerouslySetInnerHTML={{ __html: lineup.text.replace(/\n/g, '<br/>') }} />
                        </div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => setEditingLineup({ index: lIdx, text: lineup.text })}
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                          >
                            Edit Message
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-neutral-300 rounded-full" />
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Poll Details</h3>
              </div>
              <button 
                onClick={() => setShowPollDetails(!showPollDetails)}
                className="text-xs font-bold text-neutral-500 hover:text-neutral-700"
              >
                {showPollDetails ? 'Hide' : 'Show'}
              </button>
            </div>

            {showPollDetails && (
              <div className="space-y-6">
                <p className="text-lg font-bold text-neutral-900 leading-tight">
                  {selectedPollForDetails.question}
                </p>
                {selectedPollForDetails.options.map((opt, idx) => {
                  const voters = (Object.values(selectedPollForDetails.voterAnswers || {}) as VoterInfo[])
                    .filter(v => v.optionIds.includes(idx))
                    .sort((a, b) => a.votedAt - b.votedAt);
                  
                  return (
                    <div key={idx} className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-semibold text-neutral-800">{opt.text}</span>
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                          {voters.length} votes
                        </span>
                      </div>
                      
                      <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 transition-all duration-500" 
                          style={{ width: `${selectedPollForDetails.totalVoterCount > 0 ? (voters.length / selectedPollForDetails.totalVoterCount) * 100 : 0}%` }}
                        />
                      </div>

                      {voters.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {voters.map((v, i) => (
                            <div 
                              key={v.userId} 
                              className={`text-[10px] border px-2 py-1 rounded-lg flex items-center gap-1 ${
                                i < 12 
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                  : 'bg-neutral-50 border-neutral-200 text-neutral-500 opacity-75'
                              }`}
                            >
                              <span className="font-bold opacity-50">{i + 1}.</span>
                              <span className="font-medium">{v.name}</span>
                              {v.username && <span className="opacity-70">@{v.username}</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-neutral-400 italic">No votes yet</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => prepareLineups(selectedPollForDetails)}
              disabled={isSendingLineup || !selectedPollForDetails.voterAnswers || (selectedPollForDetails.sentSummaries && selectedPollForDetails.sentSummaries.length > 0)}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50"
            >
              <CheckSquare className="w-4 h-4" />
              {selectedPollForDetails.sentSummaries && selectedPollForDetails.sentSummaries.length > 0 ? 'Lineups Sent' : 'Prepare Lineups'}
            </button>
            {!(selectedPollForDetails.sentSummaries && selectedPollForDetails.sentSummaries.length > 0) && (
              <label className="flex items-center gap-1.5 text-[10px] font-medium text-neutral-400 hover:text-neutral-600 cursor-pointer transition-colors" title="Ignore 12 vote limit (Debug)">
                <input 
                  type="checkbox" 
                  checked={ignoreVoteLimit}
                  onChange={(e) => setIgnoreVoteLimit(e.target.checked)}
                  className="w-3 h-3 text-indigo-600 rounded-sm border-neutral-300 focus:ring-indigo-500"
                />
                Debug
              </label>
            )}
          </div>
          <button 
            onClick={() => setSelectedPollForDetails(null)}
            className="px-6 py-2 bg-white border border-neutral-200 rounded-xl text-sm font-bold text-neutral-700 hover:bg-neutral-100 transition-all shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
