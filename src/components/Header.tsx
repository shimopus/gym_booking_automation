import React from 'react';
import { ExternalLink, LogIn, LogOut, Settings } from 'lucide-react';
import { signIn, logOut } from '../firebase';

interface HeaderProps {
  user: any;
  setShowSettings: (show: boolean) => void;
}

export function Header({ user, setShowSettings }: HeaderProps) {
  return (
    <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">Court Availability Finder</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
          <p className="text-neutral-500">Find weekday slots of 2 hours or more at SportsHouse.</p>
          <a 
            href="https://apps.daysmartrecreation.com/dash/x/#/online/sportshouse/login?noAutoLogin=1" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
          >
            Book on SportsHouse
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-600 font-medium">{user.email}</span>
            <button 
              onClick={logOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        ) : (
          <button 
            onClick={async () => {
              try {
                await signIn();
              } catch (error: any) {
                console.error('Sign in error:', error);
                alert(`Sign in failed: ${error.message}\n\nIf you are running this locally, make sure your local URL (e.g., localhost or 127.0.0.1) is added to the Authorized Domains in the Firebase Console (Authentication -> Settings -> Authorized domains).`);
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <LogIn className="w-4 h-4" />
            Sign In to Sync
          </button>
        )}
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-xl border bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition-colors shadow-sm"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
