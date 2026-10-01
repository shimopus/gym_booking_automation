import React, { useState, useRef, useEffect } from 'react';
import { 
  Edit3, 
  Send, 
  Check, 
  AlertCircle, 
  Loader2, 
  Link as LinkIcon, 
  ExternalLink, 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  Code, 
  FileCode, 
  Eye, 
  RotateCcw, 
  Sparkles, 
  Info, 
  CheckCircle2, 
  User, 
  History,
  X,
  Trash2
} from 'lucide-react';
import { telegramEntitiesToHtml } from '../utils/telegramFormat';
import { ActivePoll } from '../types';

interface TelegramMessageEditorProps {
  tgBotToken: string;
  tgChatId: string;
  activePolls?: ActivePoll[];
}

export function TelegramMessageEditor({ tgBotToken, tgChatId, activePolls }: TelegramMessageEditorProps) {
  const [linkInput, setLinkInput] = useState('');
  const [targetChatId, setTargetChatId] = useState(tgChatId || '');
  const [targetMessageId, setTargetMessageId] = useState<number | ''>('');
  const [messageText, setMessageText] = useState('');
  
  const [isFetching, setIsFetching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [fetchNotice, setFetchNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ messageId: number; time: string } | null>(null);
  
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [selectedRecentId, setSelectedRecentId] = useState('');
  const [lastClearedText, setLastClearedText] = useState<string | null>(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [linkDialog, setLinkDialog] = useState<{ type: 'url' | 'user'; value: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Stored history of edited/fetched messages in localStorage
  const [editorHistory, setEditorHistory] = useState<{ id: string; label: string; shortType: string; messageId: number; chatId: string; text?: string; date: number }[]>(() => {
    try {
      const raw = localStorage.getItem('tg_editor_history');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  });

  const saveToEditorHistory = (item: { messageId: number; chatId: string; text?: string; label?: string; shortType?: string }) => {
    setEditorHistory(prev => {
      const filtered = prev.filter(p => !(p.messageId === item.messageId && p.chatId === item.chatId));
      const newItem = {
        id: `hist-${item.chatId}-${item.messageId}`,
        label: item.label || `Message #${item.messageId} (${item.chatId})`,
        shortType: item.shortType || 'Message',
        messageId: item.messageId,
        chatId: item.chatId,
        text: item.text,
        date: Date.now()
      };
      const updated = [newItem, ...filtered].slice(0, 30);
      try {
        localStorage.setItem('tg_editor_history', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleClearHistory = () => {
    setEditorHistory([]);
    try {
      localStorage.removeItem('tg_editor_history');
    } catch (e) {}
    setConfirmClearHistory(false);
  };

  // Immediate Clear with Undo capability
  const handleClearText = () => {
    if (!messageText) return;
    setLastClearedText(messageText);
    setMessageText('');
    setError(null);
    setSuccessInfo(null);
    setFetchNotice('Editor text cleared.');
  };

  const handleUndoClear = () => {
    if (lastClearedText !== null) {
      setMessageText(lastClearedText);
      setLastClearedText(null);
      setFetchNotice('Restored cleared text.');
    }
  };

  const handleResetAll = () => {
    if (messageText) {
      setLastClearedText(messageText);
    }
    setMessageText('');
    setLinkInput('');
    setTargetMessageId('');
    setSelectedRecentId('');
    setError(null);
    setSuccessInfo(null);
    setFetchNotice('Cleared editor and reset message target.');
  };

  // Combine messages from activePolls, cached polls, and editorHistory
  const allRecentMessages = React.useMemo(() => {
    const map = new Map<string, { id: string; label: string; shortType: string; messageId: number; chatId: string; text?: string; date: number }>();

    // 1. From activePolls
    if (activePolls && activePolls.length > 0) {
      activePolls.forEach(poll => {
        if (poll.sentSummaries) {
          poll.sentSummaries.forEach((s, idx) => {
            const key = `${s.chatId}-${s.messageId}`;
            map.set(key, {
              id: `summary-${poll.id}-${idx}`,
              label: `💰 Payment Summary (Msg #${s.messageId}) - ${poll.question.slice(0, 26)}`,
              shortType: 'Payment',
              messageId: s.messageId,
              chatId: s.chatId,
              text: s.text,
              date: s.timestamp || poll.createdAt
            });
          });
        }
        if (poll.sentLineups) {
          poll.sentLineups.forEach((l, idx) => {
            const optText = poll.options[l.optionIndex]?.text || `Option ${l.optionIndex + 1}`;
            const key = `${l.chatId}-${l.messageId}`;
            map.set(key, {
              id: `lineup-${poll.id}-${idx}`,
              label: `📋 Lineup (Msg #${l.messageId}) - ${optText.slice(0, 26)}`,
              shortType: 'Lineup',
              messageId: l.messageId,
              chatId: l.chatId,
              text: l.text,
              date: l.timestamp || poll.createdAt
            });
          });
        }
        if (poll.messageId) {
          const key = `${tgChatId || 'chat'}-${poll.messageId}`;
          if (!map.has(key)) {
            map.set(key, {
              id: `poll-${poll.id}`,
              label: `🗳️ Poll: "${poll.question.slice(0, 26)}..." (Msg #${poll.messageId})`,
              shortType: 'Poll',
              messageId: poll.messageId,
              chatId: tgChatId,
              date: poll.createdAt
            });
          }
        }
      });
    }

    // 2. Also check localStorage cached polls
    try {
      const cachedPolls: ActivePoll[] = [
        ...JSON.parse(localStorage.getItem('activePolls') || '[]'),
        ...JSON.parse(localStorage.getItem('deletedPolls') || '[]')
      ];
      cachedPolls.forEach(poll => {
        if (poll.sentSummaries) {
          poll.sentSummaries.forEach((s, idx) => {
            const key = `${s.chatId}-${s.messageId}`;
            if (!map.has(key)) {
              map.set(key, {
                id: `cached-summary-${poll.id}-${idx}`,
                label: `💰 Payment Summary (Msg #${s.messageId}) - ${poll.question.slice(0, 26)}`,
                shortType: 'Payment',
                messageId: s.messageId,
                chatId: s.chatId,
                text: s.text,
                date: s.timestamp || poll.createdAt
              });
            }
          });
        }
        if (poll.sentLineups) {
          poll.sentLineups.forEach((l, idx) => {
            const optText = poll.options[l.optionIndex]?.text || `Option ${l.optionIndex + 1}`;
            const key = `${l.chatId}-${l.messageId}`;
            if (!map.has(key)) {
              map.set(key, {
                id: `cached-lineup-${poll.id}-${idx}`,
                label: `📋 Lineup (Msg #${l.messageId}) - ${optText.slice(0, 26)}`,
                shortType: 'Lineup',
                messageId: l.messageId,
                chatId: l.chatId,
                text: l.text,
                date: l.timestamp || poll.createdAt
              });
            }
          });
        }
      });
    } catch (e) {}

    // 3. From editorHistory
    editorHistory.forEach(item => {
      const key = `${item.chatId}-${item.messageId}`;
      if (!map.has(key)) {
        map.set(key, item);
      }
    });

    const arr = Array.from(map.values());
    return arr.sort((a, b) => b.date - a.date);
  }, [activePolls, editorHistory, tgChatId]);

  const handleSelectRecent = (id: string) => {
    setSelectedRecentId(id);
    const item = allRecentMessages.find(m => m.id === id);
    if (!item) return;

    setTargetChatId(item.chatId);
    setTargetMessageId(item.messageId);

    const cleanChat = item.chatId.replace(/^-100/, '');
    setLinkInput(item.chatId.startsWith('@') ? `https://t.me/${item.chatId.slice(1)}/${item.messageId}` : `https://t.me/c/${cleanChat}/${item.messageId}`);

    if (item.text) {
      setMessageText(item.text);
      setFetchNotice(`Loaded message #${item.messageId} text. Click "Fetch Live Text" to verify latest live content from Telegram.`);
    } else {
      setFetchNotice(`Selected message #${item.messageId}. Click "Fetch Live Text" to load its content from Telegram.`);
    }
    setError(null);
    setSuccessInfo(null);
  };

  // Sync default tgChatId if targetChatId is empty
  useEffect(() => {
    if (!targetChatId && tgChatId) {
      setTargetChatId(tgChatId);
    }
  }, [tgChatId]);

  // Parse link whenever linkInput changes
  const parseLink = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setError(null);
    setFetchNotice(null);
    setSuccessInfo(null);

    // If pure number
    if (/^\d+$/.test(trimmed)) {
      setTargetMessageId(parseInt(trimmed, 10));
      if (!targetChatId && tgChatId) setTargetChatId(tgChatId);
      return;
    }

    try {
      let urlStr = trimmed;
      if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
        if (urlStr.startsWith('t.me/')) {
          urlStr = 'https://' + urlStr;
        }
      }
      const url = new URL(urlStr);
      const segments = url.pathname.split('/').filter(Boolean);

      if (segments.length >= 2) {
        if (segments[0] === 'c') {
          // Private group / supergroup: /c/1234567890/456
          const rawChat = segments[1];
          const lastSeg = segments[segments.length - 1];
          const msgId = parseInt(lastSeg, 10);
          const resolvedChat = rawChat.startsWith('-100') ? rawChat : `-100${rawChat}`;
          setTargetChatId(resolvedChat);
          if (!isNaN(msgId)) setTargetMessageId(msgId);
          return;
        } else {
          // Public group or channel: /username/456
          const username = segments[0];
          const lastSeg = segments[segments.length - 1];
          const msgId = parseInt(lastSeg, 10);
          setTargetChatId(`@${username}`);
          if (!isNaN(msgId)) setTargetMessageId(msgId);
          return;
        }
      }
    } catch {
      // Fallback: match trailing digits
      const match = trimmed.match(/\/(\d+)$/);
      if (match) {
        setTargetMessageId(parseInt(match[1], 10));
        if (!targetChatId && tgChatId) setTargetChatId(tgChatId);
        return;
      }
    }

    setError('Could not auto-detect message ID from input. Please enter a valid Telegram link or message ID.');
  };

  const handleLinkInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLinkInput(val);
    parseLink(val);
  };

  // Fetch current text from Telegram via forward trick
  const handleFetchCurrentText = async () => {
    if (!tgBotToken) {
      setError('Telegram Bot Token is missing. Please configure it in Settings first.');
      return;
    }

    const currentChat = targetChatId.trim() || tgChatId;
    const currentMsgId = typeof targetMessageId === 'number' ? targetMessageId : parseInt(String(targetMessageId), 10);

    if (!currentChat) {
      setError('Please provide a Chat ID (or message link containing chat info).');
      return;
    }
    if (!currentMsgId || isNaN(currentMsgId) || currentMsgId <= 0) {
      setError('Please provide a valid numeric Message ID.');
      return;
    }

    setIsFetching(true);
    setError(null);
    setFetchNotice(null);

    try {
      const forwardRes = await fetch(`https://api.telegram.org/bot${tgBotToken}/forwardMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: tgChatId || currentChat,
          from_chat_id: currentChat,
          message_id: currentMsgId,
          disable_notification: true
        })
      });

      const forwardData = await forwardRes.json();
      if (forwardRes.ok && forwardData.result) {
        const forwardedMsg = forwardData.result;
        
        // Clean up temporary forwarded message
        if (forwardedMsg.message_id) {
          fetch(`https://api.telegram.org/bot${tgBotToken}/deleteMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: tgChatId || currentChat,
              message_id: forwardedMsg.message_id
            })
          }).catch(() => {});
        }

        const rawText = forwardedMsg.text || forwardedMsg.caption || '';
        const rawEntities = forwardedMsg.entities || forwardedMsg.caption_entities || [];

        if (rawText) {
          const htmlText = telegramEntitiesToHtml(rawText, rawEntities);
          setMessageText(htmlText);
          const linkCount = rawEntities.filter((e: any) => e.type === 'text_link' || e.type === 'text_mention').length;
          const totalEntities = rawEntities.length;
          
          saveToEditorHistory({
            messageId: currentMsgId,
            chatId: currentChat,
            text: htmlText,
            label: `Live Msg #${currentMsgId} (${htmlText.replace(/<[^>]*>/g, '').slice(0, 24)}...)`,
            shortType: 'Live Msg'
          });

          if (totalEntities > 0) {
            setFetchNotice(`Successfully retrieved live message with full HTML formatting (${totalEntities} formatted items restored${linkCount > 0 ? `, including ${linkCount} link${linkCount > 1 ? 's' : ''}` : ''})!`);
          } else {
            setFetchNotice('Successfully retrieved live message text from Telegram!');
          }
          return;
        } else if (forwardedMsg.poll) {
          setFetchNotice(`This message is a Telegram Poll ("${forwardedMsg.poll.question}"). Note: Telegram does not allow editing poll text directly via bot API.`);
          return;
        }
      }

      // If forwarding failed (e.g. forward restricted)
      setFetchNotice(
        forwardData.description 
          ? `Could not auto-fetch message content (${forwardData.description}). You can still edit the message by typing or pasting your new text below.`
          : 'Could not auto-fetch message content. You can still edit the message by typing or pasting your new text below.'
      );
    } catch (err: any) {
      setFetchNotice(`Notice: ${err.message}. You can manually write or paste your updated text below.`);
    } finally {
      setIsFetching(false);
    }
  };

  // Submit edit to Telegram
  const handleUpdateMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgBotToken) {
      setError('Telegram Bot Token is missing. Please configure it in Settings first.');
      return;
    }

    const currentChat = targetChatId.trim() || tgChatId;
    const currentMsgId = typeof targetMessageId === 'number' ? targetMessageId : parseInt(String(targetMessageId), 10);

    if (!currentChat) {
      setError('Please provide a Chat ID or paste a full message link.');
      return;
    }
    if (!currentMsgId || isNaN(currentMsgId) || currentMsgId <= 0) {
      setError('Please provide a valid numeric Message ID.');
      return;
    }
    if (!messageText.trim()) {
      setError('Message text cannot be empty.');
      return;
    }

    setIsUpdating(true);
    setError(null);
    setSuccessInfo(null);

    try {
      const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: currentChat,
          message_id: currentMsgId,
          text: messageText,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        })
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.description?.includes('message is not modified')) {
          setSuccessInfo({
            messageId: currentMsgId,
            time: new Date().toLocaleTimeString()
          });
          setFetchNotice('Telegram reported: The message content is already identical to your text.');
          return;
        }
        throw new Error(data.description || 'Failed to edit message on Telegram');
      }

      saveToEditorHistory({
        messageId: currentMsgId,
        chatId: currentChat,
        text: messageText,
        label: `Edited Msg #${currentMsgId} (${messageText.replace(/<[^>]*>/g, '').slice(0, 24)}...)`,
        shortType: 'Edited Msg'
      });

      setSuccessInfo({
        messageId: currentMsgId,
        time: new Date().toLocaleTimeString()
      });
    } catch (err: any) {
      setError(err.message || 'Failed to update message.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Formatting helpers
  const applyFormat = (tag: string, endTag?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const selected = currentText.substring(start, end);
    const close = endTag || tag;

    const before = `<${tag}>`;
    const after = `</${close}>`;
    const replacement = `${before}${selected}${after}`;

    const newText = currentText.substring(0, start) + replacement + currentText.substring(end);
    setMessageText(newText);

    setTimeout(() => {
      textarea.focus();
      if (selected.length > 0) {
        textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
      } else {
        textarea.setSelectionRange(start + before.length, start + before.length);
      }
    }, 0);
  };

  const insertSnippet = (snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessageText(prev => prev + snippet);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const newText = currentText.substring(0, start) + snippet + currentText.substring(end);
    setMessageText(newText);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + snippet.length, start + snippet.length);
    }, 0);
  };

  const handleConfirmInsertLink = () => {
    if (!linkDialog || !linkDialog.value.trim()) {
      setLinkDialog(null);
      return;
    }
    const val = linkDialog.value.trim();
    if (linkDialog.type === 'user') {
      const cleanId = val.replace(/\D/g, '');
      if (cleanId) {
        applyFormat(`a href="tg://user?id=${cleanId}"`, 'a');
      }
    } else {
      const url = /^\d+$/.test(val) ? `tg://user?id=${val}` : val;
      applyFormat(`a href="${url}"`, 'a');
    }
    setLinkDialog(null);
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 space-y-6">
      {/* Top Banner / Explainer */}
      <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Edit3 className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-neutral-900">Telegram Bot Message Editor</h2>
          </div>
          <p className="text-xs text-neutral-500">
            Paste any link to a message sent by the bot in your group or channel to edit its text on-the-fly. No database storage required.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-100 shrink-0">
          <Info className="w-4 h-4 text-indigo-500 shrink-0" />
          <span>Supports HTML formatting (<b>bold</b>, <i>italic</i>, etc.)</span>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
        <div>
          <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <LinkIcon className="w-3.5 h-3.5 text-indigo-500" />
            Telegram Message Link or Message ID
          </label>
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={linkInput}
                onChange={handleLinkInputChange}
                placeholder="e.g. https://t.me/c/1234567890/456 or 456"
                className="w-full text-sm px-3.5 py-2.5 pr-8 rounded-xl border border-neutral-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition-all placeholder:text-neutral-400"
              />
              {linkInput && (
                <button
                  type="button"
                  onClick={() => {
                    setLinkInput('');
                    setTargetMessageId('');
                    setSelectedRecentId('');
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 rounded-md transition-colors"
                  title="Clear link input"
                  aria-label="Clear link input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleFetchCurrentText}
              disabled={isFetching || (!targetMessageId && !linkInput.trim())}
              className="px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
              title="Fetch live message text from Telegram"
            >
              {isFetching ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  Fetching Text...
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Fetch Live Text
                </>
              )}
            </button>
          </div>
        </div>

        {/* Recent Bot Messages Dropdown & History */}
        <div className="pt-2 border-t border-neutral-100 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-indigo-500" />
              Recent Bot Messages Dropdown
              {allRecentMessages.length > 0 && (
                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {allRecentMessages.length}
                </span>
              )}
            </label>
            {editorHistory.length > 0 && (
              confirmClearHistory ? (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-red-600 font-semibold">Clear?</span>
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="px-2 py-0.5 bg-red-600 text-white rounded font-bold hover:bg-red-700"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearHistory(false)}
                    className="px-1.5 py-0.5 text-neutral-500 hover:text-neutral-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearHistory(true)}
                  className="text-[11px] text-neutral-400 hover:text-red-500 transition-colors"
                  title="Clear local editor history"
                >
                  Clear history
                </button>
              )
            )}
          </div>

          {allRecentMessages.length > 0 ? (
            <div className="space-y-2">
              <select
                value={selectedRecentId}
                onChange={(e) => handleSelectRecent(e.target.value)}
                className="w-full text-xs bg-neutral-50 hover:bg-neutral-100/80 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-800 outline-none focus:border-indigo-400 font-medium"
              >
                <option value="">-- Choose a recent bot message to load into editor --</option>
                {allRecentMessages.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({new Date(m.date).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })})
                  </option>
                ))}
              </select>

              {/* Quick jump chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <span className="text-[11px] text-neutral-400 shrink-0 font-medium">Quick pick:</span>
                {allRecentMessages.slice(0, 5).map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectRecent(m.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 border truncate max-w-[210px] ${
                      selectedRecentId === m.id 
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold' 
                        : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-700'
                    }`}
                    title={m.label}
                  >
                    #{m.messageId} {m.shortType}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200/80 text-xs text-neutral-600 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-neutral-800">
                <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>No recent bot messages recorded yet</span>
              </div>
              <p className="text-neutral-500 text-[11px] leading-relaxed">
                When the bot sends <b>Lineups</b> or <b>Payment Summaries</b> from the Polls tab, they will automatically appear here in this dropdown.
              </p>
              <p className="text-neutral-500 text-[11px] leading-relaxed">
                You can also paste any Telegram message link (e.g. <span className="font-mono bg-white px-1 py-0.5 rounded border border-neutral-200">https://t.me/c/...</span>) or message ID into the box above and click <b>Fetch Live Text</b>.
              </p>
            </div>
          )}
        </div>

        {/* Parsed Meta Details (Editable if needed) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
              Target Chat ID:
            </label>
            <input
              type="text"
              value={targetChatId}
              onChange={(e) => setTargetChatId(e.target.value)}
              placeholder="e.g. -1001234567890 or @channel"
              className="w-full text-xs font-mono px-3 py-1.5 bg-neutral-50 rounded-lg border border-neutral-200 focus:bg-white focus:border-indigo-300 outline-none transition-all"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-neutral-500 mb-1">
              Target Message ID:
            </label>
            <input
              type="number"
              value={targetMessageId}
              onChange={(e) => setTargetMessageId(e.target.value ? parseInt(e.target.value, 10) : '')}
              placeholder="e.g. 456"
              className="w-full text-xs font-mono px-3 py-1.5 bg-neutral-50 rounded-lg border border-neutral-200 focus:bg-white focus:border-indigo-300 outline-none transition-all"
            />
          </div>
        </div>

        {/* Notices and Alerts */}
        {fetchNotice && (
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{fetchNotice}</span>
            </div>
            {lastClearedText !== null && (
              <button
                type="button"
                onClick={handleUndoClear}
                className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold rounded-lg text-xs transition-colors shrink-0"
              >
                Undo
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {successInfo && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <b>Message #{successInfo.messageId}</b> updated successfully on Telegram at {successInfo.time}!
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Editor & Preview Area */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm flex flex-col overflow-hidden min-h-[420px]">
        {/* Editor Toolbar */}
        <div className="p-3 border-b border-neutral-200 bg-neutral-50/60 flex flex-wrap items-center justify-between gap-2">
          {/* Formatting buttons */}
          <div className="flex items-center flex-wrap gap-1">
            <button
              type="button"
              onClick={() => applyFormat('b')}
              className="p-1.5 text-neutral-600 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-neutral-200 transition-all font-bold"
              title="Bold <b>...</b>"
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => applyFormat('i')}
              className="p-1.5 text-neutral-600 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-neutral-200 transition-all"
              title="Italic <i>...</i>"
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => applyFormat('u')}
              className="p-1.5 text-neutral-600 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-neutral-200 transition-all"
              title="Underline <u>...</u>"
            >
              <Underline className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => applyFormat('s')}
              className="p-1.5 text-neutral-600 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-neutral-200 transition-all"
              title="Strikethrough <s>...</s>"
            >
              <Strikethrough className="w-4 h-4" />
            </button>
            <span className="w-px h-4 bg-neutral-200 mx-1" />
            <button
              type="button"
              onClick={() => applyFormat('code')}
              className="p-1.5 text-neutral-600 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-neutral-200 transition-all"
              title="Inline Code <code>...</code>"
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => applyFormat('pre')}
              className="p-1.5 text-neutral-600 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-neutral-200 transition-all"
              title="Preformatted block <pre>...</pre>"
            >
              <FileCode className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setLinkDialog(prev => prev?.type === 'url' ? null : { type: 'url', value: '' })}
              className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                linkDialog?.type === 'url'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-600'
                  : 'text-neutral-600 hover:text-indigo-600 hover:bg-white border-transparent hover:border-neutral-200'
              }`}
              title="Add Link <a href='...'>...</a>"
            >
              <LinkIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setLinkDialog(prev => prev?.type === 'user' ? null : { type: 'user', value: '' })}
              className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                linkDialog?.type === 'user'
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-600'
                  : 'text-neutral-600 hover:text-indigo-600 hover:bg-white border-transparent hover:border-neutral-200'
              }`}
              title="Mention User by ID <a href='tg://user?id=...'>...</a>"
            >
              <User className="w-4 h-4" />
            </button>
            <span className="w-px h-4 bg-neutral-200 mx-1" />
            {/* Quick emoji pills */}
            <div className="flex items-center gap-1">
              {['🏐', '✅', '❌', '💰', '⚠️', '⏰', '📍'].map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertSnippet(emoji)}
                  className="px-1.5 py-0.5 text-xs hover:bg-white rounded border border-transparent hover:border-neutral-200 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-neutral-200/60 p-0.5 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                viewMode === 'edit' ? 'bg-white text-indigo-600 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Edit HTML
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                viewMode === 'preview' ? 'bg-white text-indigo-600 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Live Preview
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`hidden md:block px-2.5 py-1 rounded-md transition-all ${
                viewMode === 'split' ? 'bg-white text-indigo-600 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Split View
            </button>
          </div>
        </div>

        {/* Inline Link / Mention Bar (No window.prompt, 100% iframe-safe) */}
        {linkDialog && (
          <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2 text-xs flex-wrap">
            <span className="font-bold text-indigo-900 flex items-center gap-1.5">
              {linkDialog.type === 'url' ? <LinkIcon className="w-3.5 h-3.5 text-indigo-600" /> : <User className="w-3.5 h-3.5 text-indigo-600" />}
              {linkDialog.type === 'url' ? 'Insert Link URL:' : 'Mention Telegram User ID:'}
            </span>
            <input
              type="text"
              autoFocus
              value={linkDialog.value}
              onChange={(e) => setLinkDialog({ ...linkDialog, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirmInsertLink();
                } else if (e.key === 'Escape') {
                  setLinkDialog(null);
                }
              }}
              placeholder={linkDialog.type === 'url' ? 'https://example.com or user ID' : 'e.g. 123456789'}
              className="px-3 py-1.5 text-xs rounded-lg border border-indigo-200 bg-white outline-none focus:border-indigo-500 w-64 shadow-xs"
            />
            <button
              type="button"
              onClick={handleConfirmInsertLink}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors"
            >
              Insert
            </button>
            <button
              type="button"
              onClick={() => setLinkDialog(null)}
              className="px-2 py-1.5 text-neutral-500 hover:text-neutral-700 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Editor Body */}
        <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-neutral-100 min-h-[300px]">
          {/* Text Editor */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div className="flex-1 flex flex-col p-4">
              <textarea
                ref={textareaRef}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type or paste the new message text here... (HTML tags like <b>bold</b>, <i>italic</i>, and <a href='...'>links</a> are fully supported)"
                className="w-full flex-1 min-h-[260px] p-3 text-sm font-mono leading-relaxed rounded-xl border border-neutral-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none resize-none bg-neutral-50/30"
              />
              <div className="flex justify-between items-center text-[11px] text-neutral-400 mt-2 px-1">
                <span>Supports standard Telegram HTML formatting (<a href="tg://user?id=123" className="text-indigo-500 underline">&lt;a&gt;</a>, &lt;b&gt;, &lt;i&gt;, &lt;code&gt;)</span>
                <span>{messageText.length} / 4096 characters</span>
              </div>
            </div>
          )}

          {/* Live Preview */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className="flex-1 flex flex-col p-4 bg-neutral-50/50">
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                Telegram Preview
              </div>
              <div className="flex-1 min-h-[260px] p-4 bg-white rounded-xl border border-neutral-200 text-sm leading-relaxed overflow-y-auto shadow-xs">
                {messageText.trim() ? (
                  <div 
                    className="whitespace-pre-wrap font-sans text-neutral-900 selection:bg-indigo-100 [&_a]:text-indigo-600 [&_a]:underline [&_a]:font-medium [&_a:hover]:text-indigo-800 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_u]:underline [&_s]:line-through [&_strike]:line-through [&_del]:line-through [&_code]:bg-neutral-100 [&_code]:text-indigo-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-xs [&_pre]:bg-neutral-900 [&_pre]:text-neutral-100 [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:font-mono [&_pre]:text-xs [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-400 [&_blockquote]:pl-3 [&_blockquote]:my-1.5 [&_blockquote]:text-neutral-700 [&_tg-spoiler]:bg-neutral-800 [&_tg-spoiler]:text-transparent [&_tg-spoiler:hover]:text-inherit [&_tg-spoiler]:rounded [&_tg-spoiler]:px-1 [&_tg-spoiler]:cursor-pointer"
                    dangerouslySetInnerHTML={{ __html: messageText }}
                  />
                ) : (
                  <p className="text-neutral-400 italic text-xs">
                    Preview will render here as it will appear in Telegram...
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-neutral-200 bg-neutral-50/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-neutral-500">
            {targetMessageId ? (
              <span>Target: Message <b>#{targetMessageId}</b> in <b>{targetChatId || 'default chat'}</b></span>
            ) : (
              <span>Provide a message link or ID above to enable updating</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleClearText}
              disabled={!messageText}
              className="px-3.5 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              title="Clear editor text"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Text
            </button>
            {(targetMessageId || linkInput) && (
              <button
                type="button"
                onClick={handleResetAll}
                className="px-3 py-2 text-xs font-medium text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                title="Reset message target link and clear editor"
              >
                Reset All
              </button>
            )}
            <button
              type="button"
              onClick={handleUpdateMessage}
              disabled={isUpdating || !messageText.trim() || !targetMessageId}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving to Telegram...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Save & Update Message
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
