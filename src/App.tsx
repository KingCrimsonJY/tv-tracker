import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Film, LogIn } from 'lucide-react';
import { Button, Card } from '@heroui/react';
import { AppShell } from './components/AppShell';
import { TrackerProvider, useTracker } from './context/TrackerContext';
import { zh } from './i18n/zh';
import { HomePage } from './pages/HomePage';
import { LibraryPage } from './pages/LibraryPage';
import { ListDetailPage } from './pages/ListDetailPage';
import { ListsPage } from './pages/ListsPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { TitleDetailPage } from './pages/TitleDetailPage';

const AppRoutes: React.FC = () => {
  const { user, authReady, signIn } = useTracker();

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

  if (!user) {
    return (
      <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)] flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-8 text-center">
          <Card.Content className="flex flex-col items-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent)] flex items-center justify-center text-[var(--accent-foreground)] font-bold text-2xl shadow-lg">
              帧
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                {zh.app.name}
              </h1>
              <p className="text-sm text-[var(--muted)]">{zh.app.tagline}</p>
            </div>

            <div className="w-full pt-2">
              <Button
                variant="primary"
                size="lg"
                fullWidth
                onPress={() => signIn().catch(() => {})}
                className="min-h-[48px] rounded-xl font-semibold gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{zh.app.signInWithGoogle}</span>
              </Button>
            </div>

            <p className="text-xs text-[var(--muted)] flex items-center gap-1.5 pt-2">
              <Film className="w-3.5 h-3.5" />
              <span>支持手机、平板与桌面端离线缓存与实时云同步</span>
            </p>
          </Card.Content>
        </Card>
      </div>
    );
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
