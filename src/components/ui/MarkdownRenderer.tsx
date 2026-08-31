import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../../lib/utils';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
  compact?: boolean;
}

export function MarkdownRenderer({ content, className, compact = false }: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div
      className={cn(
        'markdown-body leading-relaxed text-stone-800 dark:text-stone-200 select-text font-normal',
        compact ? 'text-xs space-y-1.5' : 'text-xs sm:text-sm space-y-3',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) =>
            compact ? (
              <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100 mt-1.5 mb-0.5" {...props} />
            ) : (
              <h1 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-50 border-b border-stone-200/80 dark:border-stone-800 pb-1.5 mt-4 mb-2 first:mt-0" {...props} />
            ),
          h2: ({ node, ...props }) =>
            compact ? (
              <h5 className="text-xs font-bold text-stone-900 dark:text-stone-100 mt-1 mb-0.5" {...props} />
            ) : (
              <h2 className="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100 mt-3.5 mb-1.5 first:mt-0" {...props} />
            ),
          h3: ({ node, ...props }) => (
            <h6 className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-1 mb-0.5" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className={cn(compact ? 'my-0.5 leading-relaxed' : 'my-1.5 leading-relaxed')} {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className={cn('list-disc list-inside pl-1 marker:text-rose-500', compact ? 'space-y-0.5 my-1' : 'space-y-1 my-2')} {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className={cn('list-decimal list-inside pl-1 marker:text-rose-500 font-medium', compact ? 'space-y-0.5 my-1' : 'space-y-1 my-2')} {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className={cn('border-l-3 border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 rounded-r-xl italic font-mono text-xs text-stone-700 dark:text-stone-300', compact ? 'px-2.5 py-1.5 my-1' : 'px-3 py-2 my-2')} {...props} />
          ),
          code: ({ node, className: codeClass, children, ...props }: any) => {
            const isInline = !codeClass && typeof children === 'string' && !children.includes('\n');
            if (isInline) {
              return (
                <code className="bg-stone-200/70 dark:bg-stone-800 text-rose-600 dark:text-rose-400 font-mono text-[10.5px] px-1.5 py-0.5 rounded-md border border-stone-300/40 dark:border-stone-700" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className={cn('bg-stone-950 text-stone-100 rounded-xl overflow-x-auto font-mono text-xs border border-stone-800 leading-normal', compact ? 'p-2.5 my-1.5 max-h-32' : 'p-3.5 my-2.5')}>
                <code className={codeClass} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-2 rounded-xl border border-stone-200 dark:border-stone-800">
              <table className="min-w-full divide-y divide-stone-200 dark:divide-stone-800 text-xs" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="bg-stone-100 dark:bg-stone-800/80 px-2.5 py-1.5 text-left font-bold text-stone-900 dark:text-stone-100" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-2.5 py-1.5 border-t border-stone-100 dark:border-stone-800 text-stone-700 dark:text-stone-300" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a className="text-rose-600 dark:text-rose-400 hover:underline font-medium break-all" target="_blank" rel="noreferrer" {...props} />
          ),
          hr: ({ node, ...props }) => (
            <hr className="my-2 border-stone-200 dark:border-stone-800" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
