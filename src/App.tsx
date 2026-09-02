import React, { useState, useEffect } from 'react';
import { Send, Plus, X, Loader2, CalendarDays } from 'lucide-react';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { ActivePoll } from './types';
import { buildPollOptionText } from './utils';
import { SettingsModal } from './components/SettingsModal';
import { Header } from './components/Header';
import { ActivePollsTab } from './components/ActivePollsTab';
import { PollDetailsModal } from './components/PollDetailsModal';
import { LineupPreviewModal } from './components/LineupPreviewModal';
import { useTelegram } from './hooks/useTelegram';
import { useMigration } from './hooks/useMigration';

export interface StructuredOption {
  id: string;
  date: string;
  startTime: string;
  durationHours: number;
  courtName: string;
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'polls' | 'create'>('polls');
  const [showSettings, setShowSettings] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("Кто готов закоммититься на зал - голосуем! 🏐");
  
  const [structuredOptions, setStructuredOptions] = useState<StructuredOption[]>([{
    id: Date.now().toString(),
    date: '',
    startTime: '20:00',
    durationHours: 2,
    courtName: '',
  }]);

  const [selectedPollForDetails, setSelectedPollForDetails] = useState<ActivePoll | null>(null);
  const [editingLineup, setEditingLineup] = useState<{ index: number; text: string } | null>(null);
  const [showPollDetails, setShowPollDetails] = useState(true);
  const [ignoreVoteLimit, setIgnoreVoteLimit] = useState(false);
  
  const [isConfirmingSend, setIsConfirmingSend] = useState(false);

  const {
    tgBotToken,
    setTgBotToken,
    tgChatId,
    setTgChatId,
    defaultHourlyPrice,
    setDefaultHourlyPrice,
    activePolls,
    isRefreshingPolls,
    isSendingPoll,
    isSendingLineup,
    isSavingLineup,
    lineupPreviews,
    setLineupPreviews,
    handleSendPoll,
    refreshPolls,
    togglePaidStatus,
    updateUserPayment,
    addSummaryUser,
    removeSummaryUser,
    removePoll,
    handleSaveEditedLineup,
    handleSendFinalLineups,
    prepareLineups,
    updateVoterAnswer,
    addVoterAnswer,
    stopPoll,
    updateVoterOrder
  } = useTelegram(user, isAuthReady);

  useMigration(user, isAuthReady);

