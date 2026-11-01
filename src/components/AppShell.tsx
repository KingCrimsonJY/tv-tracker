import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  AlertCircle,
  Bookmark,
  Download,
  Film,
  Home,
  Layers,
  ListOrdered,
  LogIn,
  LogOut,
  Search,
  User as UserIcon,
  X,
} from 'lucide-react';
import { Button, Modal } from '@heroui/react';
import { useTracker } from '../context/TrackerContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { zh } from '../i18n/zh';

const NAV_ITEMS = [
  { to: '/', label: zh.nav.home, icon: Home, end: true },
  { to: '/library', label: zh.nav.library, icon: Film, end: false },
  { to: '/lists', label: zh.nav.lists, icon: Layers, end: false },
  { to: '/search', label: zh.nav.search, icon: Search, end: false },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    user,
    lists,
    toastMessage,
    dismissToast,
    authServiceNotice,
    dismissAuthServiceNotice,
    signIn,
    signOut,
  } = useTracker();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const location = useLocation();

  const pinnedLists = Object.values(lists)
    .filter((l) => l.pinned)
    .sort((a, b) => (a.rank < b.rank ? -1 : 1));

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signIn();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google 登录窗口未能完成授权');
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)] flex flex-col sm:flex-row">
      {/* Desktop Left Sidebar (>= 1024px) */}
      <aside
        aria-label="桌面端主导航"
        className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 bg-[var(--surface)] border-r border-[var(--border)] z-30 select-none"
      >
        <div className="h-16 px-6 flex items-center justify-between border-b border-[var(--separator)]">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-[var(--foreground)] whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center text-[var(--accent-foreground)] font-bold text-sm">
              帧
            </span>
            <span>{zh.app.name}</span>
          </NavLink>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)]'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)]'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          {pinnedLists.length > 0 && (
            <div className="pt-6 mt-6 border-t border-[var(--separator)]">
              <div className="px-3.5 mb-2 text-xs font-medium text-[var(--muted)] tracking-wider">
                {zh.nav.pinnedListsHeader}
              </div>
              <div className="space-y-1">
                {pinnedLists.map((list) => (
                  <NavLink
                    key={list.id}
                    to={`/lists/${list.id}`}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3.5 py-2 min-h-[40px] rounded-lg text-sm transition-colors truncate ${
                        isActive
                          ? 'bg-[var(--surface-secondary)] text-[var(--foreground)] font-medium'
                          : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)]'
                      }`
                    }
                  >
                    {list.kind === 'ordered' ? (
                      <ListOrdered className="w-4 h-4 shrink-0 text-[var(--accent-text)]" />
                    ) : (
                      <Bookmark className="w-4 h-4 shrink-0 text-[var(--muted)]" />
                    )}
                    <span className="truncate">{list.name}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-[var(--separator)] space-y-2">
          {!isInstalled && (isInstallable || isIOS) && (
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onPress={() => (isInstallable ? install() : setShowIosGuide(true))}
              className="justify-start gap-2 text-xs"
            >
              <Download className="w-4 h-4" />
              <span>{zh.app.installApp}</span>
            </Button>
          )}

          {user ? (
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-[var(--surface-secondary)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-[var(--accent-text)] shrink-0 overflow-hidden">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || '用户头像'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserIcon className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--foreground)] truncate">
                    {user.displayName || user.email || '已登录'}
                  </p>
                  <p className="text-[11px] text-[var(--muted)] truncate">云端实时同步中</p>
                </div>
              </div>
              <button
                type="button"
                onClick={signOut}
                aria-label={zh.app.signOut}
                title={zh.app.signOut}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-tertiary)] transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              fullWidth
              onPress={handleSignIn}
              className="gap-2 font-medium"
            >
              <LogIn className="w-4 h-4" />
              <span>{zh.app.signInWithGoogle}</span>
            </Button>
          )}
          {authError && <p className="text-[11px] text-[var(--warning)] px-1">{authError}</p>}
        </div>
      </aside>

      {/* Tablet Left Navigation Rail (640px - 1024px) */}
      <aside
        aria-label="平板端导航栏"
        className="hidden sm:flex lg:hidden sm:w-20 sm:flex-col sm:fixed sm:inset-y-0 sm:left-0 bg-[var(--surface)] border-r border-[var(--border)] z-30 items-center py-4 select-none"
      >
        <NavLink
          to="/"
          aria-label={zh.app.name}
          className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center text-[var(--accent-foreground)] font-bold text-base mb-6"
        >
          帧
        </NavLink>

        <nav className="flex-1 flex flex-col items-center gap-2 w-full px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `w-full py-2.5 min-h-[52px] rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)]'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)]'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-2">
          {user ? (
            <button
              type="button"
              onClick={signOut}
              aria-label={zh.app.signOut}
              className="w-11 h-11 rounded-full bg-[var(--surface-secondary)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              aria-label={zh.app.signInWithGoogle}
              className="w-11 h-11 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-[var(--accent-text)] hover:bg-[var(--surface-tertiary)]"
            >
              <LogIn className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area: bottom padding = 64px + safe-area + 16px on phone */}
      <div className="flex-1 sm:pl-20 lg:pl-64 flex flex-col min-w-0">
        {authServiceNotice && (
          <div
            role="alert"
            className="bg-amber-500/15 border-b border-amber-500/30 text-amber-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm z-40 sticky top-0 backdrop-blur-md"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span className="leading-relaxed">{authServiceNotice}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleSignIn}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors text-xs shadow-sm"
              >
                重新授权登录
              </button>
              <a
                href="https://console.developers.google.com/apis/api/securetoken.googleapis.com/overview?project=335869385733"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 transition-colors text-xs font-medium"
              >
                启用 API
              </a>
              <button
                type="button"
                onClick={dismissAuthServiceNotice}
                aria-label="关闭提示"
                className="p-1 rounded-md text-amber-400/80 hover:text-amber-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <main className="flex-1 w-full max-w-[1400px] mx-auto pb-[calc(64px+env(safe-area-inset-bottom,0px)+16px)] sm:pb-12">
          {children}
        </main>
      </div>

      {/* Global Toast Notification for Rollbacks / Errors */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(84px+env(safe-area-inset-bottom,0px))] sm:bottom-6 right-4 left-4 sm:left-auto sm:max-w-sm z-50 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[var(--overlay)] border border-[var(--danger)] text-[var(--foreground)] shadow-xl"
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-[var(--danger)]" />
            <span className="truncate">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={dismissToast}
            aria-label={zh.app.close}
            className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Phone Bottom Tab Bar (< 640px): height = 64px + env(safe-area-inset-bottom), icons & labels inside 64px area */}
      <nav
        aria-label="移动端底部导航"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-glass)] backdrop-blur-md border-t border-[var(--border)] h-[calc(64px+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] px-2 select-none"
      >
        <div className="grid grid-cols-4 items-center h-[64px] w-full">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isDetailActive =
              item.to === '/library' && location.pathname.startsWith('/title/');
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center h-[52px] min-w-[44px] rounded-lg transition-colors ${
                    isActive || isDetailActive
                      ? 'text-[var(--accent-text)]'
                      : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium mt-0.5 whitespace-nowrap">
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* iOS PWA Install Guide Modal */}
      <Modal.Backdrop isOpen={showIosGuide} onOpenChange={setShowIosGuide} isDismissable>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)]">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold">
                {zh.app.installIosGuideTitle}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-2 text-sm text-[var(--muted)]">
              <p>{zh.app.installIosGuideBody}</p>
            </Modal.Body>
            <Modal.Footer className="mt-5 flex justify-end">
              <Button variant="secondary" size="sm" onPress={() => setShowIosGuide(false)}>
                {zh.app.close}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
};
