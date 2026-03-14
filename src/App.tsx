import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, CalendarDays, Clock, MapPin, ChevronDown, ChevronUp, ArrowUpDown, Filter, CheckSquare, Square, X, Image as ImageIcon, Loader2, Download, Send, Settings } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { auth, signIn, logOut } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { PollOption, ActivePoll, MergedSlot } from './types';
import { formatPollOption, getBest2hWindow, getWeekId, calculateDuration } from './utils';
import { SettingsModal } from './components/SettingsModal';
import { Header } from './components/Header';
import { ActivePollsTab } from './components/ActivePollsTab';
import { PollModal } from './components/PollModal';
import { PollDetailsModal } from './components/PollDetailsModal';
import { LineupPreviewModal } from './components/LineupPreviewModal';
import { ResultsTable } from './components/ResultsTable';
import { FilterDropdown } from './components/FilterDropdown';
import { useTelegram } from './hooks/useTelegram';
import { useSportsHouse } from './hooks/useSportsHouse';
import { useMigration } from './hooks/useMigration';
import { useFilters } from './hooks/useFilters';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<'polls' | 'slots'>('polls');
  const [showSettings, setShowSettings] = useState(false);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [username, setUsername] = useState(localStorage.getItem('sportsHouseUsername') || '');
  const [password, setPassword] = useState(localStorage.getItem('sportsHousePassword') || '');
  const [rememberMe, setRememberMe] = useState(localStorage.getItem('sportsHouseRemember') === 'true');
  const [pollSlot, setPollSlot] = useState<MergedSlot | null>(null);
  const [isBulkPoll, setIsBulkPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<PollOption[]>([]);
  const [selectedPollForDetails, setSelectedPollForDetails] = useState<ActivePoll | null>(null);
  const [editingLineup, setEditingLineup] = useState<{ index: number; text: string } | null>(null);
  const [showPollDetails, setShowPollDetails] = useState(true);
  const [ignoreVoteLimit, setIgnoreVoteLimit] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isImageCopied, setIsImageCopied] = useState(false);

  const {
    tgBotToken,
    setTgBotToken,
    tgChatId,
    setTgChatId,
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
    removePoll,
    handleSaveEditedLineup,
    handleSendFinalLineups,
    prepareLineups
  } = useTelegram(user, isAuthReady);

  const {
    isFetching,
    fetchProgress,
    results,
    error,
    setError,
    fetchFromSportsHouse,
    setResults
  } = useSportsHouse();

  useMigration(user, isAuthReady);

  const {
    sortField,
    sortDirection,
    selectedCourts,
    selectedRows,
    setSelectedRows,
    uniqueCourts,
    bballCourts,
    otherCourts,
    displayResults,
    toggleCourt,
    toggleGroup,
    selectAll,
    clearAll,
    handleSort
  } = useFilters(results);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const filterRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopyImage = async () => {
    if (!tableRef.current) return;
    try {
      setIsGeneratingImage(true);
      const blob = await htmlToImage.toBlob(tableRef.current, {
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });
      
      if (blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setIsImageCopied(true);
        setTimeout(() => setIsImageCopied(false), 2000);
      }
    } catch (err) {
      console.error("Failed to copy image", err);
      alert("Failed to copy image to clipboard. Your browser might not support this feature.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSaveSettings = async () => {
    if (user) {
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const { db } = await import('./firebase');
        await setDoc(doc(db, 'settings', 'telegram'), {
          tgBotToken,
          tgChatId,
        }, { merge: true });
      } catch (err) {
        console.error('Failed to save settings to Firebase', err);
      }
    }
    
    if (rememberMe) {
      localStorage.setItem('sportsHouseUsername', username);
      localStorage.setItem('sportsHousePassword', password);
      localStorage.setItem('sportsHouseRemember', 'true');
    } else {
      localStorage.removeItem('sportsHouseUsername');
      localStorage.removeItem('sportsHousePassword');
      localStorage.removeItem('sportsHouseRemember');
    }
    
    setShowSettings(false);
  };

  const openPollModal = (slot: MergedSlot) => {
    if (!tgBotToken || !tgChatId) {
      setShowSettings(true);
      return;
    }
    const { start, end } = getBest2hWindow(slot.start, slot.end);
    setPollSlot(slot);
    setIsBulkPoll(false);
    setPollQuestion("Кто готов закоммититься на зал - голосуем! 🏐");
    setPollOptions([{
      text: formatPollOption(start, end, slot.resourceName),
      price2h: slot.price2h
    }]);
  };

  const openBulkPollModal = () => {
    if (!tgBotToken || !tgChatId) {
      setShowSettings(true);
      return;
    }
    
    const selectedSlots = displayResults.filter((_, idx) => selectedRows.has(idx));
    if (selectedSlots.length === 0) return;

    setIsBulkPoll(true);
    setPollSlot(selectedSlots[0]);
    setPollQuestion("Кто готов закоммититься на зал - голосуем! 🏐");
    
    const options = selectedSlots.map(slot => {
      const { start, end } = getBest2hWindow(slot.start, slot.end);
      return {
        text: formatPollOption(start, end, slot.resourceName),
        price2h: slot.price2h
      };
    });
    
    setPollOptions(options);
  };

  const handleFetchFromSportsHouse = async () => {
    if (rememberMe) {
      localStorage.setItem('sportsHouseUsername', username);
      localStorage.setItem('sportsHousePassword', password);
      localStorage.setItem('sportsHouseRemember', 'true');
    } else {
      localStorage.removeItem('sportsHouseUsername');
      localStorage.removeItem('sportsHousePassword');
      localStorage.removeItem('sportsHouseRemember');
    }
    
    await fetchFromSportsHouse(username, password, startDate, endDate, rememberMe);
  };

  const rowSpans = new Array(displayResults.length).fill(1);
  for (let i = 0; i < displayResults.length; i++) {
    if (rowSpans[i] === 0) continue;
    let span = 1;
    for (let j = i + 1; j < displayResults.length; j++) {
      if (displayResults[i].dateStr === displayResults[j].dateStr) {
        span++;
        rowSpans[j] = 0;
      } else {
        break;
      }
    }
    rowSpans[i] = span;
  }

  const weekColors = new Map<string, boolean>();
  const uniqueWeekIds = Array.from(new Set<string>(displayResults.map(r => getWeekId(r.start)))).sort();
  uniqueWeekIds.forEach((weekId, index) => {
    weekColors.set(weekId, index % 2 === 0);
  });

  const renderSortIcon = (field: 'date' | 'weekday') => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-neutral-300" />;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4 text-indigo-500" /> : <ChevronDown className="w-4 h-4 text-indigo-500" />;
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-4 md:p-8 font-sans text-neutral-900">
      <div className="max-w-6xl mx-auto space-y-8">
        <Header user={user} setShowSettings={setShowSettings} />

        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 border border-red-100">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 min-h-[500px] flex flex-col overflow-hidden">
            {/* Tab Navigation */}
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
                onClick={() => setActiveTab('slots')}
                className={`flex-1 py-4 text-sm font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
                  activeTab === 'slots' 
                    ? 'border-indigo-600 text-indigo-600 bg-white' 
                    : 'border-transparent text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Available Slots
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
              <div className="flex-1 flex flex-col">
                <div className="bg-neutral-50 border-b border-neutral-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (!username || !password) {
                          setShowSettings(true);
                        } else {
                          handleFetchFromSportsHouse();
                        }
                      }}
                      disabled={isFetching}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50 font-medium"
                    >
                      {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      <span>{isFetching ? 'Fetching...' : 'Fetch Latest Availability'}</span>
                    </button>
                  </div>
                  
                  <div className="text-xs text-neutral-500 flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isFetching ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                    {isFetching ? (fetchProgress || 'Syncing with SportsHouse...') : 'System Ready'}
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-medium">Available Slots</h2>
                      {results.length > 0 && (
                        <span className="bg-indigo-50 text-indigo-700 py-1 px-3 rounded-full text-sm font-medium">
                          {displayResults.length} {displayResults.length !== results.length ? `of ${results.length} ` : ''}slots found
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 relative">
                      {results.length > 0 && (
                        <>
                          <FilterDropdown 
                            isOpen={isFilterOpen}
                            setIsOpen={setIsFilterOpen}
                            selectedCourts={selectedCourts}
                            uniqueCourts={uniqueCourts}
                            bballCourts={bballCourts}
                            otherCourts={otherCourts}
                            toggleCourt={toggleCourt}
                            toggleGroup={toggleGroup}
                            selectAll={selectAll}
                            clearAll={clearAll}
                          />

                          <button
                            onClick={handleCopyImage}
                            disabled={isGeneratingImage || isImageCopied}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Copy table as image"
                          >
                            {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : (isImageCopied ? <CheckSquare className="w-4 h-4 text-green-600" /> : <ImageIcon className="w-4 h-4" />)}
                            <span className="text-sm font-medium hidden sm:inline">{isGeneratingImage ? 'Copying...' : (isImageCopied ? 'Copied!' : 'Copy Image')}</span>
                          </button>

                          {selectedRows.size > 0 && (
                            <button
                              onClick={openBulkPollModal}
                              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                              <Send className="w-4 h-4" />
                              <span className="text-sm font-medium">Create Group Poll ({selectedRows.size})</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-6 min-h-0">
                    <div className="flex-1 overflow-hidden flex flex-col">
                      <ResultsTable 
                        results={results}
                        displayResults={displayResults}
                        tableRef={tableRef}
                        sortField={sortField}
                        handleSort={handleSort}
                        renderSortIcon={renderSortIcon}
                        selectedRows={selectedRows}
                        setSelectedRows={setSelectedRows}
                        rowSpans={rowSpans}
                        weekColors={weekColors}
                        calculateDuration={calculateDuration}
                      />
                    </div>
                  </div>
                </div>
          </div>
        )}
      </div>
    </div>
  </div>

      <SettingsModal
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        rememberMe={rememberMe}
        setRememberMe={setRememberMe}
        tgBotToken={tgBotToken}
        setTgBotToken={setTgBotToken}
        tgChatId={tgChatId}
        setTgChatId={setTgChatId}
        handleSaveSettings={handleSaveSettings}
        handleFetchFromSportsHouse={handleFetchFromSportsHouse}
        isFetching={isFetching}
      />

        <PollModal 
          pollSlot={pollSlot}
          setPollSlot={setPollSlot}
          isBulkPoll={isBulkPoll}
          pollQuestion={pollQuestion}
          setPollQuestion={setPollQuestion}
          pollOptions={pollOptions}
          setPollOptions={setPollOptions}
          handleSendPoll={() => handleSendPoll(pollQuestion, pollOptions, isBulkPoll)}
          isSendingPoll={isSendingPoll}
        />
        <PollDetailsModal 
          selectedPollForDetails={selectedPollForDetails}
          setSelectedPollForDetails={setSelectedPollForDetails}
          togglePaidStatus={togglePaidStatus}
          editingLineup={editingLineup}
          setEditingLineup={setEditingLineup}
          handleSaveEditedLineup={() => selectedPollForDetails && editingLineup && handleSaveEditedLineup(selectedPollForDetails, editingLineup)}
          isSavingLineup={isSavingLineup}
          showPollDetails={showPollDetails}
          setShowPollDetails={setShowPollDetails}
          prepareLineups={(poll) => prepareLineups(poll, ignoreVoteLimit)}
          isSendingLineup={isSendingLineup}
          ignoreVoteLimit={ignoreVoteLimit}
          setIgnoreVoteLimit={setIgnoreVoteLimit}
        />

        <LineupPreviewModal 
          lineupPreviews={lineupPreviews}
          setLineupPreviews={setLineupPreviews}
          handleSendFinalLineups={() => selectedPollForDetails && lineupPreviews && handleSendFinalLineups(selectedPollForDetails, lineupPreviews)}
          isSendingLineup={isSendingLineup}
        />
    </div>
  );
}
