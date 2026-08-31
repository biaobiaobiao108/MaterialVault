import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'stone' | 'rose' | 'emerald' | 'amber' | 'indigo' | 'sky' | 'purple' | 'teal';
  size?: 'sm' | 'md';
}

export function Badge({ className, variant = 'stone', size = 'sm', children, ...props }: BadgeProps) {
  const variants = {
    stone:
      'bg-stone-500/10 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-200/60 dark:border-stone-700/50',
    rose:
      'bg-rose-500/10 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/40',
    emerald:
      'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40',
    amber:
      'bg-amber-500/10 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40',
    indigo:
      'bg-indigo-500/10 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40',
    sky:
      'bg-sky-500/10 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/40',
    purple:
      'bg-purple-500/10 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40',
    teal:
      'bg-teal-500/10 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/40',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[11px] font-medium gap-1',
    md: 'px-2.5 py-1 text-xs font-semibold gap-1.5',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full leading-none whitespace-nowrap select-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
