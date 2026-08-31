import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Item } from '../lib/types';
import { ItemCard } from '../components/ItemCard';
import { BatchActionBar } from '../components/BatchActionBar';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { Layers, RefreshCw, Tag as TagIcon, X } from 'lucide-react';
import { useToast } from '../components/ui/Toast';

export function ItemsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'inbox' | 'organized' | 'archived' | 'favorite'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: api.getTags,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['items', activeTab, typeFilter, tagFilter],
    queryFn: () =>
      api.getItems({
        status: activeTab === 'all' || activeTab === 'favorite' ? undefined : activeTab,
        favorite: activeTab === 'favorite' ? true : undefined,
        type: (typeFilter || undefined) as any,
        tagId: tagFilter || undefined,
      }),
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
      const previousData = queryClient.getQueryData(['items', activeTab, typeFilter, tagFilter]);
      queryClient.setQueryData(['items', activeTab, typeFilter, tagFilter], (old: any) => {
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
        queryClient.setQueryData(['items', activeTab, typeFilter, tagFilter], context.previousData);
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
      const previousData = queryClient.getQueryData(['items', activeTab, typeFilter, tagFilter]);
      const nextStatus = currentStatus === 'organized' ? 'inbox' : 'organized';

      queryClient.setQueryData(['items', activeTab, typeFilter, tagFilter], (old: any) => {
        if (!old?.items) return old;
        return {
          ...old,
          items: old.items.map((it: Item) =>
            it.id === id ? { ...it, organizationStatus: nextStatus } : it
          ),
        };
      });
      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['items', activeTab, typeFilter, tagFilter], context.previousData);
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
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-stone-200/70 dark:border-stone-800 pb-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 shadow-2xs">
            <Layers className="h-4.5 w-4.5" />
          </span>
          <h1 className="min-w-0 text-lg sm:text-xl font-bold leading-tight tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>全部素材库</span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
              {items.length} 条
            </span>
          </h1>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900 bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-xl transition-colors"
          >
            {selectedIds.length === items.length ? '取消全选' : '全选'}
          </button>
        )}
      </header>

      {/* Tabs & Type Pills */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800/80 p-1 rounded-2xl">
            {[
              { id: 'all', label: '全部' },
              { id: 'inbox', label: '收件箱' },
              { id: 'organized', label: '已整理' },
              { id: 'favorite', label: '已收藏' },
              { id: 'archived', label: '已归档' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Type pills */}
          <div className="flex items-center gap-1.5 text-xs overflow-x-auto">
            {['', 'url', 'note', 'image', 'document', 'video'].map((tKey) => (
              <button
                key={tKey}
                type="button"
                onClick={() => setTypeFilter(tKey)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  typeFilter === tKey
                    ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 font-bold'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                {tKey === '' ? '全部类型' : tKey.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Tag Filter Bar */}
        {tags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] text-stone-400 flex items-center gap-1 font-mono shrink-0 pl-1">
              <TagIcon className="h-3 w-3 text-rose-500" />
              <span>标签筛选:</span>
            </span>
            {tags.slice(0, 12).map((t) => {
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

      {/* Cards list */}
      <section className="space-y-3">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-stone-400">
            <RefreshCw className="h-6 w-6 animate-spin text-rose-500" />
            <span className="text-xs">加载素材中...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center p-8 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white/50 dark:bg-stone-900/50">
            <p className="text-sm font-semibold text-stone-600 dark:text-stone-400">
              当前视图下无匹配素材
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

      {/* Batch Action Bar */}
      <BatchActionBar
        selectedIds={selectedIds}
        onClearSelection={() => setSelectedIds([])}
        onBatchAction={handleBatchAction}
        loading={batchMutation.isPending}
      />

      {/* Detail Modal */}
      <ItemDetailModal
        itemId={activeItemId}
        isOpen={Boolean(activeItemId)}
        onClose={() => setActiveItemId(null)}
      />
    </div>
  );
}
