import React, { useState, useEffect } from 'react';
import { Mail, Zap, Server, Play, AlertCircle, Info } from 'lucide-react';
import { Button } from '../components/common/Button';
import { authApi } from '../services/api';
import { User } from '../types';

export const LoginPage: React.FC<{
  onLoginSuccess: (user: User) => void;
}> = ({ onLoginSuccess }) => {
  const [isDevLoggingIn, setIsDevLoggingIn] = useState(false);
  const [error, setError] = useState<{ title?: string; message: string; isConfigNotice?: boolean } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    const msg = params.get('message');

    if (err === 'google_oauth_unconfigured') {
      setError({
        title: 'Google OAuth Setup Required',
        message:
          msg ||
          'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not configured in backend/.env. Set up credentials in Google Cloud Console to enable Google Sign-In, or use the Evaluator Demo Login below.',
        isConfigNotice: true,
      });
    } else if (err === 'auth_failed') {
      setError({
        title: 'Authentication Failed',
        message: msg || 'Failed to authenticate with Google. Please check your credentials and try again.',
      });
    } else if (err === 'missing_code') {
      setError({
        title: 'Authorization Incomplete',
        message: 'Google authorization code was missing from the callback.',
      });
    } else if (err) {
      setError({
        title: 'Authentication Error',
        message: msg || `OAuth Error: ${err}`,
      });
    }
  }, []);

  const handleGoogleLogin = () => {
    window.location.href = authApi.getGoogleLoginUrl();
  };

  const handleDevLogin = async () => {
    setIsDevLoggingIn(true);
    setError(null);
    try {
      const res = await authApi.devLogin();
      if (res.success) {
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setError({
        title: 'Demo Login Failed',
        message: err.response?.data?.error || err.message || 'Demo login failed',
      });
    } finally {
      setIsDevLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-slate-950">
      {/* Dynamic ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[300px] h-[300px] bg-violet-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-8 text-center">
        {/* Brand Icon */}
        <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-xl shadow-indigo-500/25 text-white ring-1 ring-white/20">
          <Mail className="w-8 h-8" />
        </div>

        {/* Brand Titles */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-mono">
            MailPulse
          </h1>
          <p className="text-sm font-medium text-indigo-300">
            Distributed Email Scheduling & Delivery Platform
          </p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto pt-1">
            Engineered with BullMQ, Redis, PostgreSQL, and Elasticsearch. Guaranteed restart persistence without cron jobs.
          </p>
        </div>

        {/* Login Card */}
        <div className="p-7 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-2xl backdrop-blur-xl space-y-5 text-left">
          {error && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex gap-2.5 items-start ${
                error.isConfigNotice
                  ? 'bg-amber-950/40 border-amber-800/50 text-amber-300'
                  : 'bg-rose-950/40 border-rose-800/40 text-rose-300'
              }`}
            >
              {error.isConfigNotice ? (
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              )}
              <div className="space-y-1">
                {error.title && <p className="font-semibold">{error.title}</p>}
                <p className="leading-relaxed opacity-90">{error.message}</p>
              </div>
            </div>
          )}

          {/* Primary Production Action: Google OAuth */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Production Sign-In
            </label>
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.98] cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.67-5.17 3.67-9.15z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.24v3.15C3.26 21.36 7.36 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.24C.45 8.18 0 10.03 0 12s.45 3.82 1.24 5.39l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.24 6.61l4.03 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
            <p className="text-[11px] text-slate-500 text-center">
              Requires valid Google OAuth 2.0 Web Client credentials in backend/.env
            </p>
          </div>

          <div className="relative flex items-center justify-center py-1">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[10px] uppercase tracking-wider text-slate-500 font-semibold font-mono">
              DEVELOPER & EVALUATOR BYPASS
            </span>
          </div>

          {/* Development Evaluator Demo Login */}
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                EVALUATOR ONLY
              </span>
              <span className="text-[10px] text-slate-500">Zero credentials needed</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Instant evaluation session without configuring Google Cloud Console OAuth.
            </p>
            <Button
              variant="secondary"
              className="w-full py-2.5 text-xs bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/80"
              onClick={handleDevLogin}
              isLoading={isDevLoggingIn}
              leftIcon={<Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />}
            >
              Launch Evaluator Demo Session
            </Button>
          </div>
        </div>

        {/* Platform Feature Highlights */}
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800/60">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs mb-1">
              <Zap className="w-4 h-4" />
              <span>BullMQ Delayed Queue</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              Strictly zero cron jobs. Jobs are delay-indexed and dispatched by worker processes.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800/60">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs mb-1">
              <Server className="w-4 h-4" />
              <span>Restart Persistence</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              AOF Redis + PostgreSQL ensure full recovery on restart without re-sending sent emails.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
