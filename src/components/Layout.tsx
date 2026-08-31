import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Inbox,
  Layers,
  Search,
  Settings,
  Sun,
  Moon,
  Laptop,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useTheme } from '../lib/theme';
import { cn } from '../lib/utils';

export function Layout() {
  const location = useLocation();
  const { preference, setPreference, isDark } = useTheme();

  // Fetch stats for live Inbox count badge
  const { data: stats } = useQuery({
    queryKey: ['vault-stats'],
    queryFn: api.getStats,
    refetchInterval: 5000,
  });

  const navItems = [
    {
      to: '/',
      label: 'Inbox 收件箱',
      icon: Inbox,
      badge: stats?.inboxCount,
      badgeVariant: 'rose',
    },
    {
      to: '/items',
      label: '全部素材',
      icon: Layers,
      badge: stats?.totalItems,
      badgeVariant: 'stone',
    },
    {
      to: '/search',
      label: '全文检索',
      icon: Search,
    },
    {
      to: '/settings',
      label: '设置与统计',
      icon: Settings,
    },
  ];

  const cycleTheme = () => {
    if (preference === 'system') setPreference('dark');
    else if (preference === 'dark') setPreference('light');
    else setPreference('system');
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-main)] flex flex-col md:flex-row antialiased">
      {/* Desktop Sidebar (w-64) */}
      <aside className="hidden md:flex md:w-64 md:flex-col shrink-0 border-r border-stone-200/80 dark:border-stone-800 bg-[var(--bg-surface)] z-30 sticky top-0 h-screen">
        {/* Brand Header */}
        <div className="p-4 flex items-center justify-between border-b border-stone-100 dark:border-stone-800/80">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Material Vault Logo"
              className="h-9 w-9 rounded-xl object-contain bg-amber-500/10 dark:bg-stone-800 p-0.5 shadow-2xs ring-1 ring-stone-200/60 dark:ring-stone-750"
            />
            <div className="min-w-0">
              <div className="font-bold text-sm tracking-tight text-stone-900 dark:text-stone-100 truncate">
                Material Vault
              </div>
              <div className="text-[11px] text-stone-400 font-medium truncate">
                素材证据库
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 font-bold shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/60 hover:text-stone-900 dark:hover:text-stone-200'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {typeof item.badge === 'number' && (
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums font-semibold',
                      isActive
                        ? 'bg-rose-600 text-white'
                        : item.badgeVariant === 'rose' && item.badge > 0
                        ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300'
                        : 'bg-stone-200/60 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer: Clean Theme Preference Switcher */}
        <div className="p-3 border-t border-stone-100 dark:border-stone-800/80">
          <div className="flex items-center justify-between bg-stone-100/70 dark:bg-stone-800/60 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setPreference('light')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                preference === 'light'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
              )}
              title="浅色模式"
            >
              <Sun className="h-3.5 w-3.5" />
              <span>浅色</span>
            </button>

            <button
              type="button"
              onClick={() => setPreference('dark')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                preference === 'dark'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
              )}
              title="深色模式"
            >
              <Moon className="h-3.5 w-3.5" />
              <span>深色</span>
            </button>

            <button
              type="button"
              onClick={() => setPreference('system')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                preference === 'system'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs font-bold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
              )}
              title="自动跟随系统"
            >
              <Laptop className="h-3.5 w-3.5" />
              <span>自动</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between p-3.5 border-b border-stone-200/80 dark:border-stone-800 bg-[var(--bg-surface)] sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo.png"
            alt="Material Vault Logo"
            className="h-8 w-8 rounded-lg object-contain bg-amber-500/10 dark:bg-stone-800 p-0.5 shadow-2xs"
          />
          <div className="font-bold text-sm text-stone-900 dark:text-stone-100">
            Material Vault
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={cycleTheme}
            className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center gap-1.5 text-xs font-medium"
            title={`当前模式: ${preference === 'system' ? '自动' : preference === 'dark' ? '深色' : '浅色'}`}
          >
            {isDark ? <Moon className="h-4.5 w-4.5 text-rose-400" /> : <Sun className="h-4.5 w-4.5 text-amber-500" />}
          </button>
          <NavLink
            to="/search"
            className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
            aria-label="搜索"
          >
            <Search className="h-4.5 w-4.5" />
          </NavLink>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto min-h-dvh flex flex-col pb-20 md:pb-8">
        <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-8 sm:py-8 flex-1">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-surface)]/95 backdrop-blur-md border-t border-stone-200/80 dark:border-stone-800 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-col items-center justify-center min-h-12 min-w-12 px-2 py-1 rounded-xl text-[10px] font-medium transition-colors relative',
                isActive
                  ? 'text-rose-600 dark:text-rose-400 font-bold'
                  : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="mt-1">{item.label.split(' ')[0]}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span
                  className={cn(
                    'absolute top-1 right-2 px-1.5 py-0.2 rounded-full text-[9px] font-mono tabular-nums font-bold leading-tight',
                    item.badgeVariant === 'rose'
                      ? 'bg-rose-600 text-white'
                      : 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
