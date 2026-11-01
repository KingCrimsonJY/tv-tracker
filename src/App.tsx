import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Film, LogIn, Sparkles } from 'lucide-react';
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
  const { user, isDemoMode, signIn, enterDemoMode } = useTracker();

  if (!user && !isDemoMode) {
    return (
      <div className="min-h-dvh bg-[#121215] text-[#f4f4f6] flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-[#1a1a1f] border border-white/[0.08] rounded-3xl p-8 text-center">
          <Card.Content className="flex flex-col items-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-[#3b82f6] flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-[#3b82f6]/25">
              帧
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {zh.app.name}
              </h1>
              <p className="text-sm text-[#9ca3af]">{zh.app.tagline}</p>
            </div>

            <div className="w-full pt-2 space-y-3">
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

              <Button
                variant="secondary"
                size="lg"
                fullWidth
                onPress={enterDemoMode}
                className="min-h-[48px] rounded-xl font-medium gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{zh.app.enterDemoMode}</span>
              </Button>
            </div>

            <p className="text-xs text-[#6b7280] flex items-center gap-1.5 pt-2">
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
