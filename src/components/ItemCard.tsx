import React from 'react';
import {
  Globe,
  FileText,
  Image as ImageIcon,
  Film,
  FileBox,
  Star,
  CheckCircle2,
  Archive,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Play,
} from 'lucide-react';
import { Item } from '../lib/types';
import { Badge } from './ui/Badge';
import { useToast } from './ui/Toast';
import { cn, formatDate } from '../lib/utils';

export interface ItemCardProps {
  item: Item;
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onClick?: (item: Item) => void;
  onToggleFavorite?: (id: string, current: boolean) => void;
  onToggleOrganized?: (id: string, currentStatus: string) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRetry?: (id: string) => void;
}

export function ItemCard({
  item,
  isSelected = false,
  onSelect,
  onClick,
  onToggleFavorite,
  onToggleOrganized,
  onArchive,
}: ItemCardProps) {
  const [copied, setCopied] = React.useState(false);
  const toast = useToast();

  const getTypeIcon = () => {
    switch (item.type) {
      case 'url':
        return <Globe className="h-4 w-4 text-rose-500" />;
      case 'note':
        return <FileText className="h-4 w-4 text-amber-500" />;
      case 'image':
        return <ImageIcon className="h-4 w-4 text-emerald-500" />;
      case 'video':
        return <Film className="h-4 w-4 text-indigo-500" />;
      case 'document':
        return <FileBox className="h-4 w-4 text-sky-500" />;
      default:
        return <FileText className="h-4 w-4 text-stone-500" />;
    }
  };

  const getProcessingBadge = () => {
    if (item.processingStatus === 'pending' || item.processingStatus === 'processing') {
      return (
        <Badge variant="amber" size="sm">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>归档中...</span>
        </Badge>
      );
    }
    if (item.processingStatus === 'failed') {
      return (
        <Badge variant="rose" size="sm">
          <AlertTriangle className="h-3 w-3" />
          <span>抓取失败</span>
        </Badge>
      );
    }
    return null;
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = item.sourceUrl || item.contentText || item.title;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success(item.sourceUrl ? '链接已复制到剪贴板' : '正文已复制到剪贴板');
    setTimeout(() => setCopied(false), 2000);
  };

  const thumbnailAsset = item.assets?.find((a) => a.kind === 'thumbnail') ||
    item.assets?.find((a) => a.kind === 'screenshot') ||
    item.assets?.find((a) => a.kind === 'original' && a.mimeType.startsWith('image/'));

  const isOrganized = item.organizationStatus === 'organized';
  const isArchived = item.organizationStatus === 'archived';
  const isVideo = item.type === 'video' || (item.sourceDomain && (item.sourceDomain.includes('bilibili') || item.sourceDomain.includes('youtube') || item.sourceDomain.includes('youtu.be')));

  const isBilibili = item.sourceDomain?.includes('bilibili') || item.sourceDomain?.includes('b23.tv');
  const isYouTube = item.sourceDomain?.includes('youtube') || item.sourceDomain?.includes('youtu.be');

  // ==========================================
  // Layout A: Dedicated 16:9 Rich Video Card
  // ==========================================
  if (isVideo) {
    return (
      <div
        onClick={() => onClick?.(item)}
        className={cn(
          'group relative rounded-2xl border bg-white dark:bg-stone-900 shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:shadow-card cursor-pointer overflow-hidden flex flex-col',
          isSelected
            ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/[0.02]'
            : 'border-stone-200/80 dark:border-stone-800/90'
        )}
      >
        {/* 16:9 Video Cover Top Section */}
        <div className="relative aspect-video w-full bg-stone-950 overflow-hidden">
          {thumbnailAsset ? (
            <img
              src={`/api/assets/${thumbnailAsset.id}`}
              alt={item.title}
              loading="lazy"
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-stone-900 to-stone-950 text-stone-500">
              <Film className="h-8 w-8 text-rose-500/80 animate-pulse" />
              <span className="text-xs font-mono">
                {item.processingStatus === 'pending' || item.processingStatus === 'processing'
                  ? '正在解析高清封面...'
                  : '视频素材'}
              </span>
            </div>
          )}

          {/* Top Floating Glassmorphism Header */}
          <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-2 z-10">
            {/* Selection Checkbox & Platform Badge */}
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <div
                onClick={() => onSelect?.(item.id, !isSelected)}
                className="p-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 hover:bg-black/80 transition-colors cursor-pointer flex items-center justify-center shadow-xs"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  aria-label="选择此视频素材"
                  className="h-3.5 w-3.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
              </div>

              <span className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold tracking-wide flex items-center gap-1 shadow-xs">
                <Film className="h-3 w-3 text-rose-400" />
                <span>{isBilibili ? 'Bilibili' : isYouTube ? 'YouTube' : 'Video'}</span>
              </span>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 shadow-xs" onClick={(e) => e.stopPropagation()}>
              {/* Copy */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="p-1 text-stone-300 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors"
                title={item.sourceUrl ? '复制链接' : '复制正文'}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>

              {/* Open external */}
              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 text-stone-300 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors"
                  title="在新标签页中打开播放"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}

              {/* Favorite Toggle */}
              <button
                type="button"
                onClick={() => onToggleFavorite?.(item.id, item.favorite)}
                title={item.favorite ? '取消收藏' : '收藏'}
                className={cn(
                  'p-1 rounded-lg transition-colors',
                  item.favorite ? 'text-amber-400 bg-amber-400/20' : 'text-stone-300 hover:text-amber-400 hover:bg-white/10'
                )}
              >
                <Star className={cn('h-3.5 w-3.5', item.favorite && 'fill-amber-400')} />
              </button>

              {/* Organized Toggle */}
              <button
                type="button"
                onClick={() => onToggleOrganized?.(item.id, item.organizationStatus)}
                title={isOrganized ? '标为未整理 (放回收件箱)' : '标记为已整理'}
                className={cn(
                  'p-1 rounded-lg transition-colors',
                  isOrganized ? 'text-emerald-400 bg-emerald-400/20' : 'text-stone-300 hover:text-emerald-400 hover:bg-white/10'
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </button>

              {/* Archive Toggle */}
              <button
                type="button"
                onClick={() => onArchive?.(item.id)}
                title={isArchived ? '移出归档' : '归档'}
                className={cn(
                  'p-1 rounded-lg transition-colors',
                  isArchived ? 'text-indigo-400 bg-indigo-400/20' : 'text-stone-300 hover:text-indigo-400 hover:bg-white/10'
                )}
              >
                <Archive className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Center Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="p-3 rounded-full bg-black/60 text-white shadow-xl backdrop-blur-xs group-hover:scale-110 group-hover:bg-rose-600/90 transition-all duration-200 border border-white/20">
              <Play className="h-5 w-5 fill-current ml-0.5" />
            </div>
          </div>

          {/* Bottom Overlay Status */}
          <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between text-xs pointer-events-none">
            <div className="pointer-events-auto">
              {getProcessingBadge()}
            </div>

            <time dateTime={new Date(item.createdAt).toISOString()} className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[11px] font-mono tabular-nums text-stone-300 border border-white/10">
              {formatDate(item.createdAt)}
            </time>
          </div>
        </div>

        {/* Card Content Bottom Section */}
        <div className="p-4 flex-1 flex flex-col justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold leading-snug text-stone-900 dark:text-stone-100 line-clamp-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
              {item.title}
            </h3>

            {/* Description / Content text */}
            {item.description ? (
              <p className="mt-1.5 text-xs sm:text-sm text-stone-600 dark:text-stone-300 line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            ) : item.contentText ? (
              <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400 line-clamp-2 font-mono leading-relaxed bg-stone-50 dark:bg-stone-800/40 p-2 rounded-lg border border-stone-100 dark:border-stone-800/50">
                {item.contentText.slice(0, 160)}
              </p>
            ) : null}
          </div>

          {/* Tags Badges with Tag Pivoting */}
          {item.tags && item.tags.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap pt-2 border-t border-stone-100 dark:border-stone-800/60">
              {item.tags.map((tag) => (
                <span
                  key={tag.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/search?tagId=${tag.id}`;
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-medium hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  title={`点击查看包含 #${tag.name} 的所有素材`}
                >
                  <span>#{tag.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // Layout B: Compact Standard Card (Notes, Articles, Docs)
  // ==========================================
  return (
    <div
      onClick={() => onClick?.(item)}
      className={cn(
        'group relative rounded-2xl border bg-white dark:bg-stone-900 p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card cursor-pointer',
        isSelected
          ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-500/[0.02]'
          : 'border-stone-200/80 dark:border-stone-800/90'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Selection Checkbox */}
        <div
          className="pt-0.5"
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(item.id, !isSelected);
          }}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            aria-label="选择此素材"
            className="h-4 w-4 rounded-md border-stone-300 dark:border-stone-700 text-rose-600 focus:ring-rose-500 cursor-pointer"
          />
        </div>

        {/* Card Main Body */}
        <div className="min-w-0 flex-1">
          {/* Header Row: Type, Status, Domain, Date, Quick Hover Tools */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-stone-500 dark:text-stone-400 mb-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 font-medium text-stone-700 dark:text-stone-300">
                {getTypeIcon()}
                <span className="uppercase text-[11px] font-bold tracking-wider">{item.type}</span>
              </span>

              {item.sourceDomain && (
                <span className="font-mono text-[11px] text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md">
                  {item.sourceDomain}
                </span>
              )}

              {getProcessingBadge()}
            </div>

            <div className="flex items-center gap-2">
              {/* Quick Copy Link / Text button */}
              <button
                type="button"
                onClick={handleCopyLink}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md"
                title={item.sourceUrl ? '复制链接' : '复制正文'}
              >
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? '已复制' : '复制'}</span>
              </button>

              {/* Direct Open in new tab button */}
              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-stone-400 hover:text-rose-600 rounded"
                  title="在新标签页中打开原网页"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}

              <time dateTime={new Date(item.createdAt).toISOString()} className="text-[11px] font-mono tabular-nums text-stone-400">
                {formatDate(item.createdAt)}
              </time>
            </div>
          </div>

          {/* Title & Thumbnail Grid */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-bold leading-snug text-stone-900 dark:text-stone-100 line-clamp-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                {item.title}
              </h3>

              {/* Description snippet / Note text */}
              {item.description ? (
                <p className="mt-1.5 text-xs sm:text-sm text-stone-600 dark:text-stone-300 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              ) : item.contentText ? (
                <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400 line-clamp-2 font-mono leading-relaxed bg-stone-50 dark:bg-stone-800/40 p-2 rounded-lg border border-stone-100 dark:border-stone-800/50">
                  {item.contentText.slice(0, 160)}
                </p>
              ) : null}
            </div>

            {/* Thumbnail Preview for Images / Screenshots */}
            {thumbnailAsset && (
              <div className="shrink-0 relative h-16 w-24 sm:h-18 sm:w-28 rounded-xl overflow-hidden border border-stone-200/80 dark:border-stone-800 bg-stone-950 shadow-2xs group/thumb">
                <img
                  src={`/api/assets/${thumbnailAsset.id}`}
                  alt={item.title}
                  loading="lazy"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </div>
            )}
          </div>

          {/* Tags Badges with Tag Pivoting */}
          {item.tags && item.tags.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              {item.tags.map((tag) => (
                <span
                  key={tag.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/search?tagId=${tag.id}`;
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-medium hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                  title={`点击查看包含 #${tag.name} 的所有素材`}
                >
                  <span>#{tag.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right Action Icons */}
        <div
          className="flex flex-col items-center gap-1 shrink-0 pt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Favorite Toggle */}
          <button
            type="button"
            onClick={() => onToggleFavorite?.(item.id, item.favorite)}
            title={item.favorite ? '取消收藏' : '收藏'}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              item.favorite
                ? 'text-amber-500 hover:text-amber-600 bg-amber-500/10'
                : 'text-stone-300 hover:text-amber-500 hover:bg-stone-100 dark:hover:bg-stone-800'
            )}
          >
            <Star className={cn('h-4 w-4', item.favorite && 'fill-amber-500')} />
          </button>

          {/* Mark Organized / Inbox Toggle */}
          <button
            type="button"
            onClick={() => onToggleOrganized?.(item.id, item.organizationStatus)}
            title={isOrganized ? '标为未整理 (放回收件箱)' : '标记为已整理'}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              isOrganized
                ? 'text-emerald-600 bg-emerald-500/10'
                : 'text-stone-300 hover:text-emerald-600 hover:bg-stone-100 dark:hover:bg-stone-800'
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>

          {/* Archive Toggle */}
          <button
            type="button"
            onClick={() => onArchive?.(item.id)}
            title={isArchived ? '移出归档' : '归档'}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              isArchived
                ? 'text-indigo-600 bg-indigo-500/10'
                : 'text-stone-300 hover:text-indigo-600 hover:bg-stone-100 dark:hover:bg-stone-800'
            )}
          >
            <Archive className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
