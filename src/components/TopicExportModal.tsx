import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import { Copy, Check, Sparkles, LayoutGrid, FileText, Download } from 'lucide-react';

export interface TopicExportModalProps {
  topicId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TopicExportModal({ topicId, isOpen, onClose }: TopicExportModalProps) {
  const [exportType, setExportType] = useState<'markdown' | 'excalidraw'>('markdown');
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const { data: markdownContent, isLoading: loadingMd } = useQuery({
    queryKey: ['topic-export-md', topicId],
    queryFn: () => (topicId ? api.getTopicExport(topicId, 'markdown') : Promise.resolve('')),
    enabled: Boolean(topicId && isOpen && exportType === 'markdown'),
  });

  const { data: excalidrawContent, isLoading: loadingEx } = useQuery({
    queryKey: ['topic-export-ex', topicId],
    queryFn: () => (topicId ? api.getTopicExport(topicId, 'excalidraw') : Promise.resolve(null)),
    enabled: Boolean(topicId && isOpen && exportType === 'excalidraw'),
  });

  if (!isOpen) return null;

  const handleCopy = () => {
    const textToCopy =
      exportType === 'markdown'
        ? (markdownContent as string)
        : JSON.stringify(excalidrawContent, null, 2);

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('已复制到剪贴板', '导出成功');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const textToSave =
      exportType === 'markdown'
        ? (markdownContent as string)
        : JSON.stringify(excalidrawContent, null, 2);

    const ext = exportType === 'markdown' ? 'md' : 'json';
    const blob = new Blob([textToSave], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `topic_export_${topicId}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isDataLoading = exportType === 'markdown' ? loadingMd : loadingEx;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="导出选题资料与上下文"
      description="无缝投喂给 ChatGPT/Claude 进行脚本创作，或导入 Excalidraw 进行白板推演"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {/* Format Selector */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setExportType('markdown')}
            className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
              exportType === 'markdown'
                ? 'border-rose-500 bg-rose-500/5 ring-1 ring-rose-500'
                : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900'
            }`}
          >
            <Sparkles className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-stone-900 dark:text-stone-100">AI Context (Markdown)</div>
              <div className="text-[11px] text-stone-500 dark:text-stone-400">
                结构化证据与笔记，直接复制投喂给大模型
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setExportType('excalidraw')}
            className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
              exportType === 'excalidraw'
                ? 'border-rose-500 bg-rose-500/5 ring-1 ring-rose-500'
                : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900'
            }`}
          >
            <LayoutGrid className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-stone-900 dark:text-stone-100">Excalidraw 白板数据</div>
              <div className="text-[11px] text-stone-500 dark:text-stone-400">
                符合 Excalidraw Import API 规范的中间结构
              </div>
            </div>
          </button>
        </div>

        {/* Preview Content Area */}
        <div className="relative rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-900 text-stone-200 p-3.5 max-h-80 overflow-y-auto font-mono text-xs leading-relaxed">
          {isDataLoading ? (
            <div className="py-8 text-center text-stone-500">生成导出数据中...</div>
          ) : (
            <pre className="whitespace-pre-wrap select-text">
              {exportType === 'markdown'
                ? (markdownContent as string)
                : JSON.stringify(excalidrawContent, null, 2)}
            </pre>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="secondary" size="sm" onClick={handleDownload} disabled={isDataLoading}>
            <Download className="h-4 w-4" />
            <span>下载文件</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              关闭
            </Button>
            <Button variant="primary" size="sm" onClick={handleCopy} disabled={isDataLoading}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? '已复制' : '一键复制'}</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
