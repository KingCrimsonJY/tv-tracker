import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RefreshCw, WifiOff } from 'lucide-react';
import { Alert, Button, Card, Input, I18nProvider, Label, Skeleton, Spinner, TextField, Toast } from '@heroui/react';
import { NavigationScroll } from './components/NavigationScroll';
import { withPendingSpinner } from './components/pendingContent';
import { AppShell } from './components/AppShell.tsx';
import { TrackerProvider, useTracker } from './context/TrackerContext.tsx';
import { useI18n } from './i18n/index.ts';
import { HomePage } from './pages/HomePage.tsx';
const LibraryPage = lazy(() => import('./pages/LibraryPage.tsx').then((module) => ({ default: module.LibraryPage })));
const ListDetailPage = lazy(() =>
  import('./pages/ListDetailPage.tsx').then((module) => ({ default: module.ListDetailPage })),
);
const ListsPage = lazy(() => import('./pages/ListsPage.tsx').then((module) => ({ default: module.ListsPage })));
const SearchPage = lazy(() => import('./pages/SearchPage.tsx').then((module) => ({ default: module.SearchPage })));
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage.tsx').then((module) => ({ default: module.SettingsPage })),
);
const TitleDetailPage = lazy(() =>
  import('./pages/TitleDetailPage.tsx').then((module) => ({ default: module.TitleDetailPage })),
);

const AuthScreen: React.FC = () => {
  const { needsSetup, setupPassword, loginWithPassword } = useTracker();
  const { t, translateError } = useI18n();
  const [setupCode, setSetupCode] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (needsSetup) {
      if (!setupCode.trim()) {
        setErrorMsg(t.app.setupCodeRequiredError);
        return;
      }
      if (password.length < 10) {
        setErrorMsg(t.app.passwordTooShortError);
        return;
      }
    } else if (!password.trim()) {
      setErrorMsg(t.app.passwordRequiredError);
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
      setErrorMsg(translateError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background text-foreground flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <Card.Content className="flex flex-col items-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground font-bold text-2xl shadow-lg">
            {t.app.logoChar}
          </div>

          <div className="space-y-1.5 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {needsSetup ? t.app.setupPasswordTitle : t.app.loginTitle}
            </h1>
            <p className="text-sm text-muted">{needsSetup ? t.app.setupPasswordSubtitle : t.app.loginSubtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            {needsSetup && (
              <TextField
                value={setupCode}
                onChange={(val) => {
                  setSetupCode(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                fullWidth
                variant="secondary"
              >
                <Label>{t.app.setupCodeLabel}</Label>
                <Input placeholder={t.app.setupCodePlaceholder} autoComplete="off" />
              </TextField>
            )}

            <TextField
              type="password"
              value={password}
              onChange={(val) => {
                setPassword(val);
                if (errorMsg) setErrorMsg(null);
              }}
              aria-label={!needsSetup ? t.app.passwordLabel : undefined}
              fullWidth
              variant="secondary"
            >
              {needsSetup && <Label>{t.app.setupPasswordTitle}</Label>}
              <Input
                placeholder={needsSetup ? t.app.passwordPlaceholder : t.app.loginPasswordPlaceholder}
                autoComplete={needsSetup ? 'new-password' : 'current-password'}
              />
            </TextField>

            {errorMsg && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{errorMsg}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            <Button type="submit" variant="primary" size="lg" fullWidth isPending={submitting}>
              {withPendingSpinner(<span>{needsSetup ? t.app.setupPasswordSubmit : t.app.loginSubmit}</span>)}
            </Button>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
};

const OfflineScreen: React.FC = () => {
  const { retryConnection } = useTracker();
  const { t } = useI18n();
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
    <div role="alert" className="min-h-dvh bg-background text-foreground flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <Card.Content className="flex flex-col items-center text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-danger-soft text-danger flex items-center justify-center">
            <WifiOff className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{t.app.offlineTitle}</h1>
            <p className="text-sm text-muted leading-relaxed">{t.app.offlineDescription}</p>
          </div>
          <div className="w-full pt-2">
            <Button variant="primary" size="lg" fullWidth isPending={retrying} onPress={handleRetry}>
              {withPendingSpinner(<span>{t.app.offlineRetry}</span>, <RefreshCw className="w-4 h-4" />)}
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};

const AppRoutes: React.FC = () => {
  const { t } = useI18n();
  const { authReady, authenticated, serverUnreachable } = useTracker();

  if (serverUnreachable) {
    return <OfflineScreen />;
  }

  if (!authReady) {
    return (
      <div className="min-h-dvh bg-background text-foreground flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <Card.Content className="space-y-5">
            <Skeleton className="w-14 h-14 rounded-2xl mx-auto" />
            <Skeleton className="h-6 w-32 rounded-lg mx-auto" />
            <Skeleton className="h-4 w-56 rounded-lg mx-auto" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </Card.Content>
        </Card>
      </div>
    );
  }

  if (!authenticated) {
    return <AuthScreen />;
  }

  return (
    <AppShell>
      <Suspense fallback={<Spinner aria-label={t.app.loading} />}>
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
      </Suspense>
    </AppShell>
  );
};

export default function App() {
  const { locale } = useI18n();
  return (
    <I18nProvider locale={locale}>
      <BrowserRouter>
        <TrackerProvider>
          <Toast.Provider placement="bottom" />
          <NavigationScroll>
            <AppRoutes />
          </NavigationScroll>
        </TrackerProvider>
      </BrowserRouter>
    </I18nProvider>
  );
}
