import React, { useState, useRef, useEffect } from 'react';
import {
  Link2,
  FileText,
  UploadCloud,
  CornerDownLeft,
  FolderKanban,
  Tag as TagIcon,
  Sparkles,
  Paperclip,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from './ui/Toast';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';

export function QuickCapture({ onCaptured }: { onCaptured?: () => void }) {
  const [content, setContent] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [showMetadataBar, setShowMetadataBar] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: topicsData } = useQuery({
    queryKey: ['topics'],
    queryFn: () => api.getTopics('active'),
  });

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: api.getTags,
  });

  const isUrl = /^https?:\/\/[^\s]+$/i.test(content.trim());

  // URL Capture Mutation
  const urlMutation = useMutation({
    mutationFn: api.captureUrl,
    onSuccess: (data) => {
      if (data.isDuplicate) {
        toast.info('该链接此前已保存在素材库中', '素材已存在');
      } else {
        toast.success('已保存至 Inbox，正在后台抓取并归档网页证据...', 'URL 已保存');
      }
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['vault-stats'] });
      onCaptured?.();
    },
    onError: (err: any) => {
      toast.error(err.message || 'URL 保存失败');
    },
  });

  // Note Mutation
  const noteMutation = useMutation({
    mutationFn: api.createNote,
    onSuccess: () => {
      toast.success('备忘已保存至 Inbox', '记录成功');
      setContent('');
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['vault-stats'] });
      onCaptured?.();
    },
    onError: (err: any) => {
      toast.error(err.message || '备忘保存失败');
    },
  });

  // File Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: api.uploadFiles,
    onSuccess: (data) => {
      toast.success(`成功保存 ${data.items.length} 个文件/截图`, '文件已归档');
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['vault-stats'] });
      onCaptured?.();
    },
    onError: (err: any) => {
      toast.error(err.message || '文件上传失败');
    },
  });

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    const topicIds = selectedTopicId ? [selectedTopicId] : undefined;
    const tagIds = selectedTagId ? [selectedTagId] : undefined;

    if (isUrl) {
      urlMutation.mutate({
        url: trimmed,
        topicIds,
        tagIds,
      });
    } else {
      noteMutation.mutate({
        content: trimmed,
        topicIds,
        tagIds,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to submit note; Enter for single-line URL
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Enter' && !e.shiftKey && isUrl) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFiles = (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('file', files[i]);
    }
    if (selectedTopicId) formData.append('topicIds', selectedTopicId);
    if (selectedTagId) formData.append('tagIds', selectedTagId);

    uploadMutation.mutate(formData);
  };

  // Paste Event handling (e.g. image paste anywhere or in input)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      handleFiles(files);
    }
  };

  const isSubmitting = urlMutation.isPending || noteMutation.isPending || uploadMutation.isPending;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files) {
          handleFiles(e.dataTransfer.files);
        }
      }}
      className={cn(
        'relative rounded-2xl border bg-white dark:bg-stone-900 shadow-2xs transition-all duration-200 focus-within:shadow-card focus-within:border-rose-500/50',
        isDragOver
          ? 'border-dashed border-rose-500 bg-rose-500/5 ring-4 ring-rose-500/10'
          : 'border-stone-200/90 dark:border-stone-800'
      )}
    >
      <form onSubmit={handleSubmit} className="p-3.5 sm:p-4">
        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={content.includes('\n') || content.length > 80 ? 3 : 2}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setShowMetadataBar(true)}
            placeholder="粘贴 URL、记录思考备忘，或直接拖入文件 / 粘贴截图..."
            className="w-full resize-none bg-transparent text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none leading-relaxed"
          />
        </div>

        {/* Action Controls Bar */}
        <div className="mt-2.5 pt-2.5 border-t border-stone-100 dark:border-stone-800/80 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center flex-wrap gap-2">
            {/* Quick Upload Button */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              title="选择上传图片、文档或音视频"
            >
              <Paperclip className="h-3.5 w-3.5 text-stone-400" />
              <span>添加附件</span>
            </button>

            {/* Quick Topic Selector */}
            <div className="relative">
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="appearance-none bg-stone-100 dark:bg-stone-800/80 border border-stone-200/60 dark:border-stone-700/60 rounded-lg pl-2 pr-6 py-1 text-xs text-stone-700 dark:text-stone-300 font-medium focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
              >
                <option value="">+ 关联选题</option>
                {topicsData?.topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <FolderKanban className="pointer-events-none absolute right-1.5 top-1.5 h-3.5 w-3.5 text-stone-400" />
            </div>

            {/* Quick Tag Selector */}
            <div className="relative">
              <select
                value={selectedTagId}
                onChange={(e) => setSelectedTagId(e.target.value)}
                className="appearance-none bg-stone-100 dark:bg-stone-800/80 border border-stone-200/60 dark:border-stone-700/60 rounded-lg pl-2 pr-6 py-1 text-xs text-stone-700 dark:text-stone-300 font-medium focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
              >
                <option value="">+ 关联标签</option>
                {tagsData?.tags.map((tg) => (
                  <option key={tg.id} value={tg.id}>
                    #{tg.name}
                  </option>
                ))}
              </select>
              <TagIcon className="pointer-events-none absolute right-1.5 top-1.5 h-3.5 w-3.5 text-stone-400" />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="hidden sm:inline text-[11px] text-stone-400 font-mono">
              {isUrl ? '按 Enter 保存' : 'Ctrl+Enter 提交'}
            </span>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isSubmitting}
              disabled={!content.trim()}
              className="gap-1.5 font-bold"
            >
              {isUrl ? <Link2 className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
              <span>保存素材</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
