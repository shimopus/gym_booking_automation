import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { ActivePoll, PollOption, VoterInfo, SentSummary, SentLineup } from '../types';
import { savePollToFirebase, deletePollFromFirebase, saveLastUpdateId } from '../services/firebaseService';

export function useTelegram(user: any, isAuthReady: boolean) {
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [lastUpdateId, setLastUpdateId] = useState(0);
  const [activePolls, setActivePolls] = useState<ActivePoll[]>([]);
  const [isRefreshingPolls, setIsRefreshingPolls] = useState(false);
  const [isSendingPoll, setIsSendingPoll] = useState(false);
  const [isSendingLineup, setIsSendingLineup] = useState(false);
  const [isSavingLineup, setIsSavingLineup] = useState(false);
  const [lineupPreviews, setLineupPreviews] = useState<{ optionIndex: number; text: string; users?: any[] }[] | null>(null);
  const originalTgBotTokenRef = useRef('');

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
        if (data.lastUpdateId !== undefined) setLastUpdateId(data.lastUpdateId);
      }
    });

    return () => {
      unsubscribePolls();
      unsubscribeSettings();
    };
  }, [isAuthReady, user]);

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
          voter_count: o.voter_count,
          price2h: finalOptions[idx]?.price2h
        })),
        totalVoterCount: data.result.poll.total_voter_count,
        createdAt: Date.now()
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

  const refreshPolls = useCallback(async () => {
    if (!tgBotToken || activePolls.length === 0) return;
    
    setIsRefreshingPolls(true);
    try {
      const offset = lastUpdateId ? lastUpdateId + 1 : 0;
      const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/getUpdates?offset=${offset}&limit=100&allowed_updates=["poll","poll_answer"]`);
      if (!response.ok) throw new Error('Failed to fetch updates');
      
      const data = await response.json();
      const updates = data.result || [];
      
      if (updates.length > 0) {
        const maxUpdateId = Math.max(...updates.map((u: any) => u.update_id));
        setLastUpdateId(maxUpdateId);
        await saveLastUpdateId(maxUpdateId);
      }

      const pollUpdates = updates
        .filter((u: any) => u.poll)
        .map((u: any) => u.poll);

      const pollAnswerUpdates = updates
        .filter((u: any) => u.poll_answer)
        .map((u: any) => u.poll_answer);
        
      setActivePolls(prevPolls => {
        const nextPolls = prevPolls.map(p => {
          let updatedPoll = { ...p };
          
          const pollUpdate = pollUpdates.find((up: any) => up.id === p.id);
          if (pollUpdate) {
            updatedPoll.options = pollUpdate.options.map((o: any) => {
              const existingOption = p.options.find((eo: any) => eo.text === o.text);
              return { 
                text: o.text, 
                voter_count: o.voter_count,
                price2h: existingOption?.price2h
              };
            });
            updatedPoll.totalVoterCount = pollUpdate.total_voter_count;
          }

          const answersForThisPoll = pollAnswerUpdates.filter((au: any) => au.poll_id === p.id);
          if (answersForThisPoll.length > 0) {
            const currentVoterAnswers = { ...(updatedPoll.voterAnswers || {}) };
            const batchTime = Date.now();
            answersForThisPoll.forEach((au: any, index: number) => {
              if (au.option_ids.length === 0) {
                delete currentVoterAnswers[au.user.id];
              } else {
                currentVoterAnswers[au.user.id] = {
                  userId: au.user.id,
                  name: [au.user.first_name, au.user.last_name].filter(Boolean).join(' '),
                  username: au.user.username,
                  optionIds: au.option_ids,
                  votedAt: au.date ? au.date * 1000 : batchTime + index
                };
              }
            });
            updatedPoll.voterAnswers = currentVoterAnswers;
          }

          return updatedPoll;
        });

        // Save modified polls to Firebase
        nextPolls.forEach(p => {
          const prev = prevPolls.find(old => old.id === p.id);
          if (JSON.stringify(prev) !== JSON.stringify(p)) {
            savePollToFirebase(p);
          }
        });
        
        return nextPolls;
      });
    } catch (err) {
      console.error('Failed to refresh polls', err);
    } finally {
      setIsRefreshingPolls(false);
    }
  }, [tgBotToken, activePolls.length, lastUpdateId]);

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
        let newText = `<b>💰 Summary Payments</b>\n\n`;
        nextUsers.forEach(u => {
          const mention = u.username 
            ? `@${u.username.replace(/_/g, '\\_')}` 
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

  const prepareLineups = (poll: ActivePoll, ignoreVoteLimit: boolean) => {
    if (!poll.voterAnswers) return;
    
    const allVoters = (Object.values(poll.voterAnswers) as VoterInfo[])
      .sort((a, b) => a.votedAt - b.votedAt);

    const previews: { optionIndex: number; text: string; users?: any[] }[] = [];
    const userCosts: { [userId: number]: { name: string; username?: string; total: number } } = {};
    let hasMissingPrices = false;

    for (let i = 0; i < poll.options.length; i++) {
      const option = poll.options[i];
      const optionVoters = allVoters.filter(v => v.optionIds.includes(i));

      if (optionVoters.length >= 12 || (ignoreVoteLimit && optionVoters.length > 0)) {
        let message = `<b>${option.text}</b>\n\n`;
        optionVoters.forEach((v, idx) => {
          const mention = v.username 
            ? `@${v.username.replace(/_/g, '\\_')}` 
            : `<a href="tg://user?id=${v.userId}">${v.name}</a>`;
          const displayName = v.username ? `${v.name} (${mention})` : mention;
          message += `${idx + 1}. ${displayName}\n`;

          if (!userCosts[v.userId]) {
            userCosts[v.userId] = { name: v.name, username: v.username, total: 0 };
          }
          if (option.price2h !== undefined) {
            userCosts[v.userId].total += option.price2h / optionVoters.length;
          } else {
            hasMissingPrices = true;
          }
        });
        previews.push({ optionIndex: i, text: message });
      }
    }

    if (Object.keys(userCosts).length > 0) {
      let summary = `<b>💰 Summary Payments</b>\n\n`;
      const sortedUsers = Object.entries(userCosts)
        .map(([userId, data]) => ({ userId: Number(userId), ...data }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const usersForSummary = sortedUsers.map(u => {
        const roundedTotal = Math.ceil(u.total * 2) / 2;
        const mention = u.username 
          ? `@${u.username.replace(/_/g, '\\_')}` 
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
      alert(ignoreVoteLimit ? 'No sessions have any votes yet.' : 'No sessions have reached the 12 vote minimum yet.');
      return;
    }

    setLineupPreviews(previews);
  };

  return {
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
  };
}
