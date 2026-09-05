import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { EmailStatus } from '../../types';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className,
  dot = false,
}) => {
  const variantStyles = {
    default: 'bg-slate-800 text-slate-300 border-slate-700/60',
    success: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40',
    warning: 'bg-amber-950/60 text-amber-400 border-amber-800/40',
    danger: 'bg-rose-950/60 text-rose-400 border-rose-800/40',
    info: 'bg-indigo-950/60 text-indigo-400 border-indigo-800/40',
  };

  const dotColors = {
    default: 'bg-slate-400',
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    info: 'bg-indigo-400',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border tracking-wide uppercase font-mono',
          variantStyles[variant],
          className
        )
      )}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full animate-pulse', dotColors[variant])} />}
      {children}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: EmailStatus | string }> = ({ status }) => {
  switch (status) {
    case 'SCHEDULED':
      return (
        <Badge variant="warning" dot>
          Scheduled
        </Badge>
      );
    case 'PROCESSING':
      return (
        <Badge variant="info" dot>
          Processing
        </Badge>
      );
    case 'SENT':
      return (
        <Badge variant="success">
          Sent
        </Badge>
      );
    case 'FAILED':
      return (
        <Badge variant="danger">
          Failed
        </Badge>
      );
    default:
      return <Badge>{status}</Badge>;
  }
};
