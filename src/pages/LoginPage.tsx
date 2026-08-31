import React, { useState } from 'react';
import { Lock, KeyRound, ShieldCheck, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { api, setAuthToken, AuthStatus } from '../lib/api';

interface LoginPageProps {
  authStatus?: AuthStatus;
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ authStatus, onLoginSuccess }) => {
  const isSetup = authStatus?.isSetup ?? true;
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('请输入密码');
      return;
    }

    if (!isSetup) {
      if (password.length < 4) {
        setError('密码长度不能少于 4 位');
        return;
      }
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
    }

    try {
      setLoading(true);
      if (!isSetup) {
        const res = await api.setupAuth(password.trim());
        setAuthToken(res.token);
      } else {
        const res = await api.login(password.trim());
        setAuthToken(res.token);
      }
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 flex flex-col items-center justify-center p-4 selection:bg-rose-500/20">
      <div className="w-full max-w-md">
        {/* Card Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white dark:bg-stone-900 shadow-lg shadow-stone-200/50 dark:shadow-none border border-stone-200 dark:border-stone-800 mb-4">
            <img src="/logo.png" alt="Material Vault Logo" className="w-12 h-12 rounded-xl object-cover" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Material Vault
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            素材证据库 · 私有归档与极速检索
          </p>
        </div>

        {/* Form Box */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-xl shadow-stone-200/60 dark:shadow-none border border-stone-200 dark:border-stone-800 p-8">
          <div className="flex items-center gap-2.5 pb-5 mb-6 border-b border-stone-100 dark:border-stone-800/80">
            {isSetup ? (
              <>
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">安全验证</h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">证据库已启用访问保护，请输入密码</p>
                </div>
              </>
            ) : (
              <>
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">欢迎首次使用</h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400">请初始化设置您的私有证据库访问密码</p>
                </div>
              </>
            )}
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs leading-relaxed animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                {isSetup ? '访问密码' : '设置主密码'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSetup ? '请输入访问密码...' : '请设置 4 位以上安全密码...'}
                  autoFocus
                  className="w-full pl-9 pr-10 py-2.5 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/80 rounded-xl text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isSetup && (
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1.5">
                  确认密码
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入相同密码以确认..."
                    className="w-full pl-9 pr-4 py-2.5 bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700/80 rounded-xl text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:opacity-50 text-white font-medium text-sm rounded-xl shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {loading ? (
                <span>验证中...</span>
              ) : (
                <>
                  <span>{isSetup ? '进入证据库' : '完成初始化并进入'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-stone-400 dark:text-stone-500">
          Material Vault · 纯本地私有证据归档
        </div>
      </div>
    </div>
  );
};
