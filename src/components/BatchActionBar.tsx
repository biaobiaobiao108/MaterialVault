import React, { useState } from 'react';
import {
  CheckCircle2,
  Tag as TagIcon,
  Archive,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from './ui/Button';
import { ConfirmDialog } from './ui/ConfirmDialog';

export interface BatchActionBarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onBatchAction: (action: string, payload?: any) => void;
  loading?: boolean;
}

export function BatchActionBar({
  selectedIds,
  onClearSelection,
  onBatchAction,
  loading = false,
}: BatchActionBarProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: api.getTags,
  });

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-2xl bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/90 dark:border-stone-800 shadow-modal p-2.5 sm:p-3 flex items-center justify-between gap-2.5 animate-in slide-in-from-bottom-5 duration-200">
        <div className="flex items-center gap-2 pl-2">
          <span className="h-6 px-2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-mono tabular-nums font-bold flex items-center justify-center">
            {selectedIds.length}
          </span>
          <span className="text-xs font-semibold text-stone-700 dark:text-stone-300 hidden sm:inline">
            项已选中
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
            title="取消选择"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Mark Organized */}
          <Button
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={() => onBatchAction('set_status', { status: 'organized' })}
            title="标记已整理"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden md:inline">已整理</span>
          </Button>

          {/* Associate Tag Dropdown */}
          <div className="relative">
            <Button
              variant="secondary"
              size="sm"
              disabled={loading}
              onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
            >
              <TagIcon className="h-3.5 w-3.5 text-amber-500" />
              <span>添加标签</span>
            </Button>
            {tagDropdownOpen && (
              <div className="absolute bottom-full mb-2 left-0 w-40 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-1 shadow-card z-50">
                <div className="p-1.5 text-[11px] font-bold text-stone-400">选择标签</div>
                {tagsData?.tags.map((tg) => (
                  <button
                    key={tg.id}
                    type="button"
                    onClick={() => {
                      onBatchAction('add_tag', { tagId: tg.id });
                      setTagDropdownOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 truncate"
                  >
                    #{tg.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Favorite */}
          <Button
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={() => onBatchAction('favorite')}
            title="批量收藏"
          >
            <Star className="h-3.5 w-3.5 text-amber-500" />
          </Button>

          {/* Archive */}
          <Button
            variant="secondary"
            size="sm"
            disabled={loading}
            onClick={() => onBatchAction('set_status', { status: 'archived' })}
            title="批量归档"
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>

          {/* Delete */}
          <Button
            variant="danger"
            size="sm"
            disabled={loading}
            onClick={() => setDeleteConfirmOpen(true)}
            title="批量删除"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          setDeleteConfirmOpen(false);
          onBatchAction('delete');
        }}
        title="确认批量删除素材？"
        message={`确定要删除选中的 ${selectedIds.length} 条素材吗？此操作无法撤销。`}
        confirmText="确认删除"
        variant="danger"
      />
    </>
  );
}
