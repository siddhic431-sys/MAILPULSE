import React from 'react';
import { Clock, Send, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { EmailStats } from '../../types';

export const QueueStatsCard: React.FC<{ stats: EmailStats | null }> = ({ stats }) => {
  const cards = [
    {
      title: 'Scheduled',
      count: stats?.scheduled ?? 0,
      icon: Clock,
      color: 'text-amber-400',
      bgColor: 'bg-amber-950/30',
      borderColor: 'border-amber-800/30',
    },
    {
      title: 'Processing',
      count: stats?.processing ?? 0,
      icon: Send,
      color: 'text-sky-400',
      bgColor: 'bg-sky-950/30',
      borderColor: 'border-sky-800/30',
    },
    {
      title: 'Sent',
      count: stats?.sent ?? 0,
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-950/30',
      borderColor: 'border-emerald-800/30',
    },
    {
      title: 'Failed',
      count: stats?.failed ?? 0,
      icon: AlertTriangle,
      color: 'text-rose-400',
      bgColor: 'bg-rose-950/30',
      borderColor: 'border-rose-800/30',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`p-5 rounded-2xl border ${card.borderColor} ${card.bgColor} backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] text-left`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {card.title}
              </span>
              <div className={`p-2 rounded-xl bg-slate-900/60 ${card.color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-slate-100 tracking-tight font-mono">
                {card.count.toLocaleString()}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
