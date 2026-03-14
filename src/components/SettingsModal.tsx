import React from 'react';
import { X, Loader2, Download } from 'lucide-react';

interface SettingsModalProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
  username: string;
  setUsername: (u: string) => void;
  password: string;
  setPassword: (p: string) => void;
  rememberMe: boolean;
  setRememberMe: (r: boolean) => void;
  tgBotToken: string;
  setTgBotToken: (t: string) => void;
  tgChatId: string;
  setTgChatId: (c: string) => void;
  handleSaveSettings: () => void;
  handleFetchFromSportsHouse: () => void;
  isFetching: boolean;
}

export function SettingsModal({
  showSettings,
  setShowSettings,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  username,
  setUsername,
  password,
  setPassword,
  rememberMe,
  setRememberMe,
  tgBotToken,
  setTgBotToken,
  tgChatId,
  setTgChatId,
  handleSaveSettings,
  handleFetchFromSportsHouse,
  isFetching
}: SettingsModalProps) {
  if (!showSettings) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-900">Settings</h3>
          <button 
            onClick={() => setShowSettings(false)}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <section className="space-y-4">
            <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">SportsHouse API</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Start Date</label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">End Date</label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Email / Username</label>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="Enter your email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="Enter your password"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-neutral-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="rememberMe" className="text-sm text-neutral-700 cursor-pointer">
                Remember credentials
              </label>
            </div>
          </section>

          <hr className="border-neutral-100" />

          <section className="space-y-4">
            <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Telegram Notifications</h4>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Bot Token</label>
              <input 
                type="password" 
                value={tgBotToken}
                onChange={e => setTgBotToken(e.target.value)}
                className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Chat ID</label>
              <select 
                value={tgChatId}
                onChange={e => setTgChatId(e.target.value)}
                className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
              >
                <option value="">Select a chat...</option>
                <option value="-5037930746">Test chat (-5037930746)</option>
                <option value="-1002692599988">Сильный Состав (-1002692599988)</option>
                {tgChatId && tgChatId !== "-5037930746" && tgChatId !== "-1002692599988" && (
                  <option value={tgChatId}>Current: {tgChatId}</option>
                )}
              </select>
            </div>
          </section>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSaveSettings}
              className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-medium transition-colors"
            >
              Save & Close
            </button>
            <button
              onClick={handleFetchFromSportsHouse}
              disabled={!username || !password || isFetching}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Fetch Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