  useEffect(() => {
    if (activeTab === 'polls') {
      refreshPolls();
    }
  }, [activeTab]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (selectedPollForDetails) {
      const updated = activePolls.find(p => p.id === selectedPollForDetails.id);
      if (updated) {
        setSelectedPollForDetails(updated);
      }
    }
  }, [activePolls]);

  useEffect(() => {
    if (selectedPollForDetails) {
      setShowPollDetails(!(selectedPollForDetails.sentSummaries && selectedPollForDetails.sentSummaries.length > 0));
    }
  }, [selectedPollForDetails?.id]);

  const handleSaveSettings = async () => {
    if (user) {
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const { db } = await import('./firebase');
        await setDoc(doc(db, 'settings', 'telegram'), {
          tgBotToken,
          tgChatId,
          defaultHourlyPrice,
        }, { merge: true });
      } catch (err) {
        console.error('Failed to save settings to Firebase', err);
      }
    }
    setShowSettings(false);
  };

  // Check if last row is filled, if yes, add a new one automatically
  useEffect(() => {
    if (structuredOptions.length === 0) return;
    const lastOption = structuredOptions[structuredOptions.length - 1];
    if (lastOption.date && lastOption.startTime && lastOption.courtName) {
      setStructuredOptions(prev => [...prev, {
        id: Date.now().toString(),
        date: lastOption.date,
        startTime: lastOption.startTime,
        durationHours: lastOption.durationHours,
        courtName: '',
      }]);
    }
  }, [structuredOptions]);

  const handleSendPollSubmit = () => {
    const finalOptions = structuredOptions
      .map(o => ({
        text: buildPollOptionText(o.date, o.startTime, o.durationHours, o.courtName),
        price2h: o.durationHours * defaultHourlyPrice
      }))
      .filter(o => o.text.trim().length > 0);
      
    if (finalOptions.length < 2) return;
    setIsConfirmingSend(true);
  };

  const confirmSendPoll = () => {
    const finalOptions = structuredOptions
      .map(o => ({
        text: buildPollOptionText(o.date, o.startTime, o.durationHours, o.courtName),
        price2h: o.durationHours * defaultHourlyPrice
      }))
      .filter(o => o.text.trim().length > 0);
      
    handleSendPoll(pollQuestion, finalOptions, true);
    setIsConfirmingSend(false);
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-4 md:p-8 font-sans text-neutral-900">
      <div className="max-w-6xl mx-auto space-y-8">
        <Header user={user} setShowSettings={setShowSettings} />

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 min-h-[500px] flex flex-col overflow-hidden">
            <div className="flex border-b border-neutral-200 bg-neutral-50/50">
              <button
                onClick={() => setActiveTab('polls')}
                className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
                  activeTab === 'polls' 
                    ? 'border-indigo-600 text-indigo-600 bg-white' 
                    : 'border-transparent text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <Send className="w-4 h-4" />
                Active Polls
                {activePolls.length > 0 && (
                  <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-[10px]">
                    {activePolls.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
                  activeTab === 'create' 
                    ? 'border-indigo-600 text-indigo-600 bg-white' 
                    : 'border-transparent text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <Plus className="w-4 h-4" />
                Create Poll
              </button>
            </div>

            {activeTab === 'polls' ? (
              <ActivePollsTab
                activePolls={activePolls}
                refreshPolls={refreshPolls}
                isRefreshingPolls={isRefreshingPolls}
                setSelectedPollForDetails={setSelectedPollForDetails}
                removePoll={removePoll}
              />
            ) : (
              <div className="flex-1 p-6 flex flex-col gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-800 mb-1">Poll Question</label>
                  <input 
                    type="text" 
                    value={pollQuestion}
                    onChange={e => setPollQuestion(e.target.value)}
                    className="w-full p-3 bg-white border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-lg"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-3">
                     <label className="block text-sm font-medium text-neutral-800">Poll Options</label>
                  </div>

                  <div className="space-y-3">
                    <div className="hidden sm:grid grid-cols-[130px_1fr_80px_110px_60px_40px] items-end gap-2 px-3 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                      <div>Date</div>
                      <div>Start Time</div>
                      <div>Hours</div>
                      <div>Court Name</div>
                      <div>Price ($)</div>
                      <div></div>
                    </div>

                    {structuredOptions.map((opt, i) => (
                      <div key={opt.id} className="grid grid-cols-[1fr] sm:grid-cols-[130px_1fr_80px_110px_60px_40px] gap-3 sm:gap-2 p-4 sm:p-3 bg-neutral-50 rounded-xl border border-neutral-200 items-center transition-all hover:border-neutral-300 shadow-sm relative">
                        <div className="flex flex-col sm:block">
                          <label className="text-[10px] font-bold text-neutral-400 sm:hidden mb-1 uppercase tracking-wider">Date</label>
                          <input 
                            type="date" 
                            value={opt.date}
                            onChange={e => {
                              const newOpts = [...structuredOptions];
                              newOpts[i] = { ...newOpts[i], date: e.target.value };
                              setStructuredOptions(newOpts);
                            }}
                            className="w-full p-2 border border-neutral-300 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
                          />
                        </div>
                        
                        <div className="flex flex-col sm:block">
                          <label className="text-[10px] font-bold text-neutral-400 sm:hidden mb-1 uppercase tracking-wider">Start Time</label>
                          <input 
                            type="time" 
                            value={opt.startTime}
                            onChange={e => {
                              const newOpts = [...structuredOptions];
                              newOpts[i] = { ...newOpts[i], startTime: e.target.value };
                              setStructuredOptions(newOpts);
                            }}
                            className="w-full p-2 border border-neutral-300 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
                          />
                        </div>

                        <div className="flex flex-col sm:block">
                          <label className="text-[10px] font-bold text-neutral-400 sm:hidden mb-1 uppercase tracking-wider">Hours</label>
                          <select
                            value={opt.durationHours}
                            onChange={e => {
                              const newOpts = [...structuredOptions];
                              const dur = parseFloat(e.target.value);
                              newOpts[i] = { 
                                ...newOpts[i], 
                                durationHours: dur
                              };
                              setStructuredOptions(newOpts);
                            }}
                            className="w-full p-2 border border-neutral-300 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-sm bg-white"
                          >
                            <option value={1}>1h</option>
                            <option value={1.5}>1.5h</option>
                            <option value={2}>2h</option>
                            <option value={2.5}>2.5h</option>
                            <option value={3}>3h</option>
                            <option value={3.5}>3.5h</option>
                            <option value={4}>4h</option>
                          </select>
                        </div>

                        <div className="flex flex-col sm:block">
                          <label className="text-[10px] font-bold text-neutral-400 sm:hidden mb-1 uppercase tracking-wider">Court Name</label>
                          <select
                            value={opt.courtName}
                            onChange={e => {
                              const newOpts = [...structuredOptions];
                              newOpts[i] = { ...newOpts[i], courtName: e.target.value };
                              setStructuredOptions(newOpts);
                            }}
                            className="w-full p-2 border border-neutral-300 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-sm bg-white"
                          >
                            <option value="">Select court...</option>
                            <option value="VB1">VB1</option>
                            <option value="VB2">VB2</option>
                            <option value="VB3">VB3</option>
                            <option value="MS4">MS4</option>
                            <option value="MS5">MS5</option>
                            <option value="MS6">MS6</option>
                            <option value="MS7">MS7</option>
                            <option value="BBallA">BBallA</option>
                            <option value="BBallB">BBallB</option>
                          </select>
                        </div>

                        <div className="flex flex-col sm:block">
                          <label className="text-[10px] font-bold text-neutral-400 sm:hidden mb-1 uppercase tracking-wider">Price ($)</label>
                          <div className="w-full p-2 border border-transparent rounded-lg flex items-center bg-neutral-100/50 sm:bg-transparent min-h-[38px] text-sm font-medium text-indigo-700">
                            {opt.durationHours * defaultHourlyPrice}
                          </div>
                        </div>

                        {structuredOptions.length > 1 && (
                          <button 
                            onClick={() => setStructuredOptions(structuredOptions.filter((_, idx) => idx !== i))}
                            className="absolute sm:relative right-2 top-2 sm:right-auto sm:top-auto p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center"
                            title="Remove option"
                          >
                            <X className="w-5 h-5 sm:w-4 sm:h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {structuredOptions.length < 10 && (
                    <button 
                      onClick={() => setStructuredOptions([...structuredOptions, { id: Date.now().toString(), date: '', startTime: '20:00', durationHours: 2, courtName: '' }])}
                      className="mt-4 text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Empty Row
                    </button>
                  )}
                </div>

                <div className="pt-4 border-t border-neutral-100 flex items-center gap-4 mt-auto">
                  <button
                    onClick={handleSendPollSubmit}
                    disabled={isSendingPoll || !pollQuestion.trim() || structuredOptions.filter(o => o.date && o.startTime && o.courtName).length < 2 || !tgBotToken}
                    className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    {isSendingPoll ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send to Telegram
                      </>
                    )}
                  </button>
                  {!tgBotToken && (
                    <p className="text-xs text-red-500 font-medium max-w-[150px]">Please configure Telegram Settings first.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <SettingsModal
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        tgBotToken={tgBotToken}
        setTgBotToken={setTgBotToken}
        tgChatId={tgChatId}
        setTgChatId={setTgChatId}
        defaultHourlyPrice={defaultHourlyPrice}
        setDefaultHourlyPrice={setDefaultHourlyPrice}
        handleSaveSettings={handleSaveSettings}
      />

      <PollDetailsModal 
        selectedPollForDetails={selectedPollForDetails}
        setSelectedPollForDetails={setSelectedPollForDetails}
        togglePaidStatus={togglePaidStatus}
        updateUserPayment={updateUserPayment}
        addSummaryUser={addSummaryUser}
        removeSummaryUser={removeSummaryUser}
        editingLineup={editingLineup}
        setEditingLineup={setEditingLineup}
        handleSaveEditedLineup={() => selectedPollForDetails && editingLineup && handleSaveEditedLineup(selectedPollForDetails, editingLineup)}
        isSavingLineup={isSavingLineup}
        showPollDetails={showPollDetails}
        setShowPollDetails={setShowPollDetails}
        prepareLineups={(poll, targetVoterCounts) => prepareLineups(poll, targetVoterCounts, ignoreVoteLimit)}
        isSendingLineup={isSendingLineup}
        ignoreVoteLimit={ignoreVoteLimit}
        setIgnoreVoteLimit={setIgnoreVoteLimit}
        updateVoterAnswer={updateVoterAnswer}
        addVoterAnswer={addVoterAnswer}
        stopPoll={stopPoll}
        updateVoterOrder={updateVoterOrder}
      />

      <LineupPreviewModal 
        lineupPreviews={lineupPreviews}
        setLineupPreviews={setLineupPreviews}
        handleSendFinalLineups={() => selectedPollForDetails && lineupPreviews && handleSendFinalLineups(selectedPollForDetails, lineupPreviews)}
        isSendingLineup={isSendingLineup}
      />

      {isConfirmingSend && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-neutral-100 bg-neutral-50/50">
              <h3 className="text-lg font-bold text-neutral-900">Confirm Poll</h3>
              <button 
                onClick={() => setIsConfirmingSend(false)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors bg-white hover:bg-neutral-100 p-1.5 rounded-full border border-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6 bg-neutral-200/50">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-neutral-200">
                <h4 className="font-bold text-neutral-900 text-base mb-1">{pollQuestion}</h4>
                <p className="text-xs text-neutral-500 mb-4">Public Poll, Multiple Answers</p>
                <div className="space-y-3">
                  {structuredOptions
                    .map(o => buildPollOptionText(o.date, o.startTime, o.durationHours, o.courtName))
                    .filter(text => text.trim().length > 0)
                    .map((text, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-5 h-5 flex-shrink-0 border-2 border-neutral-300 rounded-md" />
                        <span className="text-sm font-medium text-neutral-800 break-words">{text}</span>
                      </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-neutral-100 flex gap-3">
              <button
                onClick={() => setIsConfirmingSend(false)}
                className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-medium transition-colors"
                disabled={isSendingPoll}
              >
                Cancel
              </button>
              <button
                onClick={confirmSendPoll}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                disabled={isSendingPoll}
              >
                {isSendingPoll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Yes, Send!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
