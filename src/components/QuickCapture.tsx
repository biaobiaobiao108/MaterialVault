import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Link2,
  FileText,
  Tag as TagIcon,
  Paperclip,
  Hash,
  X,
  Globe,
  Sparkles,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from './ui/Toast';
import { Button } from './ui/Button';
import { CustomSelect } from './ui/CustomSelect';
import { cn, formatBytes } from '../lib/utils';

export function QuickCapture({ onCaptured }: { onCaptured?: () => void }) {
  const [content, setContent] = useState('');
  const [pendingFiles, setPendingFiles] = useState<{ file: File; previewUrl?: string }[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [hashtagQuery, setHashtagQuery] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: api.getTags,
  });

  // Global paste handler to automatically capture when pasting anywhere on page
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

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
        return;
      }

      const text = e.clipboardData?.getData('text');
      if (text && text.trim()) {
        e.preventDefault();
        setContent((prev) => (prev ? `${prev}\n${text.trim()}` : text.trim()));
        textareaRef.current?.focus();
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  // Extract real-time #tags from current input text
  const extractedTags = useMemo(() => {
    if (!content) return [];
    const matches = content.match(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu);
    if (!matches) return [];
    const set = new Set<string>();
    for (const m of matches) {
      const clean = m.trim().replace(/^#/, '').trim();
      if (clean.length > 0) set.add(clean);
    }
    return Array.from(set);
  }, [content]);

  // Autocomplete matching tags based on cursor position
  const autocompleteSuggestions = useMemo(() => {
    if (hashtagQuery === null || !tagsData?.tags) return [];
    const query = hashtagQuery.toLowerCase();
    return tagsData.tags
      .filter((t) => t.name.toLowerCase().includes(query) && !extractedTags.includes(t.name))
      .slice(0, 6);
  }, [hashtagQuery, tagsData, extractedTags]);

  const isUrl = /^https?:\/\/[^\s]+$/i.test(content.trim());
  const urlDomain = useMemo(() => {
    if (!isUrl) return null;
    try {
      return new URL(content.trim()).hostname.replace(/^www\./, '');
    } catch (_) {
      return null;
    }
  }, [content, isUrl]);

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
      setSelectedTagId('');
      setHashtagQuery(null);
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
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
      setSelectedTagId('');
      setHashtagQuery(null);
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
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
      toast.success(`成功保存 ${data.items.length} 个附件素材`, '归档成功');
      pendingFiles.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
      setPendingFiles([]);
      setContent('');
      setSelectedTagId('');
      setHashtagQuery(null);
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
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
    if (!trimmed && pendingFiles.length === 0) return;

    const tagIds = selectedTagId ? [selectedTagId] : undefined;

    // Case 1: Upload staged files with user's written note & tags
    if (pendingFiles.length > 0) {
      const formData = new FormData();
      pendingFiles.forEach((p) => formData.append('file', p.file));
      if (trimmed) {
        formData.append('description', trimmed);
      }
      if (selectedTagId) {
        formData.append('tagIds', selectedTagId);
      }
      uploadMutation.mutate(formData);
      return;
    }

    // Case 2: URL capture
    if (isUrl) {
      urlMutation.mutate({
        url: trimmed,
        tagIds,
      });
      return;
    }

    // Case 3: Note
    noteMutation.mutate({
      content: trimmed,
      tagIds,
    });
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    setContent(val);

    // Detect if cursor is directly after a #tag
    const textBeforeCursor = val.slice(0, cursorPos);
    const hashMatch = textBeforeCursor.match(/(?:^|\s)#([\p{L}\p{N}_-]*)$/u);

    if (hashMatch) {
      setHashtagQuery(hashMatch[1]);
      setSelectedIndex(0);
    } else {
      setHashtagQuery(null);
    }
  };

  const applyAutocompleteTag = (tagName: string) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = content.slice(0, cursorPos);
    const textAfterCursor = content.slice(cursorPos);

    const hashMatch = textBeforeCursor.match(/(?:^|\s)#([\p{L}\p{N}_-]*)$/u);
    if (hashMatch) {
      const matchIndex = hashMatch.index! + (hashMatch[0].startsWith(' ') ? 1 : 0);
      const newText = content.slice(0, matchIndex) + `#${tagName} ` + textAfterCursor;
      setContent(newText);
      setHashtagQuery(null);
      setTimeout(() => {
        const nextPos = matchIndex + tagName.length + 2;
        textarea.focus();
        textarea.setSelectionRange(nextPos, nextPos);
      }, 10);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Autocomplete navigation
    if (hashtagQuery !== null && autocompleteSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % autocompleteSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + autocompleteSuggestions.length) % autocompleteSuggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applyAutocompleteTag(autocompleteSuggestions[selectedIndex].name);
        return;
      }
      if (e.key === 'Escape') {
        setHashtagQuery(null);
        return;
      }
    }

    // Ctrl+Enter or Cmd+Enter to submit; Enter for single-line URL (when no pending files)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Enter' && !e.shiftKey && isUrl && pendingFiles.length === 0) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFiles = (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const newPending = Array.from(files).map((file) => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }));
    setPendingFiles((prev) => [...prev, ...newPending]);
    textareaRef.current?.focus();
  };

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

  const insertTagToContent = (tagName: string) => {
    if (!content.includes(`#${tagName}`)) {
      setContent((prev) => (prev ? `${prev.trim()} #${tagName} ` : `#${tagName} `));
      textareaRef.current?.focus();
    }
  };

  const removeTagFromContent = (tagName: string) => {
    const regex = new RegExp(`(?:^|\\s)#${tagName}(?=\\s|$)`, 'g');
    setContent((prev) => prev.replace(regex, ' ').trim());
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
        {/* URL Pill Badge if single-line URL detected */}
        {isUrl && urlDomain && (
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-500/20">
              <Globe className="h-3.5 w-3.5" />
              <span>检测到网页链接 · 来源域名: <strong className="font-mono">{urlDomain}</strong></span>
            </span>
          </div>
        )}

        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={content.includes('\n') || content.length > 80 ? 3 : 2}
            value={content}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="粘贴 URL、记录思考备忘（输入 #标签 可自动补全归类），或拖入文件 / 粘贴截图..."
            className="w-full resize-none bg-transparent text-xs sm:text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none leading-relaxed pr-8"
          />

          {/* Quick Clear Content Button */}
          {content && (
            <button
              type="button"
              onClick={() => {
                setContent('');
                setHashtagQuery(null);
                textareaRef.current?.focus();
              }}
              className="absolute top-0 right-0 p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              title="清空输入"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Inline Hashtag Autocomplete Dropdown Popover */}
          {hashtagQuery !== null && autocompleteSuggestions.length > 0 && (
            <div className="absolute top-full mt-1 left-0 z-50 w-64 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-modal p-1 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-stone-400 border-b border-stone-100 dark:border-stone-800 mb-1">
                <span className="flex items-center gap-1 font-mono">
                  <Sparkles className="h-3 w-3 text-rose-500" />
                  <span>匹配已有标签</span>
                </span>
                <span className="text-[10px] font-mono">Enter 补全</span>
              </div>
              <div className="space-y-0.5">
                {autocompleteSuggestions.map((t, idx) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyAutocompleteTag(t.name)}
                    className={cn(
                      'w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      idx === selectedIndex
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold'
                        : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                    )}
                  >
                    <span>#{t.name}</span>
                    {t.itemCount ? (
                      <span className="text-[10px] text-stone-400 font-mono tabular-nums">
                        {t.itemCount} 项
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Staged Pending Files / Images Preview Tray */}
        {pendingFiles.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-2.5 pb-1">
            {pendingFiles.map((p, idx) => (
              <div
                key={idx}
                className="group/file flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-800/70 shadow-2xs text-xs animate-in fade-in zoom-in-95 duration-100"
              >
                {p.previewUrl ? (
                  <img
                    src={p.previewUrl}
                    alt={p.file.name}
                    className="h-9 w-12 object-cover rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-900 shadow-2xs"
                  />
                ) : (
                  <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                    <Paperclip className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 max-w-[130px]">
                  <div className="truncate font-semibold text-stone-800 dark:text-stone-200 text-[11px] leading-tight" title={p.file.name}>
                    {p.file.name}
                  </div>
                  <div className="text-[10px] text-stone-400 font-mono">
                    {formatBytes(p.file.size)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
                    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  className="p-1 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  title="移除此附件"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Real-time Extracted Hashtag Badges */}
        {extractedTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1.5 pb-1 text-xs">
            <span className="text-[11px] text-stone-400 flex items-center gap-1 font-mono">
              <Hash className="h-3 w-3 text-rose-500" />
              <span>已提取标签:</span>
            </span>
            {extractedTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium text-xs border border-rose-500/20 shadow-2xs"
              >
                <span>#{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTagFromContent(tag)}
                  className="text-rose-400 hover:text-rose-600 dark:hover:text-rose-300"
                  title="移除标签"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

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

            {/* Quick Tag Selector */}
            <div className="w-36 sm:w-44">
              <CustomSelect
                size="sm"
                value={selectedTagId}
                onChange={(val) => {
                  setSelectedTagId(val);
                  const selectedTag = tagsData?.tags.find((t) => t.id === val);
                  if (selectedTag) {
                    insertTagToContent(selectedTag.name);
                  }
                }}
                placeholder="+ 选择标签 / 输入#标签"
                options={[
                  { value: '', label: '无额外标签' },
                  ...(tagsData?.tags.map((tg) => ({
                    value: tg.id,
                    label: `#${tg.name}`,
                    icon: <TagIcon className="h-3 w-3 text-rose-500" />,
                  })) || []),
                ]}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="hidden sm:inline text-[11px] text-stone-400 font-mono">
              {pendingFiles.length > 0
                ? 'Ctrl+Enter 提交'
                : isUrl
                ? '按 Enter 保存'
                : 'Ctrl+Enter 提交'}
            </span>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={isSubmitting}
              disabled={!content.trim() && pendingFiles.length === 0}
              className="gap-1.5 font-bold"
            >
              {pendingFiles.length > 0 ? (
                <>
                  <Paperclip className="h-3.5 w-3.5" />
                  <span>保存附件 ({pendingFiles.length})</span>
                </>
              ) : isUrl ? (
                <>
                  <Link2 className="h-3.5 w-3.5" />
                  <span>抓取网页</span>
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5" />
                  <span>记录备忘</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
