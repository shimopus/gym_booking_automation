import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { collection, doc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ActivePoll, PollOption, VoterInfo, SentSummary, SentLineup } from '../types';
import { savePollToFirebase, deletePollFromFirebase, saveLastUpdateId, saveRawUpdatesToFirebase } from '../services/firebaseService';

export function useTelegram(user: any, isAuthReady: boolean) {
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [defaultHourlyPrice, setDefaultHourlyPrice] = useState(110);
  const [lastUpdateId, setLastUpdateId] = useState(0);
  const [activePolls, setActivePolls] = useState<ActivePoll[]>([]);
  const [isRefreshingPolls, setIsRefreshingPolls] = useState(false);
  const [isSendingPoll, setIsSendingPoll] = useState(false);
  const [isSendingLineup, setIsSendingLineup] = useState(false);
  const [isSavingLineup, setIsSavingLineup] = useState(false);
  const [lineupPreviews, setLineupPreviews] = useState<{ optionIndex: number; text: string; users?: any[] }[] | null>(null);
  const originalTgBotTokenRef = useRef('');

  const [rawUpdatesByPoll, setRawUpdatesByPoll] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (!isAuthReady || !user) return;
    
    const unsubscribePolls = onSnapshot(collection(db, 'polls'), (snapshot) => {
      const polls = snapshot.docs.map(doc => doc.data() as ActivePoll);
      polls.sort((a, b) => b.createdAt - a.createdAt);
      setActivePolls(polls);
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'telegram'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.tgBotToken) {
          setTgBotToken(data.tgBotToken);
          originalTgBotTokenRef.current = data.tgBotToken;
        }
        if (data.tgChatId) setTgChatId(data.tgChatId);
        if (data.defaultHourlyPrice !== undefined) setDefaultHourlyPrice(data.defaultHourlyPrice);
        if (data.lastUpdateId !== undefined) setLastUpdateId(data.lastUpdateId);
      }
    });

    return () => {
      unsubscribePolls();
      unsubscribeSettings();
    };
  }, [isAuthReady, user]);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const activePollIds = activePolls.filter(p => !p.isStopped).map(p => p.id);
    const unsubscribes: (() => void)[] = [];

    activePollIds.forEach(pollId => {
      const q = query(collection(db, 'rawUpdates'), where('pollId', '==', pollId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const updates = snapshot.docs.map(doc => doc.data());
        setRawUpdatesByPoll(prev => ({
          ...prev,
          [pollId]: updates
        }));
      });
      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [activePolls.filter(p => !p.isStopped).map(p => p.id).join(','), isAuthReady, user]);


  const handleSendPoll = async (pollQuestion: string, pollOptions: Partial<PollOption>[], isBulkPoll: boolean) => {
    if (!tgBotToken || !tgChatId) return;
    
    setIsSendingPoll(true);
    try {
      const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendPoll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: tgChatId,
          question: pollQuestion,
          options: pollOptions.filter(opt => opt.text?.trim()).map(opt => opt.text || ''),
          is_anonymous: false,
          allows_multiple_answers: isBulkPoll
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.description || 'Failed to send poll');
      }

      const data = await response.json();
      const finalOptions = pollOptions.filter(opt => opt.text?.trim());

      const newPoll: ActivePoll = {
        id: data.result.poll.id,
        messageId: data.result.message_id,
        question: data.result.poll.question,
        options: data.result.poll.options.map((o: any, idx: number) => ({ 
          text: o.text, 
          price2h: finalOptions[idx]?.price2h
        })),
        createdAt: Date.now(),
        isStopped: false,
        voterAnswers: {}
      };

      await savePollToFirebase(newPoll);
      return true;
    } catch (err: any) {
      console.error('Telegram API Error:', err);
      alert(`Failed to send poll: ${err.message}`);
      return false;
    } finally {
      setIsSendingPoll(false);
    }
  };

  const activePollsRef = useRef<ActivePoll[]>([]);
  useEffect(() => {
    activePollsRef.current = activePolls;
  }, [activePolls]);

  const refreshPolls = useCallback(async () => {
    if (!tgBotToken || activePollsRef.current.length === 0) return;
    
    setIsRefreshingPolls(true);
    try {
      let offset = lastUpdateId ? lastUpdateId + 1 : 0;
      let allUpdates: any[] = [];
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/getUpdates?offset=${offset}&limit=100&allowed_updates=["poll","poll_answer"]`);
        if (!response.ok) throw new Error('Failed to fetch updates');
        
        const data = await response.json();
        console.log('Raw Telegram updates:', data);
        const updates = data.result || [];
        
        if (updates.length > 0) {
          allUpdates.push(...updates);
          offset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
        } else {
          hasMore = false;
        }
        
        if (updates.length < 100) {
          hasMore = false;
        }
      }
      
      if (allUpdates.length > 0) {
        await saveRawUpdatesToFirebase(allUpdates);
        const maxUpdateId = Math.max(...allUpdates.map((u: any) => u.update_id));
        setLastUpdateId(maxUpdateId);
        await saveLastUpdateId(maxUpdateId);
      }

      const pollUpdates = allUpdates
        .filter((u: any) => u.poll)
        .map((u: any) => u.poll);
        
      // Calculate next polls based on current activePolls and new polls from updates
      const nextPolls = [...activePollsRef.current];
      
      // Process poll updates to update existing polls or add new ones
      for (const pollUpdate of pollUpdates) {
        const existingPollIndex = nextPolls.findIndex(p => p.id === pollUpdate.id);
        if (existingPollIndex !== -1) {
          // Update existing poll
          const p = nextPolls[existingPollIndex];
          const isNewlyClosed = pollUpdate.is_closed && !p.isStopped;
          
          let finalVoterAnswers: { [userId: number]: VoterInfo } = p.voterAnswers || {};
          let finalOptions = pollUpdate.options.map((o: any) => {
            const existingOption = p.options.find((eo: any) => eo.text === o.text);
            return { 
              text: o.text, 
              price2h: existingOption?.price2h
            };
          });
          
          if (isNewlyClosed) {
            finalVoterAnswers = {};
            // Fetch all rawUpdates for this poll to compute final voterAnswers
            const q = query(collection(db, 'rawUpdates'), where('pollId', '==', p.id));
            const snapshot = await getDocs(q);
            const updates = snapshot.docs.map(doc => doc.data());
            
            const sortedUpdates = [...updates].sort((a, b) => (a.update_id || 0) - (b.update_id || 0));

            sortedUpdates.forEach(update => {
              if (update.poll_answer) {
                const au = update.poll_answer;
                if (au.option_ids.length === 0) {
                  delete finalVoterAnswers[au.user.id];
                } else {
                  finalVoterAnswers[au.user.id] = {
                    userId: au.user.id,
                    name: [au.user.first_name, au.user.last_name].filter(Boolean).join(' '),
                    username: au.user.username || null,
                    optionIds: au.option_ids,
                    votedAt: update.update_id
                  };
                }
              }
            });
          } else if (!p.isStopped) {
            finalVoterAnswers = {};
          }

          nextPolls[existingPollIndex] = {
            ...p,
            options: finalOptions,
            isStopped: pollUpdate.is_closed || p.isStopped || false,
            voterAnswers: finalVoterAnswers
          };
          
          // Remove computed counts to avoid unnecessary Firebase writes
          delete nextPolls[existingPollIndex].totalVoterCount;
        } else {
          // Add new poll
          nextPolls.push({
            id: pollUpdate.id,
            messageId: 0, // We don't have the messageId here
            question: pollUpdate.question,
            options: pollUpdate.options.map((o: any) => ({ text: o.text })),
            createdAt: Date.now(),
            isStopped: pollUpdate.is_closed || false,
            voterAnswers: {}
          });
        }
      }

      // Save modified polls to Firebase
      // onSnapshot will handle updating local state
      for (const p of nextPolls) {
        const prev = activePollsRef.current.find(old => old.id === p.id);
        if (JSON.stringify(prev) !== JSON.stringify(p)) {
          await savePollToFirebase(p);
        }
      }
    } catch (err: any) {
      console.error('Failed to refresh polls', err);
      if (err instanceof Error) {
        console.error('Error message:', err.message);
      }
    } finally {
      setIsRefreshingPolls(false);
    }
  }, [tgBotToken, lastUpdateId]);

  // Auto-refresh logic
  useEffect(() => {
    if (!tgBotToken || activePolls.length === 0) return;

    const interval = setInterval(() => {
      refreshPolls();
    }, 30000); // 30 seconds

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshPolls();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshPolls, tgBotToken, activePolls.length]);

  const togglePaidStatus = async (pollId: string, summaryIndex: number, userIndex: number) => {
    if (!tgBotToken) return;
    
    const poll = activePolls.find(p => p.id === pollId);
    if (!poll || !poll.sentSummaries) return;

    const summary = poll.sentSummaries[summaryIndex];
    const user = summary.users[userIndex];
    const newPaidStatus = !user.paid;

    // Update local state
    const nextPolls = activePolls.map(p => {
      if (p.id === pollId) {
        const nextSummaries = [...(p.sentSummaries || [])];
        const nextUsers = [...nextSummaries[summaryIndex].users];
        nextUsers[userIndex] = { ...nextUsers[userIndex], paid: newPaidStatus };
        
        // Rebuild the text
        let newText = `<b>💰 Summary Payments</b>\nДеньги переводим по Zelle: 6692045921\n\n`;
        nextUsers.forEach(u => {
          const mention = u.username 
            ? `@${u.username}` 
            : `<a href="tg://user?id=${u.userId}">${u.name}</a>`;
          const displayName = u.username ? `${u.name} (${mention})` : mention;
          const statusEmoji = u.paid ? ' ✅' : ' ❌';
          newText += `${displayName}: <b>$${u.total.toFixed(2)}</b>${statusEmoji}\n`;
        });
        
        if (summary.text.includes('⚠️ Note:')) {
           newText += `\n<i>⚠️ Note: Some sessions had missing price data. Totals might be incomplete.</i>`;
        }
        
        nextSummaries[summaryIndex] = { 
          ...nextSummaries[summaryIndex], 
          users: nextUsers,
          text: newText 
        };
        
        return { ...p, sentSummaries: nextSummaries };
      }
      return p;
    });

    setActivePolls(nextPolls);
    const updatedPoll = nextPolls.find(p => p.id === pollId);
    if (updatedPoll) savePollToFirebase(updatedPoll);
    
    try {
      const updatedSummary = nextPolls.find(p => p.id === pollId)?.sentSummaries?.[summaryIndex];
      if (updatedSummary) {
        await fetch(`https://api.telegram.org/bot${tgBotToken}/editMessageText`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: updatedSummary.chatId,
            message_id: updatedSummary.messageId,
            text: updatedSummary.text,
            parse_mode: 'HTML'
          })
        });
      }
    } catch (err) {
      console.error('Failed to update Telegram message:', err);
    }
  };

  const removePoll = (id: string) => {
    setActivePolls(prev => prev.filter(p => p.id !== id));
    deletePollFromFirebase(id);
  };

  const handleSaveEditedLineup = async (poll: ActivePoll, editingLineup: { index: number; text: string }) => {
    if (!tgBotToken || !poll.sentLineups) return;
    
    setIsSavingLineup(true);
    try {
      const lineup = poll.sentLineups[editingLineup.index];
      
      const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: lineup.chatId,
          message_id: lineup.messageId,
          text: editingLineup.text,
          parse_mode: 'HTML'
        })
      });
      
      if (!response.ok) throw new Error('Failed to edit message on Telegram');
      
      const pollId = poll.id;
      const nextPolls = activePolls.map(p => {
        if (p.id === pollId && p.sentLineups) {
          const nextLineups = [...p.sentLineups];
          nextLineups[editingLineup.index] = {
            ...nextLineups[editingLineup.index],
            text: editingLineup.text
          };
          return { ...p, sentLineups: nextLineups };
        }
        return p;
      });
      
      setActivePolls(nextPolls);
      const updatedPoll = nextPolls.find(p => p.id === pollId);
      if (updatedPoll) savePollToFirebase(updatedPoll);
      
      return true;
    } catch (err: any) {
      console.error('Failed to edit lineup:', err);
      alert(`Error: ${err.message}`);
      return false;
    } finally {
      setIsSavingLineup(false);
    }
  };

  const handleSendFinalLineups = async (poll: ActivePoll, previews: { optionIndex: number; text: string; users?: any[] }[]) => {
    if (!tgBotToken || !tgChatId) return;
    
    setIsSendingLineup(true);
    try {
      const newSummaries: SentSummary[] = [];
      const newLineups: SentLineup[] = [];
      
      for (const preview of previews) {
        const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: preview.text,
            parse_mode: 'HTML'
          })
        });
        
        if (!response.ok) throw new Error('Failed to send message to Telegram');
        const data = await response.json();
        
        if (preview.optionIndex === -1 && preview.users) {
          newSummaries.push({
            messageId: data.result.message_id,
            chatId: data.result.chat.id,
            text: preview.text,
            users: preview.users,
            timestamp: Date.now()
          });
        } else {
          newLineups.push({
            optionIndex: preview.optionIndex,
            messageId: data.result.message_id,
            chatId: data.result.chat.id,
            text: preview.text,
            timestamp: Date.now()
          });
        }
      }

      const pollId = poll.id;
      const nextPolls = activePolls.map(p => {
        if (p.id === pollId) {
          return {
            ...p,
            sentSummaries: [...(p.sentSummaries || []), ...newSummaries],
            sentLineups: [...(p.sentLineups || []), ...newLineups]
          };
        }
        return p;
      });

      setActivePolls(nextPolls);
      const updatedPoll = nextPolls.find(p => p.id === pollId);
      if (updatedPoll) savePollToFirebase(updatedPoll);
      
      setLineupPreviews(null);
      return true;
    } catch (err: any) {
      console.error('Failed to send lineups:', err);
      alert(`Error: ${err.message}`);
      return false;
    } finally {
      setIsSendingLineup(false);
    }
  };

  const prepareLineups = (poll: ActivePoll, targetVoterCounts: Record<number, number>, ignoreVoteLimit: boolean) => {
    if (!poll.voterAnswers) return;
    
    const allVoters = (Object.values(poll.voterAnswers) as VoterInfo[])
      .sort((a, b) => a.votedAt - b.votedAt);

    const previews: { optionIndex: number; text: string; users?: any[] }[] = [];
    const userCosts: { [userId: number]: { name: string; username?: string; total: number } } = {};
    let hasMissingPrices = false;

    for (let i = 0; i < poll.options.length; i++) {
      const option = poll.options[i];
      let optionVoters = allVoters.filter(v => v.optionIds.includes(i));

      // Respect manual reordering if it exists
      const order = poll.optionVoterOrder?.[i];
      if (order) {
        optionVoters.sort((a, b) => {
          const aIdx = order.indexOf(a.userId);
          const bIdx = order.indexOf(b.userId);
          if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
          if (aIdx !== -1) return -1;
          if (bIdx !== -1) return 1;
          return a.votedAt - b.votedAt;
        });
      }

      const targetCount = targetVoterCounts[i] || 12;

      // Only include the first targetVoterCount voters for each option
      const limitedVoters = optionVoters.slice(0, targetCount);

      if (limitedVoters.length >= targetCount || (ignoreVoteLimit && limitedVoters.length > 0)) {
        let message = `<b>${option.text}</b>\n\n`;
        
        const sessionPrice = option.price2h !== undefined 
          ? option.price2h
          : undefined;

        const pricePerVote = sessionPrice !== undefined 
          ? Math.ceil((sessionPrice / limitedVoters.length) / 0.5) * 0.5 
          : 0;

        limitedVoters.forEach((v, idx) => {
          const mention = v.username 
            ? `@${v.username}` 
            : `<a href="tg://user?id=${v.userId}">${v.name}</a>`;
          const displayName = v.username ? `${v.name} (${mention})` : mention;
          message += `${idx + 1}. ${displayName}\n`;

          if (!userCosts[v.userId]) {
            userCosts[v.userId] = { name: v.name, username: v.username, total: 0 };
          }
          if (sessionPrice !== undefined) {
            userCosts[v.userId].total += pricePerVote;
          } else {
            hasMissingPrices = true;
          }
        });
        previews.push({ optionIndex: i, text: message });
      }
    }

    if (Object.keys(userCosts).length > 0) {
      let summary = `<b>💰 Summary Payments</b>\nДеньги переводим по Zelle: 6692045921\n\n`;
      const sortedUsers = Object.entries(userCosts)
        .map(([userId, data]) => ({ userId: Number(userId), ...data }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const usersForSummary = sortedUsers.map(u => {
        const roundedTotal = u.total; // Already rounded per vote
        const mention = u.username 
          ? `@${u.username}` 
          : `<a href="tg://user?id=${u.userId}">${u.name}</a>`;
        
        const displayName = u.username ? `${u.name} (${mention})` : mention;
        const isShimopus = u.username?.toLowerCase() === 'shimopus';
        const statusEmoji = isShimopus ? ' ✅' : ' ❌';
        summary += `${displayName}: <b>$${roundedTotal.toFixed(2)}</b>${statusEmoji}\n`;
        
        return {
          userId: u.userId,
          name: u.name,
          username: u.username,
          total: roundedTotal,
          paid: isShimopus
        };
      });
      
      if (hasMissingPrices) {
        summary += `\n<i>⚠️ Note: Some sessions had missing price data. Totals might be incomplete.</i>`;
      }
      
      previews.push({ optionIndex: -1, text: summary, users: usersForSummary });
    }

    if (previews.length === 0) {
      alert(ignoreVoteLimit ? 'No sessions have any votes yet.' : 'No sessions have reached their required vote minimums yet.');
      return;
    }

    setLineupPreviews(previews);
  };

  const updateVoterAnswer = async (pollId: string, userId: number, newOptionIds: number[], newOptionVoterOrder?: { [optionId: number]: number[] }) => {
    const poll = activePolls.find(p => p.id === pollId);
    if (!poll) return;
    
    if (!poll.isStopped) {
      console.warn("Manual updates can only happen on stopped polls.");
      return;
    }

    const updatedPoll = { ...poll };
    const currentVoterAnswers = { ...(updatedPoll.voterAnswers || {}) };
    
    if (currentVoterAnswers[userId]) {
      currentVoterAnswers[userId] = {
        ...currentVoterAnswers[userId],
        optionIds: newOptionIds
      };
    }
    
    updatedPoll.voterAnswers = currentVoterAnswers;
    if (newOptionVoterOrder) {
      updatedPoll.optionVoterOrder = newOptionVoterOrder;
    }
    await savePollToFirebase(updatedPoll);
  };

  const addVoterAnswer = async (pollId: string, voter: VoterInfo) => {
    const poll = activePolls.find(p => p.id === pollId);
    if (!poll) return;

    if (!poll.isStopped) {
      console.warn("Manual updates can only happen on stopped polls.");
      return;
    }

    const updatedPoll = { ...poll };
    const currentVoterAnswers = { ...(updatedPoll.voterAnswers || {}) };
    
    currentVoterAnswers[voter.userId] = voter;
    
    updatedPoll.voterAnswers = currentVoterAnswers;
    await savePollToFirebase(updatedPoll);
  };

  const stopPoll = async (pollId: string) => {
    const poll = activePolls.find(p => p.id === pollId);
    if (!poll) return;

    try {
      const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/stopPoll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: tgChatId,
          message_id: poll.messageId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.description || 'Failed to stop poll on Telegram');
      }
    } catch (err: any) {
      console.error('Telegram API Error:', err);
      alert(`Failed to stop poll on Telegram: ${err.message}`);
      return;
    }

    // Refresh poll updates the last time to get the final state
    await refreshPolls();

    // Build the poll from rawUpdates and store it in the polls collection
    const q = query(collection(db, 'rawUpdates'), where('pollId', '==', pollId));
    const snapshot = await getDocs(q);
    const updates = snapshot.docs.map(doc => doc.data());

    const sortedUpdates = [...updates].sort((a, b) => (a.update_id || 0) - (b.update_id || 0));

    const finalVoterAnswers: { [userId: number]: VoterInfo } = {};
    sortedUpdates.forEach(update => {
      if (update.poll_answer) {
        const au = update.poll_answer;
        if (au.option_ids.length === 0) {
          delete finalVoterAnswers[au.user.id];
        } else {
          finalVoterAnswers[au.user.id] = {
            userId: au.user.id,
            name: [au.user.first_name, au.user.last_name].filter(Boolean).join(' '),
            username: au.user.username || null,
            optionIds: au.option_ids,
            votedAt: update.update_id
          };
        }
      }
    });

    const updatedPoll = { 
      ...poll, 
      isStopped: true,
      voterAnswers: finalVoterAnswers
    };
    await savePollToFirebase(updatedPoll);
  };

  const updateVoterOrder = async (pollId: string, optionId: number, newVoterIds: number[]) => {
    const poll = activePolls.find(p => p.id === pollId);
    if (!poll) return;

    if (!poll.isStopped) {
      console.warn("Manual updates can only happen on stopped polls.");
      return;
    }

    const updatedPoll = { ...poll };
    updatedPoll.optionVoterOrder = {
      ...(updatedPoll.optionVoterOrder || {}),
      [optionId]: newVoterIds
    };
    await savePollToFirebase(updatedPoll);
  };

  const pollsWithAnswers = useMemo(() => activePolls.map(poll => {
    let voterAnswers = poll.voterAnswers || {};

    if (!poll.isStopped) {
      const updates = rawUpdatesByPoll[poll.id] || [];
      voterAnswers = {};

      // Sort updates by update_id to process them in order
      const sortedUpdates = [...updates].sort((a, b) => (a.update_id || 0) - (b.update_id || 0));

      sortedUpdates.forEach(update => {
        if (update.poll_answer) {
          const au = update.poll_answer;
          if (au.option_ids.length === 0) {
            delete voterAnswers[au.user.id];
          } else {
            voterAnswers[au.user.id] = {
              userId: au.user.id,
              name: [au.user.first_name, au.user.last_name].filter(Boolean).join(' '),
              username: au.user.username || null,
              optionIds: au.option_ids,
              votedAt: update.update_id
            };
          }
        }
      });
    }

    const optionCounts: { [optionIndex: number]: number } = {};
    let totalVoterCount = 0;

    (Object.values(voterAnswers) as VoterInfo[]).forEach(voter => {
      totalVoterCount++;
      voter.optionIds.forEach(optId => {
        optionCounts[optId] = (optionCounts[optId] || 0) + 1;
      });
    });

    const updatedOptions = poll.options.map((opt, index) => ({
      ...opt,
      voter_count: optionCounts[index] || 0
    }));

    return {
      ...poll,
      options: updatedOptions,
      totalVoterCount,
      voterAnswers
    };
  }), [activePolls, rawUpdatesByPoll]);

  return {
    tgBotToken,
    setTgBotToken,
    tgChatId,
    setTgChatId,
    defaultHourlyPrice,
    setDefaultHourlyPrice,
    activePolls: pollsWithAnswers,
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
    prepareLineups,
    updateVoterAnswer,
    addVoterAnswer,
    stopPoll,
    updateVoterOrder
  };
}
