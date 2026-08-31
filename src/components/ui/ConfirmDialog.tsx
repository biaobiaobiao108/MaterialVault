import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, Info } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm" showClose={false}>
      <div className="flex items-start gap-3.5">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            variant === 'danger'
              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
              : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
          }`}
        >
          {variant === 'danger' ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-base font-bold text-stone-900 dark:text-stone-100 leading-tight">
            {title}
          </h4>
          <div className="mt-1.5 text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            {message}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
        <Button variant="secondary" size="md" onClick={onClose} disabled={loading} className="w-full sm:w-auto">
          {cancelText}
        </Button>
        <Button
          variant={variant === 'danger' ? 'danger' : 'primary'}
          size="md"
          loading={loading}
          onClick={onConfirm}
          className="w-full sm:w-auto"
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
