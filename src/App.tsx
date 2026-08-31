import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './components/ui/Toast';
import { Layout } from './components/Layout';
import { InboxPage } from './pages/InboxPage';
import { ItemsPage } from './pages/ItemsPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import { api } from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const qc = useQueryClient();
  const { data: authStatus, isLoading } = useQuery({
    queryKey: ['auth-status'],
    queryFn: api.getAuthStatus,
  });

  useEffect(() => {
    const handleAuthRequired = () => {
      qc.invalidateQueries({ queryKey: ['auth-status'] });
    };
    window.addEventListener('mv-auth-required', handleAuthRequired);
    return () => window.removeEventListener('mv-auth-required', handleAuthRequired);
  }, [qc]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-100 dark:bg-stone-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
          <p className="text-xs text-stone-400">正在验证安全状态...</p>
        </div>
      </div>
    );
  }

  if (authStatus?.requireAuth && !authStatus?.authenticated) {
    return (
      <LoginPage
        authStatus={authStatus}
        onLoginSuccess={() => qc.invalidateQueries({ queryKey: ['auth-status'] })}
      />
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<InboxPage />} />
          <Route path="items" element={<ItemsPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
