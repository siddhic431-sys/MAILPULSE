import React, { useState, useEffect, useCallback } from 'react';
import { Search, Clock, RefreshCw, Mail } from 'lucide-react';
import { Table } from '../common/Table';
import { StatusBadge } from '../common/Badge';
import { Pagination } from '../common/Pagination';
import { EmptyState } from '../common/EmptyState';
import { Spinner } from '../common/Spinner';
import { Button } from '../common/Button';
import { Email } from '../../types';
import { emailApi } from '../../services/api';

export const ScheduledTable: React.FC<{ refreshTrigger: number; onComposeClick: () => void }> = ({
  refreshTrigger,
  onComposeClick,
}) => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScheduled = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await emailApi.getScheduled(page, 10, search);
      if (res.success) {
        setEmails(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load scheduled emails');
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchScheduled();
  }, [fetchScheduled, refreshTrigger]);

  return (
    <div className="space-y-4">
      {/* Top search & refresh bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search scheduled emails..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchScheduled()}
            disabled={isLoading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
          <Button size="sm" onClick={onComposeClick} leftIcon={<Mail className="w-3.5 h-3.5" />}>
            Compose New
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && emails.length === 0 ? (
        <div className="flex items-center justify-center p-12 border border-slate-800 rounded-2xl bg-slate-900/30">
          <div className="flex items-center gap-3 text-slate-400">
            <Spinner size="md" />
            <span className="text-sm">Fetching scheduled emails...</span>
          </div>
        </div>
      ) : emails.length === 0 ? (
        /* Empty state */
        <EmptyState
          icon={Clock}
          title="No scheduled emails found"
          description={
            search
              ? `No results match your query "${search}". Try adjusting your search.`
              : 'You have no pending or scheduled emails right now. Create a campaign to start delivering!'
          }
          actionLabel={search ? 'Clear Search' : 'Compose Email'}
          onAction={() => {
            if (search) {
              setSearch('');
            } else {
              onComposeClick();
            }
          }}
        />
      ) : (
        /* Data Table */
        <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-900/40">
          <Table headers={['Recipient', 'Subject', 'Scheduled Time', 'Status', 'BullMQ Job']}>
            {emails.map((email) => (
              <tr
                key={email.id}
                className="hover:bg-slate-800/40 transition-colors duration-150 text-left"
              >
                <td className="py-3.5 px-4 font-mono text-xs text-slate-200">{email.recipient}</td>
                <td className="py-3.5 px-4 text-slate-200 font-medium max-w-xs truncate">
                  {email.subject}
                </td>
                <td className="py-3.5 px-4 text-xs text-slate-400 font-mono">
                  {new Date(email.scheduledAt).toLocaleString()}
                </td>
                <td className="py-3.5 px-4">
                  <StatusBadge status={email.status} />
                </td>
                <td className="py-3.5 px-4 font-mono text-[11px] text-slate-400">
                  {email.bullmqJobId || 'Pending'}
                </td>
              </tr>
            ))}
          </Table>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            onPageChange={(p) => setPage(p)}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
};
