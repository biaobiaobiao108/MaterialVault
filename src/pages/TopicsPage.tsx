import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Topic } from '../lib/types';
import { TopicModal } from '../components/TopicModal';
import { TopicExportModal } from '../components/TopicExportModal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';
import {
  FolderKanban,
  Plus,
  Sparkles,
  ExternalLink,
  Edit2,
  Trash2,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { formatDate } from '../lib/utils';

export function TopicsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [exportTopicId, setExportTopicId] = useState<string | null>(null);
  const [deleteTopicId, setDeleteTopicId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['topics', activeTab],
    queryFn: () => api.getTopics(activeTab),
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteTopic,
    onSuccess: () => {
      toast.success('选题已删除');
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['vault-stats'] });
      setDeleteTopicId(null);
    },
    onError: (err: any) => toast.error(err.message || '删除失败'),
  });

  const topics = data?.topics || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-stone-200/70 dark:border-stone-800 pb-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-2xs">
            <FolderKanban className="h-4.5 w-4.5" />
          </span>
          <h1 className="min-w-0 text-lg sm:text-xl font-bold leading-tight tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <span>选题资料库</span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              {topics.length} 个选题
            </span>
          </h1>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setEditingTopic(null);
            setTopicModalOpen(true);
          }}
          className="gap-1.5 font-bold"
        >
          <Plus className="h-4 w-4" />
          <span>新建选题</span>
        </Button>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-800/80 p-1 rounded-2xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'active'
              ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs'
              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          进行中选题
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('archived')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'archived'
              ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs'
              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          已归档选题
        </button>
      </div>

      {/* Topics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          <div className="col-span-full py-16 text-center text-xs text-stone-400">
            加载选题列表中...
          </div>
        ) : topics.length === 0 ? (
          <div className="col-span-full py-16 text-center p-8 rounded-3xl border border-dashed border-stone-200 dark:border-stone-800">
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
              暂无{activeTab === 'active' ? '进行中' : '已归档'}选题
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              点击右上角“新建选题”开始聚合视频资料
            </p>
          </div>
        ) : (
          topics.map((topic) => (
            <div
              key={topic.id}
              onClick={() => navigate(`/topics/${topic.id}`)}
              className="group relative rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 shadow-2xs hover:shadow-card hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors leading-snug">
                    {topic.title}
                  </h3>
                  <Badge variant="stone" size="sm">
                    <Layers className="h-3 w-3 opacity-70" />
                    <span className="font-mono tabular-nums font-bold">
                      {topic.itemCount || 0}
                    </span>
                    <span>条资料</span>
                  </Badge>
                </div>

                {/* Description */}
                {topic.description && (
                  <p className="mt-2 text-xs text-stone-600 dark:text-stone-400 line-clamp-2 leading-relaxed">
                    {topic.description}
                  </p>
                )}

                {/* External Kanban ID Badge */}
                {topic.externalTopicId && (
                  <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200/40">
                    <span>看板: {topic.externalTopicId}</span>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div
                className="mt-5 pt-3 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[11px] font-mono text-stone-400">
                  {formatDate(topic.updatedAt)}
                </span>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setExportTopicId(topic.id)}
                    title="导出 AI Context / Excalidraw"
                    className="gap-1 text-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-rose-500" />
                    <span>导出资料</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingTopic(topic);
                      setTopicModalOpen(true);
                    }}
                    title="编辑选题"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTopicId(topic.id)}
                    title="删除选题"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      <TopicModal
        isOpen={topicModalOpen}
        topic={editingTopic}
        onClose={() => setTopicModalOpen(false)}
      />

      <TopicExportModal
        isOpen={Boolean(exportTopicId)}
        topicId={exportTopicId}
        onClose={() => setExportTopicId(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTopicId)}
        onClose={() => setDeleteTopicId(null)}
        onConfirm={() => deleteTopicId && deleteMutation.mutate(deleteTopicId)}
        title="确认删除该选题？"
        message="删除选题不会删除关联的素材本身，素材将继续保留在全部素材库中。"
        confirmText="确认删除"
        variant="danger"
      />
    </div>
  );
}
