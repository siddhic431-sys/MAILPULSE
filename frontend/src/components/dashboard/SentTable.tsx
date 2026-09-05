import React, { useState, useEffect, useCallback } from 'react';
import { Search, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { Table } from '../common/Table';
import { StatusBadge } from '../common/Badge';
import { Pagination } from '../common/Pagination';
import { EmptyState } from '../common/EmptyState';
import { Spinner } from '../common/Spinner';
import { Button } from '../common/Button';
import { Email } from '../../types';
import { emailApi } from '../../services/api';

export const SentTable: React.FC<{ refreshTrigger: number }> = ({ refreshTrigger }) => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await emailApi.getSent(page, 10, search);
      if (res.success) {
        setEmails(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load delivered emails');
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchSent();
  }, [fetchSent, refreshTrigger]);

  return (
    <div className="space-y-4">
      {/* Top search & refresh bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search sent & failed emails..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchSent()}
          disabled={isLoading}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          className="self-end sm:self-auto"
        >
          Refresh
        </Button>
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
            <span className="text-sm">Fetching delivered emails...</span>
          </div>
        </div>
      ) : emails.length === 0 ? (
        /* Empty state */
        <EmptyState
          icon={CheckCircle2}
          title="No delivered emails yet"
          description={
            search
              ? `No sent emails match your query "${search}".`
              : 'As workers process your scheduled email jobs, successfully sent emails will appear here.'
          }
          actionLabel={search ? 'Clear Search' : undefined}
          onAction={() => setSearch('')}
        />
      ) : (
        /* Data Table */
        <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-900/40">
          <Table headers={['Recipient', 'Subject', 'Delivered At', 'Status', 'Message ID / Error']}>
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
                  {email.sentAt ? new Date(email.sentAt).toLocaleString() : '—'}
                </td>
                <td className="py-3.5 px-4">
                  <StatusBadge status={email.status} />
                </td>
                <td className="py-3.5 px-4 text-xs font-mono max-w-xs truncate">
                  {email.status === 'SENT' ? (
                    <span className="text-emerald-400/90 truncate block" title={email.messageId || ''}>
                      {email.messageId || 'Success'}
                    </span>
                  ) : (
                    <span
                      className="text-rose-400 truncate block flex items-center gap-1"
                      title={email.errorMessage || ''}
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {email.errorMessage || 'Send Failed'}
                    </span>
                  )}
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
