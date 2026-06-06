import React from 'react';
import { X } from 'lucide-react';

interface SettingsModalProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  tgBotToken: string;
  setTgBotToken: (t: string) => void;
  tgChatId: string;
  setTgChatId: (c: string) => void;
  defaultHourlyPrice: number;
  setDefaultHourlyPrice: (p: number) => void;
  handleSaveSettings: () => void;
}

export function SettingsModal({
  showSettings,
  setShowSettings,
  tgBotToken,
  setTgBotToken,
  tgChatId,
  setTgChatId,
  defaultHourlyPrice,
  setDefaultHourlyPrice,
  handleSaveSettings
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
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Default Price for 1h ($)</label>
              <input 
                type="number" 
                value={defaultHourlyPrice}
                onChange={e => setDefaultHourlyPrice(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 border border-neutral-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white font-medium"
              />
            </div>
          </section>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSaveSettings}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              Save & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
