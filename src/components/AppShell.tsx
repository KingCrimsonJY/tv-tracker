import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
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
  const { user, lists, signIn, signOut } = useTracker();
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
    <div className="min-h-dvh bg-[#121215] text-[#f4f4f6] flex flex-col sm:flex-row">
      {/* Desktop Left Sidebar (>= 1024px) */}
      <aside
        aria-label="桌面端主导航"
        className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 bg-[#16161a] border-r border-white/[0.07] z-30 select-none"
      >
        <div className="h-16 px-6 flex items-center justify-between border-b border-white/[0.06]">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-white whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-lg bg-[#3b82f6] flex items-center justify-center text-white font-bold text-sm">
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
                      ? 'bg-[#3b82f6]/15 text-[#60a5fa]'
                      : 'text-[#9ca3af] hover:text-white hover:bg-white/[0.04]'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          {pinnedLists.length > 0 && (
            <div className="pt-6 mt-6 border-t border-white/[0.06]">
              <div className="px-3.5 mb-2 text-xs font-medium text-[#6b7280] tracking-wider">
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
                          ? 'bg-white/[0.08] text-white font-medium'
                          : 'text-[#9ca3af] hover:text-white hover:bg-white/[0.04]'
                      }`
                    }
                  >
                    {list.kind === 'ordered' ? (
                      <ListOrdered className="w-4 h-4 shrink-0 text-[#60a5fa]" />
                    ) : (
                      <Bookmark className="w-4 h-4 shrink-0 text-[#9ca3af]" />
                    )}
                    <span className="truncate">{list.name}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-white/[0.06] space-y-2">
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
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-white/[0.03]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#3b82f6]/20 flex items-center justify-center text-[#60a5fa] shrink-0 overflow-hidden">
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
                  <p className="text-xs font-medium text-white truncate">
                    {user.displayName || user.email || '已登录'}
                  </p>
                  <p className="text-[11px] text-[#9ca3af] truncate">云端实时同步中</p>
                </div>
              </div>
              <button
                type="button"
                onClick={signOut}
                aria-label={zh.app.signOut}
                title={zh.app.signOut}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-[#9ca3af] hover:text-white hover:bg-white/[0.06] transition-colors"
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
          {authError && <p className="text-[11px] text-amber-400 px-1">{authError}</p>}
        </div>
      </aside>

      {/* Tablet Left Navigation Rail (640px - 1024px) */}
      <aside
        aria-label="平板端导航栏"
        className="hidden sm:flex lg:hidden sm:w-20 sm:flex-col sm:fixed sm:inset-y-0 sm:left-0 bg-[#16161a] border-r border-white/[0.07] z-30 items-center py-4 select-none"
      >
        <NavLink
          to="/"
          aria-label={zh.app.name}
          className="w-10 h-10 rounded-xl bg-[#3b82f6] flex items-center justify-center text-white font-bold text-base mb-6"
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
                      ? 'bg-[#3b82f6]/15 text-[#60a5fa]'
                      : 'text-[#9ca3af] hover:text-white hover:bg-white/[0.04]'
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
              className="w-11 h-11 rounded-full bg-white/[0.06] flex items-center justify-center text-[#9ca3af] hover:text-white"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              aria-label={zh.app.signInWithGoogle}
              className="w-11 h-11 rounded-full bg-[#3b82f6]/20 flex items-center justify-center text-[#60a5fa] hover:bg-[#3b82f6]/30"
            >
              <LogIn className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 sm:pl-20 lg:pl-64 flex flex-col min-w-0">
        <main className="flex-1 w-full max-w-[1400px] mx-auto pb-24 sm:pb-12">
          {children}
        </main>
      </div>

      {/* Phone Bottom Tab Bar (< 640px) */}
      <nav
        aria-label="移动端底部导航"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#16161a]/95 backdrop-blur-md border-t border-white/[0.08] grid grid-cols-4 items-center h-16 px-2 pb-[env(safe-area-inset-bottom)] select-none"
      >
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
                `flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 rounded-lg transition-colors ${
                  isActive || isDetailActive
                    ? 'text-[#60a5fa]'
                    : 'text-[#9ca3af] hover:text-white'
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
      </nav>

      {/* iOS PWA Install Guide Modal */}
      <Modal.Backdrop isOpen={showIosGuide} onOpenChange={setShowIosGuide} isDismissable>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog className="bg-[#1e1e24] border border-white/10 rounded-2xl p-6 text-white">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold">
                {zh.app.installIosGuideTitle}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-2 text-sm text-[#9ca3af]">
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
