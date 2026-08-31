import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { ItemCard } from '../components/ItemCard';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { DateInput } from '../components/ui/DateInput';
import { Button } from '../components/ui/Button';
import { CustomSelect } from '../components/ui/CustomSelect';
import {
  Search as SearchIcon,
  Filter,
  RefreshCw,
  Star,
  X,
} from 'lucide-react';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [type, setType] = useState<string>('');
  const [tagId, setTagId] = useState<string>('');
  const [domain, setDomain] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: api.getTags,
  });

  const startDate = startDateStr ? new Date(startDateStr).getTime() : undefined;
  const endDate = endDateStr ? new Date(endDateStr).getTime() + 86400000 : undefined;

  const { data: searchResults, isLoading } = useQuery({
    queryKey: [
      'search',
      activeQuery,
      type,
      tagId,
      domain,
      status,
      favoriteOnly,
      startDate,
      endDate,
    ],
    queryFn: () =>
      api.search({
        q: activeQuery || undefined,
        type: (type || undefined) as any,
        tagId: tagId || undefined,
        domain: domain || undefined,
        status: (status || undefined) as any,
        favorite: favoriteOnly ? true : undefined,
        startDate,
        endDate,
      }),
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(query.trim());
  };

  const handleClearFilters = () => {
    setQuery('');
    setActiveQuery('');
    setType('');
    setTagId('');
    setDomain('');
    setStatus('');
    setFavoriteOnly(false);
    setStartDateStr('');
    setEndDateStr('');
  };

  const hasActiveFilters =
    Boolean(activeQuery) ||
    Boolean(type) ||
    Boolean(tagId) ||
    Boolean(domain) ||
    Boolean(status) ||
    favoriteOnly ||
    Boolean(startDateStr) ||
    Boolean(endDateStr);

  const items = searchResults?.items || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-stone-200/70 dark:border-stone-800 pb-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-2xs">
            <SearchIcon className="h-4.5 w-4.5" />
          </span>
          <h1 className="min-w-0 text-lg sm:text-xl font-bold leading-tight tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>全文检索</span>
            {hasActiveFilters && (
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                {items.length} 条匹配
              </span>
            )}
          </h1>
        </div>

        <Button
          variant={showFilters ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-1.5"
        >
          <Filter className="h-4 w-4" />
          <span>{showFilters ? '收起过滤' : '高级过滤'}</span>
        </Button>
      </header>

      {/* Search Input Box */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="输入关键词全文搜索（例如：良子 华哥、训练基地、Readability...）"
          className="w-full rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-stone-900 pl-11 pr-24 py-3.5 text-sm sm:text-base text-stone-900 dark:text-stone-100 shadow-2xs placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
        />
        <SearchIcon className="absolute left-4 top-4 h-5 w-5 text-stone-400" />
        <div className="absolute right-2.5 top-2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setActiveQuery('');
              }}
              className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <Button type="submit" variant="primary" size="sm" className="font-bold">
            检索
          </Button>
        </div>
      </form>

      {/* Multi-dimension Filter Panel */}
      {showFilters && (
        <div className="p-4 sm:p-5 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-2xs space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-rose-500" />
              <span>多维条件过滤</span>
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-xs text-rose-600 hover:underline font-medium"
              >
                重置全部条件
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {/* Type */}
            <div>
              <label className="text-stone-500 dark:text-stone-400 font-semibold block mb-1">
                素材类型
              </label>
              <CustomSelect
                size="sm"
                value={type}
                onChange={setType}
                placeholder="全部类型"
                options={[
                  { value: '', label: '全部类型' },
                  { value: 'url', label: '🌐 网页 (URL)' },
                  { value: 'note', label: '📝 备忘 (Note)' },
                  { value: 'image', label: '🖼 图片 (Image)' },
                  { value: 'document', label: '📄 文档 (Document)' },
                  { value: 'video', label: '🎬 视频 (Video)' },
                ]}
              />
            </div>

            {/* Tag */}
            <div>
              <label className="text-stone-500 dark:text-stone-400 font-semibold block mb-1">
                标签过滤
              </label>
              <CustomSelect
                size="sm"
                value={tagId}
                onChange={setTagId}
                placeholder="全部标签"
                options={[
                  { value: '', label: '全部标签' },
                  ...(tagsData?.tags.map((tg) => ({
                    value: tg.id,
                    label: `#${tg.name}`,
                  })) || []),
                ]}
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-stone-500 dark:text-stone-400 font-semibold block mb-1">
                整理状态
              </label>
              <CustomSelect
                size="sm"
                value={status}
                onChange={setStatus}
                placeholder="全部状态"
                options={[
                  { value: '', label: '全部状态' },
                  { value: 'inbox', label: '收件箱 (Inbox)' },
                  { value: 'organized', label: '已整理 (Organized)' },
                  { value: 'archived', label: '已归档 (Archived)' },
                ]}
              />
            </div>

            {/* Domain */}
            <div>
              <label className="text-stone-500 dark:text-stone-400 font-semibold block mb-1">
                来源域名
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="例如：bilibili.com"
                className="w-full rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            {/* Start Date */}
            <div>
              <label className="text-stone-500 dark:text-stone-400 font-semibold block mb-1">
                起始日期
              </label>
              <DateInput value={startDateStr} onChange={setStartDateStr} placeholder="起始日期" />
            </div>

            {/* End Date */}
            <div>
              <label className="text-stone-500 dark:text-stone-400 font-semibold block mb-1">
                截止日期
              </label>
              <DateInput value={endDateStr} onChange={setEndDateStr} placeholder="截止日期" />
            </div>

            {/* Favorite Checkbox */}
            <div className="flex items-center pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-stone-700 dark:text-stone-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={favoriteOnly}
                  onChange={(e) => setFavoriteOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 dark:border-stone-700 text-rose-600 focus:ring-rose-500"
                />
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                <span>仅看已收藏素材</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Search Results List */}
      <section className="space-y-3">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-stone-400">
            <RefreshCw className="h-6 w-6 animate-spin text-rose-500" />
            <span className="text-xs">执行全文索引搜索中...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center p-8 rounded-3xl border border-stone-200 dark:border-stone-800 bg-white/50 dark:bg-stone-900/50">
            <p className="text-sm font-semibold text-stone-600 dark:text-stone-400">
              未找到匹配的素材证据
            </p>
            <p className="text-xs text-stone-400 mt-1">
              尝试更换关键词或放宽过滤条件
            </p>
          </div>
        ) : (
          items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onClick={(it) => setActiveItemId(it.id)}
            />
          ))
        )}
      </section>

      {/* Item Detail Modal */}
      <ItemDetailModal
        itemId={activeItemId}
        isOpen={Boolean(activeItemId)}
        onClose={() => setActiveItemId(null)}
      />
    </div>
  );
}
