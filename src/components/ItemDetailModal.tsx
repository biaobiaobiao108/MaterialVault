import React, { useState, useEffect } from 'react';
import {
  Globe,
  FileText,
  ExternalLink,
  Star,
  CheckCircle2,
  Archive,
  Trash2,
  RefreshCw,
  Tag as TagIcon,
  FileCode,
  Download,
  AlertTriangle,
  Plus,
  X,
  Copy,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { CustomSelect } from './ui/CustomSelect';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useToast } from './ui/Toast';
import { formatDate, formatBytes } from '../lib/utils';

export interface ItemDetailModalProps {
  itemId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ItemDetailModal({ itemId, isOpen, onClose }: ItemDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'markdown' | 'assets' | 'logs'>('content');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: itemData, isLoading, refetch } = useQuery({
    queryKey: ['item', itemId],
    queryFn: () => (itemId ? api.getItem(itemId) : Promise.resolve(null)),
    enabled: Boolean(itemId && isOpen),
    refetchInterval: (query) => {
      const pStatus = query.state.data?.item.processingStatus;
      return pStatus === 'pending' || pStatus === 'processing' ? 2000 : false;
    },
  });

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: api.getTags,
    enabled: isOpen,
  });

  const item = itemData?.item;

  useEffect(() => {
    if (item) {
      setTitleValue(item.title);
      setNoteValue(item.description || item.contentText || '');
    }
  }, [item]);

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: (updates: any) => api.updateItem(itemId!, updates),
    onSuccess: () => {
      toast.success('素材已更新');
      queryClient.invalidateQueries({ queryKey: ['item', itemId] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['vault-stats'] });
      setEditingTitle(false);
      setEditingNote(false);
    },
    onError: (err: any) => toast.error(err.message || '更新失败'),
  });

  // Retry Mutation
  const retryMutation = useMutation({
    mutationFn: () => api.retryIngestion(itemId!),
    onSuccess: () => {
      toast.info('重新抓取任务已启动', '正在归档');
      refetch();
    },
    onError: (err: any) => toast.error(err.message || '启动重新抓取失败'),
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: () => api.deleteItem(itemId!),
    onSuccess: () => {
      toast.success('素材已删除');
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['vault-stats'] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || '删除失败'),
  });

  // Link Tag Mutation
  const linkTagMutation = useMutation({
    mutationFn: (tag: { tagId?: string; tagName?: string }) => api.linkTag(itemId!, tag),
    onSuccess: () => {
      setNewTagName('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });

  // Unlink Tag Mutation
  const unlinkTagMutation = useMutation({
    mutationFn: (tagId: string) => api.unlinkTag(itemId!, tagId),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  if (!isOpen) return null;

  const markdownAsset = item?.assets?.find((a) => a.kind === 'markdown');
  const imageAsset = item?.assets?.find((a) => a.kind === 'original' && a.mimeType.startsWith('image/')) || item?.assets?.find((a) => a.kind === 'screenshot');

  const unlinkedTags = tagsData?.tags.filter((t) => !item?.tags?.some((it) => it.id === t.id)) || [];

  const handleCopyAiCitation = () => {
    if (!item) return;
    const tagStr = item.tags && item.tags.length > 0 ? item.tags.map((t) => `#${t.name}`).join(' ') : '无';
    const citation = `> [!NOTE] 素材证据引用
> **标题**：${item.title}
${item.sourceUrl ? `> **来源链接**：${item.sourceUrl}${item.sourceDomain ? ` (${item.sourceDomain})` : ''}\n` : ''}> **关联标签**：${tagStr}
${item.description ? `>\n> **创作备注**：\n> ${item.description.replace(/\n/g, '\n> ')}\n` : ''}${
      item.contentText ? `>\n> **核心正文提取**：\n> ${item.contentText.slice(0, 1000).replace(/\n/g, '\n> ')}` : ''
    }`;

    navigator.clipboard.writeText(citation);
    toast.success('已复制标准 Markdown 证据包，可直接粘贴到写稿工具或大模型 Prompt 中', '引用包已复制');
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} maxWidth="4xl" showClose={true}>
        {isLoading || !item ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-stone-400">
            <RefreshCw className="h-6 w-6 animate-spin text-rose-500" />
            <span className="text-xs">加载素材详情...</span>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header Area */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="stone" size="md">
                    <span className="uppercase font-bold tracking-wider">{item.type}</span>
                  </Badge>

                  {item.sourceDomain && (
                    <span className="text-xs font-mono text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-lg border border-stone-200/60 dark:border-stone-700">
                      {item.sourceDomain}
                    </span>
                  )}

                  {item.processingStatus === 'pending' || item.processingStatus === 'processing' ? (
                    <Badge variant="amber">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>正在归档证据...</span>
                    </Badge>
                  ) : item.processingStatus === 'failed' ? (
                    <Badge variant="rose">
                      <AlertTriangle className="h-3 w-3" />
                      <span>自动归档失败</span>
                    </Badge>
                  ) : (
                    <Badge variant="emerald">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>已建立证据归档</span>
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* One-click AI Citation Copy */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyAiCitation}
                    className="gap-1 text-xs"
                    title="复制为标准 Markdown 证据引用格式"
                  >
                    <Copy className="h-3.5 w-3.5 text-rose-500" />
                    <span>复制 AI 证据包</span>
                  </Button>

                  <button
                    type="button"
                    onClick={() => updateMutation.mutate({ favorite: !item.favorite })}
                    className={`p-2 rounded-xl border transition-colors ${
                      item.favorite
                        ? 'border-amber-400 bg-amber-500/10 text-amber-500'
                        : 'border-stone-200 dark:border-stone-800 text-stone-400 hover:text-amber-500'
                    }`}
                    title={item.favorite ? '已收藏' : '收藏'}
                  >
                    <Star className={`h-4 w-4 ${item.favorite ? 'fill-amber-500' : ''}`} />
                  </button>

                  <Button
                    variant={item.organizationStatus === 'organized' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() =>
                      updateMutation.mutate({
                        organizationStatus: item.organizationStatus === 'organized' ? 'inbox' : 'organized',
                      })
                    }
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{item.organizationStatus === 'organized' ? '已整理' : '标记已整理'}</span>
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      updateMutation.mutate({
                        organizationStatus: item.organizationStatus === 'archived' ? 'inbox' : 'archived',
                      })
                    }
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span>{item.organizationStatus === 'archived' ? '已归档' : '归档'}</span>
                  </Button>
                </div>
              </div>

              {/* Title Section */}
              {editingTitle ? (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    className="flex-1 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-1.5 text-base font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <Button size="sm" variant="primary" onClick={() => updateMutation.mutate({ title: titleValue })}>
                    保存
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>
                    取消
                  </Button>
                </div>
              ) : (
                <h2
                  onClick={() => setEditingTitle(true)}
                  className="text-lg sm:text-xl font-bold leading-snug text-stone-900 dark:text-stone-100 hover:text-rose-600 transition-colors cursor-pointer"
                  title="点击编辑标题"
                >
                  {item.title}
                </h2>
              )}

              {/* Source Link info */}
              {item.sourceUrl && (
                <div className="flex items-center gap-2 text-xs pt-1">
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:underline font-mono"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="truncate max-w-md">{item.sourceUrl}</span>
                  </a>
                  {item.processingStatus === 'failed' && (
                    <button
                      type="button"
                      onClick={() => retryMutation.mutate()}
                      className="text-xs text-stone-500 hover:text-rose-600 underline font-medium ml-2"
                    >
                      [重新抓取]
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Tags Association Box */}
            <div className="p-3.5 rounded-xl border border-stone-100 dark:border-stone-800/80 bg-stone-50/70 dark:bg-stone-800/40 space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-semibold text-stone-500 dark:text-stone-400 flex items-center gap-1 min-w-14">
                  <TagIcon className="h-3.5 w-3.5 text-rose-500" />
                  <span>标签：</span>
                </span>
                {item.tags?.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 bg-stone-200/80 dark:bg-stone-700 px-2 py-0.5 rounded-lg font-medium text-stone-800 dark:text-stone-100"
                  >
                    <span>#{tag.name}</span>
                    <button
                      type="button"
                      onClick={() => unlinkTagMutation.mutate(tag.id)}
                      className="text-stone-400 hover:text-rose-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                {/* Quick Add Existing Tag */}
                {unlinkedTags.length > 0 && (
                  <div className="w-36">
                    <CustomSelect
                      size="sm"
                      value=""
                      onChange={(val) => {
                        if (val) linkTagMutation.mutate({ tagId: val });
                      }}
                      placeholder="+ 选择已有标签"
                      options={[
                        { value: '', label: '+ 选择已有标签' },
                        ...unlinkedTags.map((t) => ({
                          value: t.id,
                          label: `#${t.name}`,
                        })),
                      ]}
                    />
                  </div>
                )}

                {/* Add New Tag input */}
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="输入 #新标签..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTagName.trim()) {
                        e.preventDefault();
                        linkTagMutation.mutate({ tagName: newTagName.trim() });
                      }
                    }}
                    className="w-28 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1 text-xs text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  {newTagName.trim() && (
                    <button
                      type="button"
                      onClick={() => linkTagMutation.mutate({ tagName: newTagName.trim() })}
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Note & Thoughts Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-rose-500" />
                  <span>创作备注 / 思考记录</span>
                </label>
                {!editingNote && (
                  <button
                    type="button"
                    onClick={() => setEditingNote(true)}
                    className="text-xs text-rose-600 hover:underline font-medium"
                  >
                    编辑备注
                  </button>
                )}
              </div>

              {editingNote ? (
                <div className="space-y-2">
                  <textarea
                    rows={4}
                    value={noteValue}
                    onChange={(e) => setNoteValue(e.target.value)}
                    placeholder="记录为什么保存这条素材，输入 #标签 自动归档..."
                    className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 p-3 text-xs sm:text-sm leading-relaxed text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingNote(false)}>
                      取消
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => updateMutation.mutate({ description: noteValue })}
                    >
                      保存备注
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setEditingNote(true)}
                  className="p-3 rounded-xl border border-stone-200/70 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/60 text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed cursor-pointer hover:bg-stone-100/60 dark:hover:bg-stone-800/60 transition-colors whitespace-pre-wrap min-h-12"
                >
                  {item.description || <span className="text-stone-400 italic">点击添加备注，输入 #标签 自动归档...</span>}
                </div>
              )}
            </div>

            {/* Evidence Archive Tabs */}
            <div className="border-t border-stone-200/70 dark:border-stone-800 pt-4 space-y-3">
              <div className="flex items-center gap-1.5 border-b border-stone-200/60 dark:border-stone-800 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('content')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === 'content'
                      ? 'bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                      : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  素材证据总览
                </button>
                {markdownAsset && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('markdown')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      activeTab === 'markdown'
                        ? 'bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                        : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    Markdown 正文
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('assets')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === 'assets'
                      ? 'bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                      : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  证据文件 ({item.assets?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('logs')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === 'logs'
                      ? 'bg-stone-200 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                      : 'text-stone-500 hover:text-stone-900 dark:hover:text-stone-200'
                  }`}
                >
                  归档流水日志
                </button>
              </div>

              {/* Tab 1: Content & Image preview */}
              {activeTab === 'content' && (
                <div className="space-y-3">
                  {imageAsset && (
                    <div className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden bg-stone-950 p-2 flex justify-center">
                      <img
                        src={`/api/assets/${imageAsset.id}`}
                        alt={item.title}
                        className="max-h-80 object-contain rounded-lg"
                      />
                    </div>
                  )}

                  {item.contentText ? (
                    <div className="p-4 rounded-xl border border-stone-200/70 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-950 max-h-80 overflow-y-auto font-mono text-xs leading-relaxed text-stone-800 dark:text-stone-200 whitespace-pre-wrap select-text">
                      {item.contentText}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-stone-400">
                      {item.processingStatus === 'failed'
                        ? '网页抓取失败，暂无可索引正文'
                        : '暂无提取文本'}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Markdown Asset */}
              {activeTab === 'markdown' && markdownAsset && (
                <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 p-4">
                  <div className="flex justify-between items-center pb-2 mb-2 border-b border-stone-200 dark:border-stone-800 text-xs">
                    <span className="font-mono text-stone-400">{markdownAsset.fileName}</span>
                    <a
                      href={`/api/assets/${markdownAsset.id}`}
                      download={markdownAsset.fileName}
                      className="inline-flex items-center gap-1 text-rose-600 hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>下载 Markdown</span>
                    </a>
                  </div>
                  <pre className="text-xs leading-relaxed font-mono text-stone-800 dark:text-stone-200 whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {item.contentText}
                  </pre>
                </div>
              )}

              {/* Tab 4: Assets List */}
              {activeTab === 'assets' && (
                <div className="space-y-2">
                  {item.assets?.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <FileCode className="h-4 w-4 text-rose-500" />
                        <div>
                          <div className="font-semibold text-stone-800 dark:text-stone-200">{asset.fileName}</div>
                          <div className="text-[11px] text-stone-400 font-mono">
                            {asset.kind} · {asset.mimeType} · {formatBytes(asset.fileSize)}
                          </div>
                        </div>
                      </div>
                      <a
                        href={`/api/assets/${asset.id}`}
                        download={asset.fileName}
                        className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                        title="下载"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 5: Ingestion Logs */}
              {activeTab === 'logs' && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {item.logs?.length === 0 ? (
                    <div className="text-xs text-stone-400 p-4 text-center">暂无处理日志</div>
                  ) : (
                    item.logs?.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-2 p-2 rounded-lg bg-stone-100/60 dark:bg-stone-800/50 text-xs font-mono"
                      >
                        <span className="text-stone-400">{formatDate(log.createdAt)}</span>
                        <Badge
                          variant={log.status === 'success' ? 'emerald' : log.status === 'failed' ? 'rose' : 'amber'}
                          size="sm"
                        >
                          {log.step}
                        </Badge>
                        <span className="text-stone-700 dark:text-stone-300 flex-1">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between border-t border-stone-200/70 dark:border-stone-800 pt-4">
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>删除素材</span>
              </Button>

              <Button variant="secondary" size="sm" onClick={onClose}>
                关闭
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          setDeleteConfirmOpen(false);
          deleteMutation.mutate();
        }}
        title="确认删除该素材？"
        message="删除后素材及其归档证据文件将从证据库中彻底移除。"
        confirmText="确认删除"
        variant="danger"
      />
    </>
  );
}
