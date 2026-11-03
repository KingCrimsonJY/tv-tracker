import React, { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AlertCircle, KeyRound, Lock, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { Button, Card } from '@heroui/react';
import { AppShell } from './components/AppShell.tsx';
import { TrackerProvider, useTracker } from './context/TrackerContext.tsx';
import { ApiError } from './data/api.ts';
import { zh } from './i18n/zh.ts';
import { HomePage } from './pages/HomePage.tsx';
import { LibraryPage } from './pages/LibraryPage.tsx';
import { ListDetailPage } from './pages/ListDetailPage.tsx';
import { ListsPage } from './pages/ListsPage.tsx';
import { SearchPage } from './pages/SearchPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { TitleDetailPage } from './pages/TitleDetailPage.tsx';

const AuthScreen: React.FC = () => {
  const { needsSetup, setupPassword, loginWithPassword } = useTracker();
  const [setupCode, setSetupCode] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (needsSetup) {
      if (!setupCode.trim()) {
        setErrorMsg(zh.app.setupCodeRequiredError);
        return;
      }
      if (password.length < 10) {
        setErrorMsg(zh.app.passwordTooShortError);
        return;
      }
    } else if (!password.trim()) {
      setErrorMsg(zh.app.passwordRequiredError);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      if (needsSetup) {
        await setupPassword(password, setupCode.trim());
      } else {
        await loginWithPassword(password);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setErrorMsg(zh.app.tooManyAttemptsError);
        } else if (err.status === 401 && !needsSetup) {
          setErrorMsg(zh.app.wrongPasswordError);
        } else {
          setErrorMsg(err.message);
        }
      } else {
        setErrorMsg(err instanceof Error ? err.message : zh.app.errorGeneric);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-6">
      <Card className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-8">
        <Card.Content className="flex flex-col items-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-[var(--accent)] flex items-center justify-center text-[var(--accent-foreground)] font-bold text-2xl shadow-lg">
            {zh.app.logoChar}
          </div>

          <div className="space-y-1.5 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
              {needsSetup ? zh.app.setupPasswordTitle : zh.app.loginTitle}
            </h1>
            <p className="text-sm text-[var(--muted)]">
              {needsSetup ? zh.app.setupPasswordSubtitle : zh.app.loginSubtitle}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            {needsSetup && (
              <div>
                <label
                  htmlFor="auth-setup-code-input"
                  className="block text-xs font-medium text-[var(--muted)] mb-1.5"
                >
                  {zh.app.setupCodeLabel}
                </label>
                <div className="relative">
                  <input
                    id="auth-setup-code-input"
                    type="text"
                    value={setupCode}
                    onChange={(e) => {
                      setSetupCode(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder={zh.app.setupCodePlaceholder}
                    autoFocus
                    autoComplete="off"
                    className="w-full min-h-[48px] pl-11 pr-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                  />
                  <ShieldCheck className="w-4 h-4 text-[var(--muted)] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-password-input"
                className={
                  needsSetup
                    ? 'block text-xs font-medium text-[var(--muted)] mb-1.5'
                    : 'sr-only'
                }
              >
                {needsSetup ? zh.app.setupPasswordTitle : zh.app.passwordLabel}
              </label>
              <div className="relative">
                <input
                  id="auth-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder={
                    needsSetup ? zh.app.passwordPlaceholder : zh.app.loginPasswordPlaceholder
                  }
                  autoFocus={!needsSetup}
                  autoComplete={needsSetup ? 'new-password' : 'current-password'}
                  className="w-full min-h-[48px] pl-11 pr-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                />
                {needsSetup ? (
                  <KeyRound className="w-4 h-4 text-[var(--muted)] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                ) : (
                  <Lock className="w-4 h-4 text-[var(--muted)] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-[var(--danger)]"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isDisabled={submitting}
              className="min-h-[48px] rounded-xl font-semibold gap-2"
            >
              <span>{needsSetup ? zh.app.setupPasswordSubmit : zh.app.loginSubmit}</span>
            </Button>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
};

const OfflineScreen: React.FC = () => {
  const { retryConnection } = useTracker();
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await retryConnection();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      className="min-h-dvh bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-6"
    >
      <Card className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-8 text-center">
        <Card.Content className="flex flex-col items-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 text-[var(--danger)] flex items-center justify-center">
            <WifiOff className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
              {zh.app.offlineTitle}
            </h1>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              {zh.app.offlineDescription}
            </p>
          </div>
          <div className="w-full pt-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              isDisabled={retrying}
              onPress={handleRetry}
              className="min-h-[48px] rounded-xl font-semibold gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
              <span>{zh.app.offlineRetry}</span>
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};

const AppRoutes: React.FC = () => {
  const { authReady, authenticated, serverUnreachable } = useTracker();

  if (serverUnreachable) {
    return <OfflineScreen />;
  }

  if (!authReady) {
    return (
      <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl bg-[var(--surface)] border border-[var(--border)] p-8 space-y-5 animate-pulse">
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface-secondary)] mx-auto" />
          <div className="h-6 w-32 rounded-lg bg-[var(--surface-secondary)] mx-auto" />
          <div className="h-4 w-56 rounded-lg bg-[var(--surface-secondary)] mx-auto" />
          <div className="h-12 w-full rounded-xl bg-[var(--surface-secondary)]" />
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <AuthScreen />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/lists" element={<ListsPage />} />
        <Route path="/lists/:listId" element={<ListDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/title/:titleId" element={<TitleDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <TrackerProvider>
        <AppRoutes />
      </TrackerProvider>
    </BrowserRouter>
  );
}
