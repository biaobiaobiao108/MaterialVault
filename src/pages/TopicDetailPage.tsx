import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Item } from '../lib/types';
import { ItemCard } from '../components/ItemCard';
import { QuickCapture } from '../components/QuickCapture';
import { TopicModal } from '../components/TopicModal';
import { TopicExportModal } from '../components/TopicExportModal';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import {
  FolderKanban,
  ArrowLeft,
  Sparkles,
  Edit2,
  Trash2,
  Layers,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { formatDate } from '../lib/utils';

export function TopicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['topic', id],
    queryFn: () => (id ? api.getTopic(id) : Promise.resolve(null)),
    enabled: Boolean(id),
  });

  const topic = data?.topic;
  const items = topic?.items || [];

  return (
    <div className="space-y-6">
      {/* Back button & Page header */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/topics')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>返回选题列表</span>
        </button>

        {isLoading || !topic ? (
          <div className="py-12 text-center text-stone-400 text-xs">加载选题中...</div>
        ) : (
          <div className="rounded-3xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={topic.status === 'active' ? 'emerald' : 'stone'}>
                    {topic.status === 'active' ? '进行中' : '已归档'}
                  </Badge>
                  {topic.externalTopicId && (
                    <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200/40">
                      看板: {topic.externalTopicId}
                    </span>
                  )}
                  <span className="text-xs font-mono text-stone-400">
                    创建于 {formatDate(topic.createdAt)}
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 leading-tight">
                  {topic.title}
                </h1>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setExportModalOpen(true)}
                  className="gap-1.5 font-bold"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>导出资料上下文</span>
                </Button>

                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => setTopicModalOpen(true)}
                  title="编辑选题信息"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {topic.description && (
              <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-300 leading-relaxed border-t border-stone-100 dark:border-stone-800/80 pt-3">
                {topic.description}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Quick Capture linked to this topic */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
          快速向该选题添加素材
        </h3>
        <QuickCapture onCaptured={() => queryClient.invalidateQueries({ queryKey: ['topic', id] })} />
      </section>

      {/* Topic Items Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>选题包含的素材证据</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
              {items.length}
            </span>
          </h2>
        </div>

        {items.length === 0 ? (
          <div className="py-12 text-center p-8 rounded-2xl border border-dashed border-stone-200 dark:border-stone-800 bg-white/50 dark:bg-stone-900/50">
            <p className="text-xs text-stone-500">
              该选题暂无关联素材。可在上方输入框直接添加，或在素材卡片中选择关联。
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

      {/* Modals */}
      <TopicModal
        isOpen={topicModalOpen}
        topic={topic}
        onClose={() => setTopicModalOpen(false)}
      />

      <TopicExportModal
        isOpen={exportModalOpen}
        topicId={id || null}
        onClose={() => setExportModalOpen(false)}
      />

      <ItemDetailModal
        itemId={activeItemId}
        isOpen={Boolean(activeItemId)}
        onClose={() => {
          setActiveItemId(null);
          queryClient.invalidateQueries({ queryKey: ['topic', id] });
        }}
      />
    </div>
  );
}
