import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface TableProps {
  headers: string[];
  children: React.ReactNode;
  className?: string;
}

export const Table: React.FC<TableProps> = ({ headers, children, className }) => {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40">
      <table className={twMerge(clsx('w-full text-left border-collapse text-sm', className))}>
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/80">
            {headers.map((header, idx) => (
              <th
                key={idx}
                className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 text-slate-300">{children}</tbody>
      </table>
    </div>
  );
};
