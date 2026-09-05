import React, { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle2, XCircle, Send, Link, Unlink } from 'lucide-react';
import { Button } from '../common/Button';
import { slackApi } from '../../services/api';
import { SlackStatus } from '../../types';

export const SlackCard: React.FC<{
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}> = ({ onToast }) => {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const res = await slackApi.getStatus();
      setStatus(res);
    } catch {
      setStatus({ isConnected: false });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnect = () => {
    window.location.href = slackApi.getConnectUrl();
  };

  const handleDisconnect = async () => {
    setIsActionLoading(true);
    try {
      await slackApi.disconnect();
      onToast('info', 'Slack workspace disconnected');
      fetchStatus();
    } catch (err: any) {
      onToast('error', err.message || 'Failed to disconnect');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setIsActionLoading(true);
    try {
      await slackApi.testNotification();
      onToast('success', 'Test alert message dispatched to Slack channel!');
    } catch (err: any) {
      onToast('error', err.response?.data?.error || err.message || 'Failed to send test alert');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMockConnect = async () => {
    setIsActionLoading(true);
    try {
      await slackApi.mockConnect();
      onToast('success', 'Simulated Slack connection activated for local testing');
      fetchStatus();
    } catch (err: any) {
      onToast('error', err.message);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-5 text-left">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-950/50 border border-indigo-800/40 text-indigo-400">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Slack Alert Integration</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Receive automatic alerts in your Slack channel whenever a sender reaches the hourly email limit.
            </p>
          </div>
        </div>

        <div>
          {status?.isConnected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              CONNECTED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
              <XCircle className="w-3.5 h-3.5" />
              NOT CONNECTED
            </span>
          )}
        </div>
      </div>

      <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs text-slate-300 space-y-2">
        <p className="font-semibold text-slate-200">How Rate-Limit Alerts Work:</p>
        <ul className="list-disc list-inside space-y-1 text-slate-400">
          <li>
            When an hourly limit (e.g. 200 emails/hour) is reached, pending emails are automatically rescheduled.
          </li>
          <li>A real-time Slack message is dispatched specifying the sender and the next available window.</li>
          <li>Alerts are deduplicated per hourly window using Redis atomic keys to prevent spam.</li>
        </ul>
      </div>

      {status?.isConnected && status.connection && (
        <div className="flex items-center gap-4 text-xs font-mono text-slate-400 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          <span>Team ID: <span className="text-slate-200">{status.connection.teamId}</span></span>
          <span>Channel: <span className="text-slate-200">{status.connection.channelId}</span></span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        {!status?.isConnected ? (
          <>
            <Button
              onClick={handleConnect}
              disabled={isLoading || isActionLoading}
              leftIcon={<Link className="w-4 h-4" />}
            >
              Connect Slack
            </Button>
            <Button
              variant="secondary"
              onClick={handleMockConnect}
              disabled={isLoading || isActionLoading}
            >
              Quick Demo Connect (Simulated)
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              onClick={handleTestNotification}
              disabled={isActionLoading}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Send Test Notification
            </Button>
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={isActionLoading}
              leftIcon={<Unlink className="w-4 h-4" />}
              className="text-rose-400 hover:text-rose-300 hover:border-rose-800"
            >
              Disconnect
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
