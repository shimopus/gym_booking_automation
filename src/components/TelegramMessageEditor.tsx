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
  CheckCircle2
} from 'lucide-react';

interface TelegramMessageEditorProps {
  tgBotToken: string;
  tgChatId: string;
}

export function TelegramMessageEditor({ tgBotToken, tgChatId }: TelegramMessageEditorProps) {
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

        if (forwardedMsg.text) {
          setMessageText(forwardedMsg.text);
          setFetchNotice('Successfully retrieved live message text from Telegram!');
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
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-neutral-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none transition-all placeholder:text-neutral-400"
              />
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
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{fetchNotice}</span>
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
              onClick={() => {
                const url = prompt('Enter link URL (e.g. https://...):');
                if (url) {
                  applyFormat(`a href="${url}"`, 'a');
                }
              }}
              className="p-1.5 text-neutral-600 hover:text-indigo-600 hover:bg-white rounded-lg border border-transparent hover:border-neutral-200 transition-all"
              title="Add Link <a href='...'>...</a>"
            >
              <LinkIcon className="w-4 h-4" />
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
                <span>Supports standard Telegram HTML formatting</span>
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
                    className="whitespace-pre-wrap font-sans text-neutral-900 selection:bg-indigo-100"
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
              onClick={() => {
                if (confirm('Clear editor text?')) {
                  setMessageText('');
                  setError(null);
                  setSuccessInfo(null);
                  setFetchNotice(null);
                }
              }}
              className="px-3.5 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-200 rounded-xl transition-colors"
            >
              Clear
            </button>
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
