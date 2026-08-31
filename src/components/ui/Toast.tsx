import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContextType {
  toast: (options: { message: string; title?: string; type?: ToastType; duration?: number }) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ message, title, type = 'info', duration = 3000 }: { message: string; title?: string; type?: ToastType; duration?: number }) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, message, title, type, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((message: string, title?: string) => addToast({ message, title, type: 'success' }), [addToast]);
  const error = useCallback((message: string, title?: string) => addToast({ message, title, type: 'error', duration: 4500 }), [addToast]);
  const info = useCallback((message: string, title?: string) => addToast({ message, title, type: 'info' }), [addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast, success, error, info }}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            aria-live="polite"
            className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                role="alert"
                className={cn(
                  'pointer-events-auto flex items-start gap-3 rounded-xl p-3.5 shadow-modal border transition-all duration-200 animate-in slide-in-from-bottom-2',
                  t.type === 'success' && 'bg-white dark:bg-stone-900 border-emerald-500/30 text-stone-900 dark:text-stone-100',
                  t.type === 'error' && 'bg-white dark:bg-stone-900 border-rose-500/30 text-stone-900 dark:text-stone-100',
                  t.type === 'info' && 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100'
                )}
              >
                <div className="shrink-0 mt-0.5">
                  {t.type === 'success' && <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />}
                  {t.type === 'error' && <AlertCircle className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400" />}
                  {t.type === 'info' && <Info className="h-4.5 w-4.5 text-stone-500 dark:text-stone-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  {t.title && <div className="text-xs font-bold leading-tight">{t.title}</div>}
                  <div className="text-xs text-stone-600 dark:text-stone-300 leading-normal">{t.message}</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(t.id)}
                  className="shrink-0 rounded p-0.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
