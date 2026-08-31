import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useTheme, ThemePreference } from '../lib/theme';
import { formatBytes } from '../lib/utils';
import {
  Settings,
  Palette,
  HardDrive,
  ShieldCheck,
  Check,
  Globe,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';

export function SettingsPage() {
  const { preference, setPreference, isDark } = useTheme();

  const { data: stats } = useQuery({
    queryKey: ['vault-stats'],
    queryFn: api.getStats,
  });

  const themeOptions: { id: ThemePreference; title: string; desc: string; icon: React.ReactNode }[] = [
    {
      id: 'system',
      title: '自动跟随系统',
      desc: `随操作系统昼夜模式智能切换 (当前：${isDark ? '深色' : '浅色'})`,
      icon: <Laptop className="h-5 w-5" />,
    },
    {
      id: 'light',
      title: '经典浅色',
      desc: '温润明亮的编辑部工作台，适合白天与高采光环境',
      icon: <Sun className="h-5 w-5" />,
    },
    {
      id: 'dark',
      title: '深色夜间',
      desc: '沉浸专注的低眩光暗调，适合夜间与长时间素材整理',
      icon: <Moon className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-stone-200/70 dark:border-stone-800 pb-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 shadow-2xs">
            <Settings className="h-4.5 w-4.5" />
          </span>
          <h1 className="min-w-0 text-lg sm:text-xl font-bold leading-tight tracking-tight text-stone-900 dark:text-stone-100">
            设置与数据统计
          </h1>
        </div>
      </header>

      {/* Brand Hero Card */}
      <section className="p-4 sm:p-5 rounded-3xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-2xs flex items-center gap-4 sm:gap-5">
        <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-2xl overflow-hidden shadow-card border border-amber-200/60 dark:border-stone-700 bg-amber-50 dark:bg-stone-800 p-1">
          <img src="/logo.png" alt="Material Vault Mascot" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100">
              Material Vault
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400">
              v1.0 MVP
            </span>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
            专为视频创作打造的低摩擦素材收件箱、网页证据归档库与极速标签检索系统。
          </p>
        </div>
      </section>

      {/* Theme Settings Section */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <Palette className="h-4 w-4 text-rose-500" />
          <span>外观与深浅色模式</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {themeOptions.map((t) => {
            const isSelected = preference === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setPreference(t.id)}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between gap-3 transition-all ${
                  isSelected
                    ? 'border-rose-500 bg-rose-500/5 ring-2 ring-rose-500/20'
                    : 'border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={isSelected ? 'text-rose-600 dark:text-rose-400' : 'text-stone-500 dark:text-stone-400'}>
                      {t.icon}
                    </span>
                    <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                      {t.title}
                    </span>
                  </div>
                  {isSelected && (
                    <span className="h-5 w-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs shadow-2xs">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 leading-snug">
                  {t.desc}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Storage & Indexing Stats */}
      <section className="space-y-3 pt-2">
        <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-indigo-500" />
          <span>证据库存储与索引统计</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900">
            <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">总素材量</span>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-stone-900 dark:text-stone-100">
              {stats?.totalItems || 0}
            </div>
            <span className="text-[11px] text-stone-400">
              Inbox: {stats?.inboxCount || 0} · 已整理: {stats?.organizedCount || 0}
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900">
            <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">标签总数</span>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
              {stats?.totalTags || 0}
            </div>
            <span className="text-[11px] text-stone-400">
              支持 #标签 快速归类
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900">
            <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">证据归档文件</span>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-stone-900 dark:text-stone-100">
              {stats?.assetCount || 0}
            </div>
            <span className="text-[11px] text-stone-400">
              占用磁盘: {formatBytes(stats?.assetBytes || 0)}
            </span>
          </div>

          <div className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900">
            <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">收藏证据</span>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-amber-500">
              {stats?.favoriteCount || 0}
            </div>
            <span className="text-[11px] text-stone-400">星标素材</span>
          </div>
        </div>
      </section>

      {/* Top Source Domains */}
      {stats?.topDomains && stats.topDomains.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Globe className="h-4 w-4 text-emerald-500" />
            <span>素材主要来源域名分布</span>
          </h2>

          <div className="p-4 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
              {stats.topDomains.map((d) => (
                <div
                  key={d.domain}
                  className="flex items-center justify-between p-2 rounded-xl bg-stone-50 dark:bg-stone-800 text-xs"
                >
                  <span className="font-mono text-stone-700 dark:text-stone-300 truncate">
                    {d.domain}
                  </span>
                  <span className="font-mono tabular-nums font-bold text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded-md ml-1">
                    {d.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Architecture & Reliability principles from Dev Plan */}
      <section className="p-5 rounded-2xl border border-stone-200/80 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/60 text-xs space-y-2 text-stone-600 dark:text-stone-400 leading-relaxed">
        <div className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>系统设计原则 (Material Vault Protocol)</span>
        </div>
        <p>
          • <strong>Capture Friction 最小化</strong>：Ctrl+V 即存，抓取在后台进行，绝不阻塞创作者记录思路。
        </p>
        <p>
          • <strong>Archive Resilience</strong>：自动归档失败 ≠ 保存失败。素材本体与笔记永久保留，随时支持重新归档。
        </p>
        <p>
          • <strong>SHA-256 二进制去重</strong>：重复上传的图片与文档自动指向同一物理文件，节省本地磁盘空间。
        </p>
        <p>
          • <strong>SQLite FTS5 全文索引</strong>：零外部依赖，毫秒级检索半年前收集的所有网页与正文证据。
        </p>
      </section>
    </div>
  );
}
