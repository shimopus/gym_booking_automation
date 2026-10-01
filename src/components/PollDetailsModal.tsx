import React from 'react';
import { X, Send, CheckSquare, Square, Loader2, GripVertical, Plus, UserPlus, Trash2 } from 'lucide-react';
import { ActivePoll, VoterInfo } from '../types';
import { 
  DndContext, 
  rectIntersection, 
  DragEndEvent, 
  DragOverEvent, 
  DragStartEvent, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  useDroppable
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  useSortable, 
  verticalListSortingStrategy,
  horizontalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableVoter: React.FC<{ voter: VoterInfo; index: number; id: number; targetVoterCount: number }> = ({ voter, index, id, targetVoterCount }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`text-[10px] border px-2 py-1 rounded-lg flex items-center gap-1 ${
        index < targetVoterCount 
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
          : 'bg-neutral-50 border-neutral-200 text-neutral-500 opacity-75'
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab touch-none">
        <GripVertical className="w-3 h-3 opacity-50" />
      </div>
      <span className="font-bold opacity-50">{index + 1}.</span>
      <span className="font-medium">{voter.name}</span>
      {voter.username && <span className="opacity-70">@{voter.username}</span>}
    </div>
  );
};

const ManageSortableVoter: React.FC<{ id: string; name: string }> = ({ id, name }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className="p-2 bg-white border rounded-lg cursor-grab text-xs font-medium shadow-sm hover:border-indigo-300 transition-colors"
    >
      {name}
    </div>
  );
};

const ManageDroppableContainer: React.FC<{ id: string; children: React.ReactNode; className?: string }> = ({ id, children, className }) => {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
};

const EditableUserTotal: React.FC<{ initialTotal: number; onSave: (val: number) => void }> = ({ initialTotal, onSave }) => {
  const [value, setValue] = React.useState(initialTotal.toString());
  
  React.useEffect(() => {
    setValue(initialTotal.toString());
  }, [initialTotal]);

  const handleBlur = () => {
    const num = parseFloat(value);
    if (!isNaN(num) && num !== initialTotal) {
      onSave(num);
    } else {
      setValue(initialTotal.toString());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input 
      type="number" 
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-10 font-bold text-indigo-700 bg-transparent outline-none focus:ring-0"
    />
  );
};

const EditableUserName: React.FC<{ initialName: string; onSave: (val: string) => void }> = ({ initialName, onSave }) => {
  const [value, setValue] = React.useState(initialName);
  
  React.useEffect(() => {
    setValue(initialName);
  }, [initialName]);

  const handleBlur = () => {
    if (value.trim() && value !== initialName) {
      onSave(value.trim());
    } else {
      setValue(initialName);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <input 
      type="text" 
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="text-sm font-bold text-neutral-900 leading-tight bg-transparent border-b border-transparent hover:border-neutral-200 focus:border-indigo-400 focus:outline-none max-w-[150px]"
    />
  );
};

const EditableUserHandle: React.FC<{ initialUsername?: string; onSave: (val: string) => void }> = ({ initialUsername, onSave }) => {
  const [value, setValue] = React.useState(initialUsername || '');
  
  React.useEffect(() => {
    setValue(initialUsername || '');
  }, [initialUsername]);

  const handleBlur = () => {
    const trimmed = value.trim().replace('@', '');
    const initial = (initialUsername || '').trim().replace('@', '');
    if (trimmed !== initial) {
      onSave(trimmed);
    } else {
      setValue(initialUsername || '');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="flex items-center">
      <span className="text-neutral-400 mr-0.5">@</span>
      <input 
        type="text" 
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="username"
        className="text-[10px] bg-transparent border-b border-transparent hover:border-neutral-200 focus:border-indigo-400 focus:outline-none w-[80px]"
      />
    </div>
  );
};

interface PollDetailsModalProps {
  selectedPollForDetails: ActivePoll | null;
  setSelectedPollForDetails: (poll: ActivePoll | null) => void;
  togglePaidStatus: (pollId: string, summaryIndex: number, userIndex: number) => void;
  updateUserPayment: (pollId: string, summaryIndex: number, userIndex: number, updates: { total?: number; name?: string; username?: string }) => Promise<void>;
  addSummaryUser: (pollId: string, summaryIndex: number, name: string) => Promise<void>;
  removeSummaryUser: (pollId: string, summaryIndex: number, userIndex: number) => Promise<void>;
  editingLineup: { index: number; text: string } | null;
  setEditingLineup: (lineup: { index: number; text: string } | null) => void;
  handleSaveEditedLineup: () => void;
  isSavingLineup: boolean;
  showPollDetails: boolean;
  setShowPollDetails: (show: boolean) => void;
  prepareLineups: (poll: ActivePoll, targetVoterCounts: Record<number, number>) => void;
  isSendingLineup: boolean;
  ignoreVoteLimit: boolean;
  setIgnoreVoteLimit: (ignore: boolean) => void;
  updateVoterAnswer: (pollId: string, userId: number, newOptionIds: number[], newOptionVoterOrder?: { [optionId: number]: number[] }) => Promise<void>;
  addVoterAnswer: (pollId: string, voter: VoterInfo) => Promise<void>;
  stopPoll: (pollId: string) => Promise<void>;
  updateVoterOrder: (pollId: string, optionId: number, newVoterIds: number[]) => Promise<void>;
  removePoll?: (id: string) => void;
}

export function PollDetailsModal({
  selectedPollForDetails,
  setSelectedPollForDetails,
  togglePaidStatus,
  updateUserPayment,
  addSummaryUser,
  removeSummaryUser,
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
  updateVoterAnswer,
  addVoterAnswer,
  stopPoll,
  updateVoterOrder,
  removePoll
}: PollDetailsModalProps) {
  const [showManageVotes, setShowManageVotes] = React.useState(false);
  const [showAddVoter, setShowAddVoter] = React.useState(false);
  const [manageItems, setManageItems] = React.useState<{ [key: string]: string[] }>({});
  const [activeManageId, setActiveManageId] = React.useState<string | null>(null);
  const [targetVoterCounts, setTargetVoterCounts] = React.useState<Record<number, number>>({});
  const [optionPrices, setOptionPrices] = React.useState<Record<number, number>>({});
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  React.useEffect(() => {
    setConfirmRemove(false);
    if (selectedPollForDetails) {
      const initialPrices: Record<number, number> = {};
      selectedPollForDetails.options.forEach((opt, idx) => {
        if (opt.price2h !== undefined) {
          initialPrices[idx] = opt.price2h;
        }
      });
      setOptionPrices(initialPrices);
    }
  }, [selectedPollForDetails]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  React.useEffect(() => {
    if (showManageVotes && selectedPollForDetails) {
      const initialItems: { [key: string]: string[] } = {
        'all-voters': Object.values(selectedPollForDetails.voterAnswers || {}).map(v => `all-voters:${v.userId}`)
      };
      
      selectedPollForDetails.options.forEach((_, idx) => {
        const voters = Object.values(selectedPollForDetails.voterAnswers || {}).filter(v => v.optionIds.includes(idx));
        const order = selectedPollForDetails.optionVoterOrder?.[idx] || [];
        const sortedVoters = voters.sort((a, b) => {
          const aIdx = order.indexOf(a.userId);
          const bIdx = order.indexOf(b.userId);
          if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
          if (aIdx !== -1) return -1;
          if (bIdx !== -1) return 1;
          return a.votedAt - b.votedAt;
        });
        initialItems[`option-${idx}`] = sortedVoters.map(v => `option:${idx}:${v.userId}`);
      });
      
      setManageItems(initialItems);
    }
  }, [showManageVotes, selectedPollForDetails]);

  const findContainer = (id: string) => {
    if (id in manageItems) return id;
    return Object.keys(manageItems).find(key => manageItems[key].includes(id));
  };

  const handleManageDragStart = (event: DragStartEvent) => {
    setActiveManageId(event.active.id as string);
  };

  const handleManageDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    const activeId = active.id as string;
    const overId = over?.id as string;

    if (!overId || activeId === overId) return;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer) return;

    if (activeContainer !== overContainer) {
      setManageItems(prev => {
        const activeItems = prev[activeContainer];
        const overItems = prev[overContainer];
        const activeIndex = activeItems.indexOf(activeId);
        const overIndex = overItems.indexOf(overId);

        let newIndex;
        if (overId in prev) {
          newIndex = overItems.length;
        } else {
          const isBelowOverItem =
            over &&
            active.rect.current.translated &&
            active.rect.current.translated.top >
              over.rect.top + over.rect.height;

          const modifier = isBelowOverItem ? 1 : 0;
          newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length;
        }

        return {
          ...prev,
          [activeContainer]: activeItems.filter(item => item !== activeId),
          [overContainer]: [
            ...overItems.slice(0, newIndex),
            activeId,
            ...overItems.slice(newIndex)
          ]
        };
      });
    } else {
      // Reorder within same container
      const activeIndex = manageItems[activeContainer].indexOf(activeId);
      const overIndex = manageItems[overContainer].indexOf(overId);

      if (activeIndex !== overIndex) {
        setManageItems(prev => ({
          ...prev,
          [activeContainer]: arrayMove(prev[activeContainer], activeIndex, overIndex)
        }));
      }
    }
  };

  const handleManageDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeId = active.id as string;

    if (!over) {
      setActiveManageId(null);
      return;
    }

    const activeContainer = findContainer(activeId);
    const overId = over.id as string;
    const overContainer = findContainer(overId);

    if (activeContainer && overContainer) {
      // Final state is already updated by handleManageDragOver
      if (selectedPollForDetails) {
        const userId = parseInt(activeId.split(':').pop()!);
        const voter = selectedPollForDetails.voterAnswers?.[userId];
        
        if (voter) {
          const newOptionIds: number[] = [];
          const newOptionVoterOrder: { [key: number]: number[] } = { ...selectedPollForDetails.optionVoterOrder };
          
          selectedPollForDetails.options.forEach((_, idx) => {
            const containerKey = `option-${idx}`;
            const containerItems = manageItems[containerKey] || [];
            const userIdsInOption = containerItems.map(item => parseInt(item.split(':').pop()!));
            
            if (userIdsInOption.includes(userId)) {
              newOptionIds.push(idx);
            }
            newOptionVoterOrder[idx] = userIdsInOption;
          });
          
          await updateVoterAnswer(selectedPollForDetails.id, userId, newOptionIds, newOptionVoterOrder);
        }
      }
    }

    setActiveManageId(null);
  };

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
              <button onClick={() => setShowManageVotes(false)} className="text-neutral-500 font-bold">Close</button>
            </div>
            
            <DndContext 
              sensors={sensors}
              collisionDetection={rectIntersection}
              onDragStart={handleManageDragStart}
              onDragOver={handleManageDragOver}
              onDragEnd={handleManageDragEnd}
            >
              <div className="flex gap-6">
                {/* All Voters List */}
                <div className="w-1/3 p-4 border rounded-xl bg-neutral-100 flex flex-col">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-bold text-sm">All Voters</h4>
                    <button 
                      onClick={() => setShowAddVoter(!showAddVoter)}
                      className="p-1 hover:bg-neutral-200 rounded-lg transition-colors text-indigo-600"
                      title="Add New Voter"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                  </div>

                  {showAddVoter && (
                    <div className="mb-4 p-3 bg-white border rounded-xl shadow-sm space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <input 
                        id="newVoterName" 
                        type="text" 
                        placeholder="Name" 
                        className="w-full p-1.5 text-xs border rounded-lg outline-none focus:ring-1 focus:ring-indigo-500" 
                      />
                      <input 
                        id="newVoterUsername" 
                        type="text" 
                        placeholder="Alias (optional)" 
                        className="w-full p-1.5 text-xs border rounded-lg outline-none focus:ring-1 focus:ring-indigo-500" 
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setShowAddVoter(false)}
                          className="flex-1 px-2 py-1.5 text-[10px] font-bold text-neutral-500 hover:bg-neutral-50 rounded-lg"
                        >
                          Cancel
                        </button>
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
                              setShowAddVoter(false);
                            }
                          }}
                          className="flex-1 px-2 py-1.5 text-[10px] font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  <SortableContext 
                    id="all-voters"
                    items={manageItems['all-voters'] || []}
                    strategy={verticalListSortingStrategy}
                  >
                    <ManageDroppableContainer id="all-voters" className="space-y-2 min-h-[100px] flex-1 overflow-y-auto">
                      {(manageItems['all-voters'] || []).map(id => {
                        const userId = parseInt(id.split(':').pop()!);
                        const voter = selectedPollForDetails.voterAnswers?.[userId];
                        return <ManageSortableVoter key={id} id={id} name={voter?.name || 'Unknown'} />;
                      })}
                    </ManageDroppableContainer>
                  </SortableContext>
                </div>

                {/* Options */}
                <div className="w-2/3 space-y-4">
                  {selectedPollForDetails.options.map((opt, optIdx) => (
                    <div key={optIdx} className="p-4 border rounded-xl bg-neutral-50">
                      <h4 className="font-bold mb-2 text-sm">{opt.text}</h4>
                      <SortableContext 
                        id={`option-${optIdx}`}
                        items={manageItems[`option-${optIdx}`] || []}
                        strategy={verticalListSortingStrategy}
                      >
                        <ManageDroppableContainer id={`option-${optIdx}`} className="space-y-1 min-h-[50px]">
                          {(manageItems[`option-${optIdx}`] || []).map(id => {
                            const userId = parseInt(id.split(':').pop()!);
                            const voter = selectedPollForDetails.voterAnswers?.[userId];
                            return <ManageSortableVoter key={id} id={id} name={voter?.name || 'Unknown'} />;
                          })}
                        </ManageDroppableContainer>
                      </SortableContext>
                    </div>
                  ))}
                </div>
              </div>

              <DragOverlay>
                {activeManageId ? (
                  <div className="p-2 bg-white border rounded-lg cursor-grabbing text-xs font-medium shadow-lg border-indigo-500">
                    {(() => {
                      const userId = parseInt(activeManageId.split(':').pop()!);
                      return selectedPollForDetails.voterAnswers?.[userId]?.name || 'Unknown';
                    })()}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
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
          <div className="flex items-center gap-1.5">
            {removePoll && (
              confirmRemove ? (
                <div className="flex items-center gap-1.5 bg-red-50 p-1.5 rounded-xl border border-red-200 text-xs">
                  <span className="text-[11px] text-red-700 font-semibold px-1">Remove poll?</span>
                  <button
                    onClick={() => {
                      removePoll(selectedPollForDetails.id);
                      setSelectedPollForDetails(null);
                    }}
                    className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmRemove(false)}
                    className="px-2 py-1 text-neutral-500 hover:text-neutral-800 text-xs font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setConfirmRemove(true)}
                  className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                  title="Remove poll"
                  aria-label="Remove poll"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Remove</span>
                </button>
              )
            )}
            <button 
              onClick={() => setSelectedPollForDetails(null)}
              className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-400 hover:text-neutral-600"
              title="Close modal"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
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
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase">
                          Sent {new Date(summary.timestamp).toLocaleString()}
                        </span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                          Live on Telegram
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      {summary.users.map((user, uIdx) => (
                        <div key={uIdx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-neutral-100 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${user.paid ? 'bg-emerald-100 text-emerald-600' : 'bg-neutral-100 text-neutral-400'}`}>
                              {user.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center">
                                <EditableUserName
                                  initialName={user.name}
                                  onSave={(val) => updateUserPayment(selectedPollForDetails.id, sIdx, uIdx, { name: val })}
                                />
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 mt-0.5">
                                <EditableUserHandle
                                  initialUsername={user.username}
                                  onSave={(val) => updateUserPayment(selectedPollForDetails.id, sIdx, uIdx, { username: val })}
                                />
                                {(!user.username && user.userId) ? <span className="mr-1 ml-1 text-neutral-400">ID: {user.userId}</span> : null}
                                <span>•</span>
                                <div className="flex items-center gap-0.5 bg-neutral-50 border border-neutral-200 rounded px-1.5 py-0.5 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400">
                                  <span className="font-bold text-neutral-400">$</span>
                                  <EditableUserTotal 
                                    initialTotal={user.total}
                                    onSave={(val) => updateUserPayment(selectedPollForDetails.id, sIdx, uIdx, { total: val })}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={() => togglePaidStatus(selectedPollForDetails.id, sIdx, uIdx)}
                                className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all w-full ${
                                  user.paid 
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm' 
                                    : 'bg-white text-neutral-400 border border-neutral-200 hover:border-indigo-300 hover:text-indigo-600'
                                }`}
                              >
                                {user.paid ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                                {user.paid ? 'Paid' : 'Mark Paid'}
                              </button>
                              <button
                                onClick={() => removeSummaryUser(selectedPollForDetails.id, sIdx, uIdx)}
                                className="flex items-center justify-center gap-2 px-3 py-1 rounded-lg text-[10px] font-bold text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors w-full border border-transparent hover:border-red-100"
                              >
                                <Trash2 className="w-3 h-3" /> Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-3 border-t border-neutral-200 gap-3">
                        <form 
                          onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const newName = formData.get('newName') as string;
                            if (newName?.trim()) {
                              addSummaryUser(selectedPollForDetails.id, sIdx, newName.trim());
                              e.currentTarget.reset();
                            }
                          }}
                          className="flex items-center gap-2"
                        >
                          <input 
                            name="newName"
                            type="text" 
                            placeholder="Add new person..." 
                            className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 w-[140px]"
                          />
                          <button type="submit" className="bg-indigo-50 text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-100 transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                        </form>
                        
                        <div className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-2">
                          <span>Total to collect:</span>
                          <span className="text-sm">${summary.users.reduce((acc, user) => acc + (user.total || 0), 0).toFixed(2)}</span>
                        </div>
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
                  const totalVoterCount = selectedPollForDetails.totalVoterCount || 0;
                  
                  return (
                    <div key={idx} className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="text-sm font-semibold text-neutral-800">{opt.text}</span>
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <label className="text-[10px] font-medium text-neutral-500">Total Price ($):</label>
                              <input 
                                type="number" 
                                value={optionPrices[idx] !== undefined ? optionPrices[idx] : opt.price2h || 0}
                                onChange={e => {
                                  setOptionPrices(prev => ({
                                    ...prev,
                                    [idx]: parseFloat(e.target.value) || 0
                                  }));
                                }}
                                className="w-14 p-0.5 text-[10px] font-bold text-indigo-700 bg-white border border-neutral-200 rounded outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] font-medium text-neutral-500">Players limit:</label>
                              <div className="flex bg-neutral-100 border border-neutral-200 rounded p-0.5">
                                <button
                                  onClick={() => setTargetVoterCounts(prev => ({ ...prev, [idx]: 12 }))}
                                  className={`px-2 text-[10px] font-semibold rounded-sm transition-all py-0.5 ${
                                    (targetVoterCounts[idx] || 12) === 12 
                                      ? 'bg-white shadow-sm text-indigo-700' 
                                      : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50'
                                  }`}
                                >
                                  12
                                </button>
                                <button
                                  onClick={() => setTargetVoterCounts(prev => ({ ...prev, [idx]: 18 }))}
                                  className={`px-2 text-[10px] font-semibold rounded-sm transition-all py-0.5 ${
                                    targetVoterCounts[idx] === 18 
                                      ? 'bg-white shadow-sm text-indigo-700' 
                                      : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50'
                                  }`}
                                >
                                  18
                                </button>
                              </div>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                            {voters.length} votes
                          </span>
                        </div>
                      </div>
                      
                      <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 transition-all duration-500" 
                          style={{ width: `${totalVoterCount > 0 ? (voters.length / totalVoterCount) * 100 : 0}%` }}
                        />
                      </div>

                      {voters.length > 0 ? (
                        (() => {
                          const sortedVoters = [...voters].sort((a, b) => {
                            const order = selectedPollForDetails.optionVoterOrder?.[idx] || [];
                            const aIdx = order.indexOf(a.userId);
                            const bIdx = order.indexOf(b.userId);
                            if (aIdx === -1 && bIdx === -1) return a.votedAt - b.votedAt;
                            if (aIdx === -1) return 1;
                            if (bIdx === -1) return -1;
                            return aIdx - bIdx;
                          });
                          return (
                            <DndContext collisionDetection={rectIntersection} onDragEnd={(e) => handleDragEnd(e, idx)}>
                              <SortableContext items={sortedVoters.map(v => v.userId)} strategy={verticalListSortingStrategy}>
                                <div className="flex flex-wrap gap-1.5">
                                  {sortedVoters.map((v, i) => (
                                    <SortableVoter key={v.userId} id={v.userId} voter={v} index={i} targetVoterCount={targetVoterCounts[idx] || 12} />
                                  ))}
                                </div>
                              </SortableContext>
                            </DndContext>
                          );
                        })()
                      ) : (
                        <p className="text-[10px] text-neutral-400 italic">No tracked votes yet</p>
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
              onClick={() => {
                const updatedPoll = {
                  ...selectedPollForDetails,
                  options: selectedPollForDetails.options.map((opt, idx) => ({
                    ...opt,
                    price2h: optionPrices[idx] !== undefined ? optionPrices[idx] : opt.price2h
                  }))
                };
                prepareLineups(updatedPoll, targetVoterCounts);
              }}
              disabled={isSendingLineup || !selectedPollForDetails.voterAnswers || (selectedPollForDetails.sentSummaries && selectedPollForDetails.sentSummaries.length > 0)}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50"
            >
              <CheckSquare className="w-4 h-4" />
              {selectedPollForDetails.sentSummaries && selectedPollForDetails.sentSummaries.length > 0 ? 'Lineups Sent' : 'Prepare Lineups'}
            </button>
            {!(selectedPollForDetails.sentSummaries && selectedPollForDetails.sentSummaries.length > 0) && (
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-[10px] font-medium text-neutral-400 hover:text-neutral-600 cursor-pointer transition-colors" title="Ignore vote limit (Debug)">
                  <input 
                    type="checkbox" 
                    checked={ignoreVoteLimit}
                    onChange={(e) => setIgnoreVoteLimit(e.target.checked)}
                    className="w-3 h-3 text-indigo-600 rounded-sm border-neutral-300 focus:ring-indigo-500"
                  />
                  Debug
                </label>
              </div>
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
