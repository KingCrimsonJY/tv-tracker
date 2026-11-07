import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Download,
  Film,
  Home,
  Layers,
  ListOrdered,
  LogOut,
  Search,
  Settings,
} from 'lucide-react';
import { Button, Modal } from '@heroui/react';
import { useTracker } from '../context/TrackerContext.tsx';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import { useI18n } from '../i18n/index.ts';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lists, signOut } = useTracker();
  const { t } = useI18n();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { to: '/', label: t.nav.home, icon: Home, end: true },
    { to: '/library', label: t.nav.library, icon: Film, end: false },
    { to: '/lists', label: t.nav.lists, icon: Layers, end: false },
    { to: '/search', label: t.nav.search, icon: Search, end: false },
  ];

  const pinnedLists = Object.values(lists)
    .filter((l) => l.pinned)
    .sort((a, b) => (a.rank < b.rank ? -1 : 1));

  return (
    <div className="min-h-dvh bg-[var(--background)] text-[var(--foreground)] flex flex-col sm:flex-row">
      {/* Desktop Left Sidebar (>= 1024px) */}
      <aside
        aria-label={t.app.desktopNavAria}
        className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 bg-[var(--surface)] border-r border-[var(--border)] z-30 select-none"
      >
        <div className="h-16 px-6 flex items-center justify-between border-b border-[var(--separator)]">
          <NavLink
            to="/"
            className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-[var(--foreground)] whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center text-[var(--accent-foreground)] font-bold text-sm">
              {t.app.logoChar}
            </span>
            <span>{t.app.name}</span>
          </NavLink>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
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
                {t.nav.pinnedListsHeader}
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
              className="justify-start"
            >
              <Download className="w-4 h-4" />
              <span>{t.app.installApp}</span>
            </Button>
          )}

          <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl bg-[var(--surface-secondary)]">
            <NavLink
              to="/settings"
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left px-1.5 py-1 rounded-lg hover:bg-[var(--surface-tertiary)] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center text-[var(--accent-text)] shrink-0 font-semibold text-xs">
                {t.app.logoChar}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--foreground)] truncate">
                  {t.settings.title}
                </p>
                <p className="text-[11px] text-[var(--muted)] truncate">
                  {t.app.syncConnected}
                </p>
              </div>
            </NavLink>
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              onPress={() => void signOut()}
              aria-label={t.app.signOut}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Tablet Left Navigation Rail (640px - 1024px) */}
      <aside
        aria-label={t.app.tabletNavAria}
        className="hidden sm:flex lg:hidden sm:w-20 sm:flex-col sm:fixed sm:inset-y-0 sm:left-0 bg-[var(--surface)] border-r border-[var(--border)] z-30 items-center py-4 select-none"
      >
        <NavLink
          to="/"
          aria-label={t.app.name}
          className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center text-[var(--accent-foreground)] font-bold text-base mb-6"
        >
          {t.app.logoChar}
        </NavLink>

        <nav className="flex-1 flex flex-col items-center gap-2 w-full px-2">
          {navItems.map((item) => {
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
          <Button
            variant="secondary"
            isIconOnly
            onPress={() => navigate('/settings')}
            aria-label={t.settings.title}
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            variant="secondary"
            isIconOnly
            onPress={() => void signOut()}
            aria-label={t.app.signOut}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </aside>

      {/* Main Content Area: bottom padding = 64px + safe-area + 16px on phone */}
      <div className="flex-1 sm:pl-20 lg:pl-64 flex flex-col min-w-0">
        <main className="flex-1 w-full max-w-[1400px] mx-auto pb-[calc(64px+env(safe-area-inset-bottom,0px)+16px)] sm:pb-12">
          {children}
        </main>
      </div>

      {/* Phone Bottom Tab Bar (< 640px): height = 64px + env(safe-area-inset-bottom), icons & labels inside 64px area */}
      <nav
        aria-label={t.app.mobileNavAria}
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-glass)] backdrop-blur-md border-t border-[var(--border)] h-[calc(64px+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] px-2 select-none"
      >
        <div className="grid grid-cols-4 items-center h-[64px] w-full">
          {navItems.map((item) => {
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
        <Modal.Container size="sm" placement="center" scroll="inside">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{t.app.installIosGuideTitle}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p>{t.app.installIosGuideBody}</p>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" size="sm" onPress={() => setShowIosGuide(false)}>
                {t.app.close}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
};
