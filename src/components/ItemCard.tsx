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
} from 'lucide-react';
import { Item } from '../lib/types';
import { Badge } from './ui/Badge';
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

  const isOrganized = item.organizationStatus === 'organized';
  const isArchived = item.organizationStatus === 'archived';

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
          {/* Header Row: Type, Status, Domain, Date */}
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

            <time dateTime={new Date(item.createdAt).toISOString()} className="text-[11px] font-mono tabular-nums text-stone-400">
              {formatDate(item.createdAt)}
            </time>
          </div>

          {/* Title */}
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

          {/* Tags Badges */}
          {item.tags && item.tags.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              {item.tags.map((tag) => (
                <Badge key={tag.id} variant="stone" size="sm">
                  <span>#{tag.name}</span>
                </Badge>
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
