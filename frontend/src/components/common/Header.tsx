import React from 'react';
import { Mail, Activity, LogOut, ExternalLink } from 'lucide-react';
import { User } from '../../types';
import { Button } from './Button';

export interface HeaderProps {
  user: User;
  onLogout: () => void;
  isLoggingOut?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout, isLoggingOut = false }) => {
  return (
    <header className="w-full bg-slate-900/60 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 p-0.5 shadow-lg shadow-indigo-600/30 flex items-center justify-center text-white">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white font-mono">MailPulse</span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ACTIVE
              </span>
            </div>
            <p className="hidden md:block text-[11px] text-slate-400 font-medium">
              Distributed Email Scheduling & Delivery Platform
            </p>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Direct link to Bull Board */}
          <a
            href="/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-300 bg-indigo-950/50 hover:bg-indigo-900/50 border border-indigo-800/50 transition-all hover:scale-105"
            title="Open Bull Board live queue monitoring"
          >
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span>Bull Board</span>
            <ExternalLink className="w-3 h-3 text-indigo-400" />
          </a>

          {/* User profile capsule */}
          <div className="flex items-center gap-2.5 bg-slate-800/50 border border-slate-700/60 rounded-xl py-1 px-2.5">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-700"
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-indigo-600/80 flex items-center justify-center text-white font-bold text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="hidden lg:block text-left leading-tight">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">{user.name}</p>
                {user.isDevDemo || user.googleId === 'dev-evaluator-demo-only' ? (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-950/80 text-amber-400 border border-amber-800/50">
                    DEMO BYPASS
                  </span>
                ) : (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-indigo-950/80 text-indigo-400 border border-indigo-800/50">
                    GOOGLE OAUTH
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{user.email}</p>
            </div>
          </div>

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            isLoading={isLoggingOut}
            className="text-slate-400 hover:text-rose-400"
            title="Sign out of MailPulse"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
