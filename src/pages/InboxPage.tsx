import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Item } from '../lib/types';
import { QuickCapture } from '../components/QuickCapture';
import { ItemCard } from '../components/ItemCard';
import { BatchActionBar } from '../components/BatchActionBar';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { RefreshCw, Tag as TagIcon, X } from 'lucide-react';
import { useToast } from '../components/ui/Toast';

export function InboxPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');

  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: api.getTags,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['items', 'inbox', typeFilter, tagFilter],
    queryFn: () =>
      api.getItems({
        status: 'inbox',
        type: (typeFilter || undefined) as any,
        tagId: tagFilter || undefined,
      }),
    refetchInterval: 6000,
  });

  const batchMutation = useMutation({
    mutationFn: api.batchAction,
    onSuccess: () => {
      toast.success('批量操作已完成');
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['vault-stats'] });
    },
    onError: (err: any) => toast.error(err.message || '批量操作失败'),
  });

  // Optimistic toggle favorite
  const toggleFavoriteMutation = useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      api.updateItem(id, { favorite }),
    onMutate: async ({ id, favorite }) => {
      await queryClient.cancelQueries({ queryKey: ['items'] });
      const previousData = queryClient.getQueryData(['items', 'inbox', typeFilter, tagFilter]);
      queryClient.setQueryData(['items', 'inbox', typeFilter, tagFilter], (old: any) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.map((it: Item) => (it.id === id ? { ...it, favorite } : it)),
        };
      });
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['items', 'inbox', typeFilter, tagFilter], context.previousData);
      }
      toast.error('操作失败');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['vault-stats'] });
    },
  });

  // Optimistic toggle organize
  const toggleOrganizedMutation = useMutation({
    mutationFn: ({ id, currentStatus }: { id: string; currentStatus: string }) =>
      api.updateItem(id, {
        organizationStatus: currentStatus === 'organized' ? 'inbox' : 'organized',
      }),
    onMutate: async ({ id, currentStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['items'] });
      const previousData = queryClient.getQueryData(['items', 'inbox', typeFilter, tagFilter]);
      queryClient.setQueryData(['items', 'inbox', typeFilter, tagFilter], (old: any) => {
        if (!old?.items) return old;
        // In inbox page, marking as organized removes it from view
        return {
          ...old,
          items: old.items.filter((it: Item) => it.id !== id),
        };
      });
      return { previousData };
    },
    onSuccess: (_, vars) => {
      toast.success(vars.currentStatus === 'organized' ? '已移回 Inbox' : '已标记为已整理');
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['items', 'inbox', typeFilter, tagFilter], context.previousData);
      }
      toast.error('操作失败');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['vault-stats'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.updateItem(id, { organizationStatus: 'archived' }),
    onSuccess: () => {
      toast.success('已归档');
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['vault-stats'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteItem,
    onSuccess: () => {
      toast.success('素材已删除');
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['vault-stats'] });
    },
  });

  const handleSelect = (id: string, isSelected: boolean) => {
    setSelectedIds((prev) =>
      isSelected ? [...prev, id] : prev.filter((item) => item !== id)
    );
  };

  const handleSelectAll = () => {
    if (!data?.items) return;
    if (selectedIds.length === data.items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.items.map((i) => i.id));
    }
  };

  const handleBatchAction = (action: string, payload?: any) => {
    batchMutation.mutate({
      itemIds: selectedIds,
      action: action as any,
      status: payload?.status,
      tagId: payload?.tagId,
    });
  };

  const items = data?.items || [];
  const tags = tagsData?.tags || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <header className="flex items-center justify-between gap-4 border-b border-stone-200/70 dark:border-stone-800 pb-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-xl overflow-hidden shadow-2xs border border-stone-200/60 dark:border-stone-800">
            <img src="/logo.png" alt="Inbox Logo" className="h-full w-full object-cover" />
          </div>
          <h1 className="min-w-0 text-lg sm:text-xl font-bold leading-tight tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>收件箱</span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
              {items.length} 待整理
            </span>
          </h1>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900 bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-xl transition-colors"
            >
              {selectedIds.length === items.length ? '取消全选' : '全选'}
            </button>
          </div>
        )}
      </header>

      {/* Quick Capture Input Box */}
      <section>
        <QuickCapture />
      </section>

      {/* Filter Chips Bar */}
      <div className="space-y-2">
        {/* Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {['', 'url', 'note', 'image', 'document', 'video'].map((typeKey) => (
            <button
              key={typeKey}
              type="button"
              onClick={() => setTypeFilter(typeKey)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors whitespace-nowrap ${
                typeFilter === typeKey
                  ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 font-bold'
                  : 'bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-300'
              }`}
            >
              {typeKey === ''
                ? '全部待整理'
                : typeKey === 'url'
                ? '🌐 网页'
                : typeKey === 'note'
                ? '📝 备忘'
                : typeKey === 'image'
                ? '🖼 图片'
                : typeKey === 'document'
                ? '📄 文档'
                : '🎬 视频'}
            </button>
          ))}
        </div>

        {/* Quick Tag Filter Bar */}
        {tags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] text-stone-400 flex items-center gap-1 font-mono shrink-0 pl-1">
              <TagIcon className="h-3 w-3 text-rose-500" />
              <span>标签筛选:</span>
            </span>
            {tags.slice(0, 10).map((t) => {
              const isSelected = tagFilter === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTagFilter(isSelected ? '' : t.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                    isSelected
                      ? 'bg-rose-600 text-white font-bold'
                      : 'bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:text-rose-600'
                  }`}
                >
                  <span>#{t.name}</span>
                  {isSelected && <X className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Item Cards List */}
      <section className="space-y-3">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-stone-400">
            <RefreshCw className="h-6 w-6 animate-spin text-rose-500" />
            <span className="text-xs">加载待整理素材...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center p-8 rounded-3xl border border-dashed border-stone-200 dark:border-stone-800 bg-white/50 dark:bg-stone-900/50">
            <div className="h-16 w-16 rounded-2xl overflow-hidden shadow-card border border-stone-200/80 dark:border-stone-700 mb-3 bg-amber-500/10 dark:bg-stone-800 p-1 animate-in zoom-in-95 duration-200">
              <img src="/logo.png" alt="Empty Inbox" className="h-full w-full object-contain" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Inbox 已清空！
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 max-w-sm mt-1 leading-relaxed">
              没有堆积的待整理素材。粘贴链接或记录一条灵感备忘开始收集。
            </p>
          </div>
        ) : (
          items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isSelected={selectedIds.includes(item.id)}
              onSelect={handleSelect}
              onClick={(it) => setActiveItemId(it.id)}
              onToggleFavorite={(id, fav) =>
                toggleFavoriteMutation.mutate({ id, favorite: !fav })
              }
              onToggleOrganized={(id, cur) =>
                toggleOrganizedMutation.mutate({ id, currentStatus: cur })
              }
              onArchive={(id) => archiveMutation.mutate(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))
        )}
      </section>

      {/* Floating Batch Action Bar */}
      <BatchActionBar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        onBatchAction={handleBatchAction}
        loading={batchMutation.isPending}
      />

      {/* Item Detail Modal */}
      <ItemDetailModal
        itemId={activeItemId}
        isOpen={Boolean(activeItemId)}
        onClose={() => setActiveItemId(null)}
      />
    </div>
  );
}
