import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Send,
  Search,
  MessageSquare,
  PlusCircle,
  Activity,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { Header } from '../components/common/Header';
import { Button } from '../components/common/Button';
import { ToastContainer, ToastMessage, ToastType } from '../components/common/Toast';
import { QueueStatsCard } from '../components/dashboard/QueueStatsCard';
import { ScheduledTable } from '../components/dashboard/ScheduledTable';
import { SentTable } from '../components/dashboard/SentTable';
import { ComposeModal } from '../components/dashboard/ComposeModal';
import { SlackCard } from '../components/dashboard/SlackCard';
import { Table } from '../components/common/Table';
import { StatusBadge } from '../components/common/Badge';
import { Spinner } from '../components/common/Spinner';
import { User, Sender, EmailStats, Email } from '../types';
import { emailApi, senderApi, authApi } from '../services/api';

type TabType = 'scheduled' | 'sent' | 'search' | 'slack' | 'architecture';

export const DashboardPage: React.FC<{
  user: User;
  onLogout: () => void;
}> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabType>('scheduled');
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Elasticsearch search tab states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Email[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const addToast = (type: ToastType, message: string) => {
    const newToast: ToastMessage = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      message,
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchStatsAndSenders = useCallback(async () => {
    try {
      const [statsRes, sendersRes] = await Promise.all([
        emailApi.getStats(),
        senderApi.getSenders(),
      ]);

      if (statsRes.success) setStats(statsRes.stats);
      if (sendersRes.success) setSenders(sendersRes.senders);
    } catch {
      // Background poll failure handled silently
    }
  }, []);

  // Periodic polling to keep dashboard live (every 5 seconds)
  useEffect(() => {
    fetchStatsAndSenders();
    const interval = setInterval(() => {
      fetchStatsAndSenders();
      setRefreshTrigger((prev) => prev + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchStatsAndSenders]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authApi.logout();
      onLogout();
    } catch {
      onLogout();
    }
  };

  const handleElasticsearchSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      const res = await emailApi.searchEmails(searchQuery.trim(), 1, 20);
      setSearchResults(res.data || []);
    } catch (err: any) {
      addToast('error', err.response?.data?.error || 'Elasticsearch search query failed');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <Header user={user} onLogout={handleLogout} isLoggingOut={isLoggingOut} />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top welcome & primary action row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-mono">
              Delivery Operations
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Distributed BullMQ queue running with persistent Redis storage & Elasticsearch indexing.
            </p>
          </div>

          <Button
            size="lg"
            onClick={() => setIsComposeOpen(true)}
            leftIcon={<PlusCircle className="w-5 h-5" />}
            className="shadow-indigo-600/30 self-start sm:self-auto"
          >
            Compose New Campaign
          </Button>
        </div>

        {/* Real-time stats cards */}
        <QueueStatsCard stats={stats} />

        {/* Tab Navigation */}
        <div className="border-b border-slate-800 flex items-center gap-2 overflow-x-auto custom-scrollbar pb-px">
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'scheduled'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Scheduled Emails</span>
            {stats && stats.scheduled > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-950/80 text-amber-400 border border-amber-800/40">
                {stats.scheduled}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'sent'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Sent & Delivered</span>
            {stats && stats.sent > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                {stats.sent}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'search'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Elasticsearch Search</span>
          </button>

          <button
            onClick={() => setActiveTab('slack')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'slack'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Slack Integration</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'architecture'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/20'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Architecture & Queue</span>
          </button>
        </div>

        {/* Tab Content Panes */}
        <div className="pt-2">
          {activeTab === 'scheduled' && (
            <ScheduledTable
              refreshTrigger={refreshTrigger}
              onComposeClick={() => setIsComposeOpen(true)}
            />
          )}

          {activeTab === 'sent' && <SentTable refreshTrigger={refreshTrigger} />}

          {/* Elasticsearch Search Tab */}
          {activeTab === 'search' && (
            <div className="space-y-6 text-left">
              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-indigo-950/50 border border-indigo-800/40 text-indigo-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">
                      Elasticsearch Full-Text Search
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Queries the <code className="text-indigo-300">mailpulse-emails</code> index
                      across recipient, sender, subject, and body with automatic user data isolation.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleElasticsearchSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search recipient, sender, subject, body keywords..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <Button type="submit" isLoading={isSearching} leftIcon={<Search className="w-4 h-4" />}>
                    Search ES
                  </Button>
                </form>
              </div>

              {/* Search Results */}
              {isSearching ? (
                <div className="flex items-center justify-center p-12 border border-slate-800 rounded-2xl bg-slate-900/30">
                  <div className="flex items-center gap-3 text-slate-400">
                    <Spinner size="md" />
                    <span className="text-sm">Executing Elasticsearch query...</span>
                  </div>
                </div>
              ) : hasSearched && searchResults.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl text-slate-400 text-sm">
                  No emails matched your search criteria in Elasticsearch.
                </div>
              ) : searchResults.length > 0 ? (
                <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-900/40">
                  <Table headers={['Recipient', 'Sender', 'Subject', 'Status', 'Scheduled At']}>
                    {searchResults.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-200">{item.recipient}</td>
                        <td className="py-3.5 px-4 text-xs text-slate-400 font-mono">{item.sender?.email || (item as any).sender}</td>
                        <td className="py-3.5 px-4 text-slate-200 font-medium max-w-xs truncate">{item.subject}</td>
                        <td className="py-3.5 px-4"><StatusBadge status={item.status} /></td>
                        <td className="py-3.5 px-4 text-xs text-slate-400 font-mono">{new Date(item.scheduledAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </Table>
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'slack' && <SlackCard onToast={addToast} />}

          {/* Architecture & Bull Board Tab */}
          {activeTab === 'architecture' && (
            <div className="space-y-6 text-left">
              <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-indigo-950/50 border border-indigo-800/40 text-indigo-400">
                      <Activity className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100">Live Bull Board Dashboard</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Real-time visualization of delayed, active, completed, and failed jobs in BullMQ.
                      </p>
                    </div>
                  </div>
                  <a
                    href="/admin/queues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/25"
                  >
                    <span>Launch Bull Board</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-300">Strictly Zero Cron</p>
                    <p className="text-xs text-slate-400">
                      Jobs use BullMQ native delay timers in Redis sorted sets. No crontab or node-cron polling is used anywhere.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-300">Server Restart Survival</p>
                    <p className="text-xs text-slate-400">
                      Redis volume with AOF persistence guarantees that if the server or worker restarts, all future jobs trigger on time.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-300">Atomic Idempotency</p>
                    <p className="text-xs text-slate-400">
                      State transitions SCHEDULED → PROCESSING via atomic SQL update guarantees only one worker claims an email.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Compose Campaign Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        senders={senders}
        onSuccess={() => {
          fetchStatsAndSenders();
          setRefreshTrigger((prev) => prev + 1);
        }}
        onToast={addToast}
      />

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};
