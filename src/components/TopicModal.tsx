import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Topic } from '../lib/types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';

export interface TopicModalProps {
  topic?: Topic | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TopicModal({ topic, isOpen, onClose }: TopicModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [externalTopicId, setExternalTopicId] = useState('');
  const [status, setStatus] = useState<'active' | 'archived'>('active');

  const toast = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (topic) {
      setTitle(topic.title);
      setDescription(topic.description || '');
      setExternalTopicId(topic.externalTopicId || '');
      setStatus(topic.status);
    } else {
      setTitle('');
      setDescription('');
      setExternalTopicId('');
      setStatus('active');
    }
  }, [topic, isOpen]);

  const createMutation = useMutation({
    mutationFn: api.createTopic,
    onSuccess: () => {
      toast.success('选题创建成功');
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['vault-stats'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || '创建选题失败'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.updateTopic(topic!.id, data),
    onSuccess: () => {
      toast.success('选题已更新');
      queryClient.invalidateQueries({ queryKey: ['topics'] });
      queryClient.invalidateQueries({ queryKey: ['topic', topic?.id] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || '更新选题失败'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (topic) {
      updateMutation.mutate({
        title: title.trim(),
        description: description.trim(),
        externalTopicId: externalTopicId.trim() || null,
        status,
      });
    } else {
      createMutation.mutate({
        title: title.trim(),
        description: description.trim(),
        externalTopicId: externalTopicId.trim() || undefined,
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={topic ? '编辑选题' : '创建新选题'}
      description="为视频创作聚合专属素材证据与思考笔记"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
            选题名称 *
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：大胃袋良子：峨眉山事件"
            className="w-full rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
            选题概述 / 背景说明
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简要描述该选题的核心争议、叙事主线或研究目标..."
            className="w-full rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800 p-3 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-500 leading-relaxed"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
            外部选题看板 ID (选填)
          </label>
          <input
            type="text"
            value={externalTopicId}
            onChange={(e) => setExternalTopicId(e.target.value)}
            placeholder="例如：KANBAN-104"
            className="w-full rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-xs font-mono text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        {topic && (
          <div>
            <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 block mb-1">
              状态
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="radio"
                  name="topic_status"
                  value="active"
                  checked={status === 'active'}
                  onChange={() => setStatus('active')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span>活跃进行中</span>
              </label>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="radio"
                  name="topic_status"
                  value="archived"
                  checked={status === 'archived'}
                  onChange={() => setStatus('archived')}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <span>已归档</span>
              </label>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100 dark:border-stone-800">
          <Button variant="ghost" size="md" type="button" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" size="md" type="submit" loading={isSaving} disabled={!title.trim()}>
            {topic ? '保存修改' : '创建选题'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
