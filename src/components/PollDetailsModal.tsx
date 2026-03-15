import React from 'react';
import { X, Send, CheckSquare, Square, Loader2, GripVertical } from 'lucide-react';
import { ActivePoll, VoterInfo } from '../types';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableVoter({ voter, index, id }: { voter: VoterInfo; index: number; id: number }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`text-[10px] border px-2 py-1 rounded-lg flex items-center gap-1 ${
        index < 12 
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
          : 'bg-neutral-50 border-neutral-200 text-neutral-500 opacity-75'
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab">
        <GripVertical className="w-3 h-3 opacity-50" />
      </div>
      <span className="font-bold opacity-50">{index + 1}.</span>
      <span className="font-medium">{voter.name}</span>
      {voter.username && <span className="opacity-70">@{voter.username}</span>}
    </div>
  );
}

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
  reSyncPoll: (pollId: string) => Promise<void>;
  updateVoterAnswer: (pollId: string, userId: number, newOptionIds: number[], newOptionVoterOrder?: { [optionId: number]: number[] }) => Promise<void>;
  addVoterAnswer: (pollId: string, voter: VoterInfo) => Promise<void>;
  stopPoll: (pollId: string) => Promise<void>;
  updateVoterOrder: (pollId: string, optionId: number, newVoterIds: number[]) => Promise<void>;
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
  setIgnoreVoteLimit,
  reSyncPoll,
  updateVoterAnswer,
  addVoterAnswer,
  stopPoll,
  updateVoterOrder
}: PollDetailsModalProps) {
  const [showManageVotes, setShowManageVotes] = React.useState(false);

  const handleDragEnd = (event: DragEndEvent, optionId: number) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const voters = (Object.values(selectedPollForDetails?.voterAnswers || {}) as VoterInfo[])
        .filter(v => v.optionIds.includes(optionId))
        .sort((a, b) => a.votedAt - b.votedAt);
      
      const optionVoterIds = selectedPollForDetails?.optionVoterOrder?.[optionId] || voters.map(v => v.userId);
      
      const oldIndex = optionVoterIds.indexOf(active.id as number);
      const newIndex = optionVoterIds.indexOf(over.id as number);
      
      const newOrder = arrayMove(optionVoterIds, oldIndex, newIndex);
      if (selectedPollForDetails) {
        updateVoterOrder(selectedPollForDetails.id, optionId, newOrder);
      }
    }
  };

  if (!selectedPollForDetails) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Manage Votes Modal */}
        {showManageVotes && (
          <div className="absolute inset-0 bg-white z-[70] p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Manage Votes</h3>
              <button onClick={() => setShowManageVotes(false)} className="text-neutral-500">Close</button>
            </div>
            
            <div className="flex gap-6">
              {/* All Voters List */}
              <div className="w-1/3 p-4 border rounded-xl bg-neutral-100">
                <h4 className="font-bold mb-2 text-sm">All Voters</h4>
                <div 
                  className="space-y-2 min-h-[100px]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    const voterId = parseInt(e.dataTransfer.getData('voterId'));
                    const optionIdx = parseInt(e.dataTransfer.getData('optionIdx'));
                    const voter = selectedPollForDetails.voterAnswers?.[voterId];
                    if (voter && optionIdx !== -1) {
                      // Remove vote
                      const newOptionIds = voter.optionIds.filter(id => id !== optionIdx);
                      let newOptionVoterOrder = { ...(selectedPollForDetails.optionVoterOrder || {}) };
                      if (newOptionVoterOrder[optionIdx]) {
                        newOptionVoterOrder[optionIdx] = newOptionVoterOrder[optionIdx].filter(id => id !== voterId);
                      }
                      await updateVoterAnswer(selectedPollForDetails.id, voterId, newOptionIds, newOptionVoterOrder);
                    }
                  }}
                >
                  {Object.values(selectedPollForDetails.voterAnswers || {}).map(voter => (
                    <div 
                      key={voter.userId} 
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('voterId', voter.userId.toString());
                        e.dataTransfer.setData('optionIdx', '-1');
                      }}
                      className="p-2 bg-white border rounded-lg cursor-grab text-xs font-medium"
                    >
                      {voter.name}
                    </div>
                  ))}
                </div>
              </div>

              {/* Options */}
              <div className="w-2/3 space-y-4">
                {selectedPollForDetails.options.map((opt, optIdx) => (
                  <div 
                    key={optIdx} 
                    className="p-4 border rounded-xl bg-neutral-50"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async (e) => {
                      const voterId = parseInt(e.dataTransfer.getData('voterId'));
                      const sourceOptionIdx = parseInt(e.dataTransfer.getData('optionIdx'));
                      const voter = selectedPollForDetails.voterAnswers?.[voterId];
                      if (!voter) return;

                      const newOptionIds = [...voter.optionIds];
                      let newOptionVoterOrder = { ...(selectedPollForDetails.optionVoterOrder || {}) };
                      if (!newOptionVoterOrder[optIdx]) newOptionVoterOrder[optIdx] = [];

                      if (sourceOptionIdx === -1) {
                        // Add vote
                        if (!newOptionIds.includes(optIdx)) {
                          newOptionIds.push(optIdx);
                          newOptionVoterOrder[optIdx].push(voter.userId);
                        }
                      } else if (sourceOptionIdx !== optIdx) {
                        // Move vote
                        newOptionIds.push(optIdx);
                        newOptionIds.splice(newOptionIds.indexOf(sourceOptionIdx), 1);
                        newOptionVoterOrder[optIdx].push(voter.userId);
                        newOptionVoterOrder[sourceOptionIdx] = newOptionVoterOrder[sourceOptionIdx].filter(id => id !== voter.userId);
                      } else {
                        // Reorder within option
                        // This is tricky with current drag-and-drop.
                        // For now, just append to end of order if not already there.
                        if (!newOptionVoterOrder[optIdx].includes(voter.userId)) {
                          newOptionVoterOrder[optIdx].push(voter.userId);
                        }
                      }

                      await updateVoterAnswer(selectedPollForDetails.id, voterId, newOptionIds, newOptionVoterOrder);
                    }}
                  >
                    <h4 className="font-bold mb-2 text-sm">{opt.text}</h4>
                    <div className="space-y-1">
                      {(() => {
                        const voters = Object.values(selectedPollForDetails.voterAnswers || {}).filter(v => v.optionIds.includes(optIdx));
                        const order = selectedPollForDetails.optionVoterOrder?.[optIdx] || [];
                        
                        // Sort by order, then by votedAt
                        return voters.sort((a, b) => {
                          const aIdx = order.indexOf(a.userId);
                          const bIdx = order.indexOf(b.userId);
                          if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
                          if (aIdx !== -1) return -1;
                          if (bIdx !== -1) return 1;
                          return a.votedAt - b.votedAt;
                        });
                      })().map(voter => (
                        <div 
                          key={voter.userId} 
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('voterId', voter.userId.toString());
                            e.dataTransfer.setData('optionIdx', optIdx.toString());
                          }}
                          className="p-2 bg-white border rounded-lg cursor-grab text-xs font-medium"
                        >
                          {voter.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 p-4 border-t">
              <h4 className="font-bold mb-2">Add New Voter</h4>
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input id="newVoterName" type="text" placeholder="Name" className="flex-1 p-2 border rounded-lg" />
                  <input id="newVoterUsername" type="text" placeholder="Alias" className="flex-1 p-2 border rounded-lg" />
                </div>
                <button 
                  onClick={async () => {
                    const nameInput = document.getElementById('newVoterName') as HTMLInputElement;
                    const usernameInput = document.getElementById('newVoterUsername') as HTMLInputElement;
                    if (nameInput.value) {
                      const newVoter: VoterInfo = {
                        userId: Date.now(),
                        name: nameInput.value,
                        optionIds: [],
                        votedAt: Date.now()
                      };
                      if (usernameInput.value) {
                        newVoter.username = usernameInput.value;
                      }
                      await addVoterAnswer(selectedPollForDetails.id, newVoter);
                      nameInput.value = '';
                      usernameInput.value = '';
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

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
              {selectedPollForDetails.isStopped ? (
                <button 
                  onClick={() => setShowManageVotes(true)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                  Manage Votes
                </button>
              ) : (
                <button 
                  onClick={() => stopPoll(selectedPollForDetails.id)}
                  className="text-xs font-bold text-red-600 hover:text-red-800"
                >
                  Stop Poll
                </button>
              )}
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
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                            {opt.voter_count} total votes
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            {voters.length} tracked
                          </span>
                        </div>
                      </div>
                      
                      <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 transition-all duration-500" 
                          style={{ width: `${selectedPollForDetails.totalVoterCount > 0 ? (opt.voter_count / selectedPollForDetails.totalVoterCount) * 100 : 0}%` }}
                        />
                      </div>

                      {voters.length > 0 ? (
                        <DndContext collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, idx)}>
                          <SortableContext items={voters.map(v => v.userId)} strategy={verticalListSortingStrategy}>
                            <div className="flex flex-wrap gap-1.5">
                              {voters.sort((a, b) => {
                                const order = selectedPollForDetails.optionVoterOrder?.[idx] || [];
                                const aIdx = order.indexOf(a.userId);
                                const bIdx = order.indexOf(b.userId);
                                if (aIdx === -1 && bIdx === -1) return a.votedAt - b.votedAt;
                                if (aIdx === -1) return 1;
                                if (bIdx === -1) return -1;
                                return aIdx - bIdx;
                              }).map((v, i) => (
                                <div key={v.userId}>
                                  <SortableVoter id={v.userId} voter={v} index={i} />
                                </div>
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      ) : (
                        <p className="text-[10px] text-neutral-400 italic">No tracked votes yet</p>
                      )}
                      
                      {voters.length < opt.voter_count && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                          <p className="text-[10px] text-amber-800">
                            Missing {opt.voter_count - voters.length} voter details.
                          </p>
                          <button 
                            onClick={() => reSyncPoll(selectedPollForDetails.id)}
                            className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline"
                          >
                            Re-sync
                          </button>
                        </div>
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
