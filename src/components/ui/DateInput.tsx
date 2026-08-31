import React, { useState } from 'react';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DateInputProps {
  value?: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function DateInput({ value, onChange, placeholder = '选择日期...', className }: DateInputProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Quick presets
  const setToday = () => {
    const d = new Date();
    onChange(d.toISOString().slice(0, 10));
    setIsOpen(false);
  };

  const setYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    onChange(d.toISOString().slice(0, 10));
    setIsOpen(false);
  };

  const setPastWeek = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    onChange(d.toISOString().slice(0, 10));
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      <div className="relative flex items-center">
        <input
          type="text"
          readOnly
          value={value || ''}
          placeholder={placeholder}
          onClick={() => setIsOpen(!isOpen)}
          className="min-h-10 w-full cursor-pointer rounded-xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 pl-9 pr-8 text-xs sm:text-sm text-stone-900 dark:text-stone-100 shadow-2xs placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
        />
        <CalendarIcon className="pointer-events-none absolute left-3 h-4 w-4 text-stone-400" />
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
            className="absolute right-2.5 rounded p-0.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-stone-900 p-3 shadow-card animate-in fade-in zoom-in-95 duration-150">
          <div className="text-xs font-bold text-stone-700 dark:text-stone-300 pb-2 border-b border-stone-100 dark:border-stone-800">
            快捷日期选择
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={setToday}
              className="rounded-lg bg-stone-100 dark:bg-stone-800 px-2 py-1.5 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
            >
              今天
            </button>
            <button
              type="button"
              onClick={setYesterday}
              className="rounded-lg bg-stone-100 dark:bg-stone-800 px-2 py-1.5 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
            >
              昨天
            </button>
            <button
              type="button"
              onClick={setPastWeek}
              className="rounded-lg bg-stone-100 dark:bg-stone-800 px-2 py-1.5 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
            >
              7天前
            </button>
          </div>
          <div className="mt-3">
            <label className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 block mb-1">
              指定日期 (YYYY-MM-DD)
            </label>
            <input
              type="text"
              placeholder="2026-07-28"
              defaultValue={value || ''}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onChange((e.target as HTMLInputElement).value);
                  setIsOpen(false);
                }
              }}
              onBlur={(e) => {
                if (e.target.value) onChange(e.target.value);
              }}
              className="w-full rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-2.5 py-1.5 text-xs font-mono text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
