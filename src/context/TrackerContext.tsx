import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@heroui/react';
import {
  ApiError,
  assertSessionEstablished,
  fetchAuthStatus,
  fetchStateSnapshot,
  fetchTmdbGenresApi,
  loginPasswordApi,
  logoutAllApi,
  logoutApi,
  setupPasswordApi,
} from '../data/api.ts';
import {
  createTrackerActions,
  type CustomTitleInput,
  getActiveProgressFromState,
  type TrackerActions,
  type UpdateTitleDetailsInput,
} from '../data/actions.ts';
import type { ToastVariant } from '../data/actions/types.ts';
import { createReconciler } from '../data/reconcile.ts';
import { createInitialAppState, trackerStore } from '../data/store.ts';
import { createSyncEngine, type SyncEngine } from '../data/syncEngine.ts';
import { useTrackerState } from '../data/useTrackerState.ts';
import type { AppStateSnapshot, ProgressDoc, TitleDoc } from '../domain/types.ts';
import { applyResolvedLocaleToDom, resolveActiveLocale } from '../i18n/index.ts';
import { useSseEventStream } from './useSseEventStream.ts';

export type { CustomTitleInput, ToastVariant, UpdateTitleDetailsInput };

/**
 * Session status and every action. Synchronized data is not here: read it with `useTrackerState(selector)`
 * so a component re-renders only for the slices it shows.
 */
export interface TrackerContextValue extends TrackerActions {
  authReady: boolean;
  needsSetup: boolean;
  authenticated: boolean;
  loadingData: boolean;
  serverUnreachable: boolean;
  retryConnection: () => Promise<void>;
  showToast: (message: string, variant?: ToastVariant) => void;
  setupPassword: (password: string, setupCode: string) => Promise<void>;
  loginWithPassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signOutAll: () => Promise<void>;
  getActiveProgress: (title: TitleDoc) => ProgressDoc;
  tmdbGenres: { zh: Record<number, string>; en: Record<number, string> } | null;
}

const TrackerContext = createContext<TrackerContextValue | null>(null);

const selectTheme = (state: AppStateSnapshot) => state.settings.theme;
const selectUiLang = (state: AppStateSnapshot) => state.settings.uiLang;

export const TrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authReady, setAuthReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [serverUnreachable, setServerUnreachable] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false,
  );
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const [tmdbGenres, setTmdbGenres] = useState<{
    zh: Record<number, string>;
    en: Record<number, string>;
  } | null>(null);

  const theme = useTrackerState(selectTheme);
  const uiLang = useTrackerState(selectUiLang);

  const showToast = useCallback((message: string, variant: ToastVariant = 'default') => {
    switch (variant) {
      case 'success':
        toast.success(message);
        break;
      case 'warning':
        toast.warning(message);
        break;
      case 'danger':
        toast.danger(message);
        break;
      case 'accent':
        toast.info(message);
        break;
      default:
        toast(message);
        break;
    }
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const root = document.documentElement;
    const applyResolvedTheme = (mode: 'dark' | 'light') => {
      root.classList.toggle('dark', mode === 'dark');
      root.classList.toggle('light', mode === 'light');
      root.setAttribute('data-theme', mode);
      const meta = document.getElementById('meta-theme-color');
      if (meta) {
        meta.setAttribute('content', mode === 'light' ? '#f5f5f8' : '#121215');
      }
      try {
        localStorage.setItem('zhenji_resolved_theme', mode);
      } catch {
        // Ignore storage write errors in restricted contexts
      }
    };

    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: light)');
      applyResolvedTheme(mql.matches ? 'light' : 'dark');
      const handler = (e: MediaQueryListEvent) => applyResolvedTheme(e.matches ? 'light' : 'dark');
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    applyResolvedTheme(theme);
  }, [theme]);

  useEffect(() => {
    const applyCurrentLocale = () => {
      applyResolvedLocaleToDom(resolveActiveLocale(uiLang));
    };
    applyCurrentLocale();
    if (uiLang === 'system' && typeof window !== 'undefined') {
      window.addEventListener('languagechange', applyCurrentLocale);
      return () => window.removeEventListener('languagechange', applyCurrentLocale);
    }
  }, [uiLang]);

  useEffect(() => {
    if (!authenticated) return;
    void fetchTmdbGenresApi()
      .then((res) => setTmdbGenres(res))
      .catch(() => {
        // Ignore; static fallback genres in catalog are used
      });
  }, [authenticated]);

  const engineRef = useRef<SyncEngine | null>(null);
  const resetState = useCallback(() => engineRef.current?.reset(createInitialAppState()), []);
  const readStateFromServer = useCallback(async () => {
    try {
      const snapshot = await fetchStateSnapshot();
      engineRef.current?.snapshot(snapshot);
      setServerUnreachable(false);
      setLoadingData(false);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthenticated(false);
        resetState();
        setLoadingData(false);
        return true;
      }
      setServerUnreachable(true);
      setLoadingData(false);
      // Not read: the reconciler asks again, so a single failed read cannot leave this device behind.
      return false;
    }
  }, [resetState]);

  const refreshStateFromServer = useMemo(() => createReconciler(readStateFromServer), [readStateFromServer]);

  const engine = useMemo(
    () =>
      createSyncEngine({
        initial: trackerStore.getState(),
        publish: trackerStore.setState,
        reconcile: refreshStateFromServer,
      }),
    [refreshStateFromServer],
  );
  engineRef.current = engine;
  const applyServerMutation = engine.mutation;

  const checkAuthAndLoad = useCallback(async () => {
    try {
      const status = await fetchAuthStatus(true);
      setNeedsSetup(status.needsSetup);
      setAuthenticated(status.authenticated);
      setServerUnreachable(false);
      setAuthReady(true);

      if (status.authenticated) {
        if (status.state) {
          engine.snapshot(status.state);
          setLoadingData(false);
        } else {
          setLoadingData(true);
          await refreshStateFromServer();
        }
      } else {
        resetState();
        setLoadingData(false);
      }
    } catch {
      setServerUnreachable(true);
      setAuthReady(true);
      setLoadingData(false);
    }
  }, [refreshStateFromServer, engine, resetState]);

  useEffect(() => {
    void checkAuthAndLoad();
  }, [checkAuthAndLoad]);

  const retryConnection = useCallback(async () => {
    await checkAuthAndLoad();
    setReconnectTrigger((n) => n + 1);
  }, [checkAuthAndLoad]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOffline = () => setServerUnreachable(true);
    const handleOnline = () => void retryConnection();
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [retryConnection]);

  useEffect(() => {
    if (!authenticated || typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshStateFromServer();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [authenticated, refreshStateFromServer]);

  useSseEventStream({
    authenticated: authenticated && !loadingData,
    reconnectTrigger,
    onSignedOut: useCallback(() => {
      setAuthenticated(false);
      resetState();
    }, [resetState]),
    setServerUnreachable,
    applyServerMutation,
    refreshStateFromServer,
  });

  const setupPassword = useCallback(
    async (password: string, setupCode: string) => {
      await setupPasswordApi(password, setupCode);
      await assertSessionEstablished();
      setNeedsSetup(false);
      setAuthenticated(true);
      setLoadingData(true);
      await refreshStateFromServer();
    },
    [refreshStateFromServer],
  );

  const loginWithPassword = useCallback(
    async (password: string) => {
      await loginPasswordApi(password);
      await assertSessionEstablished();
      setNeedsSetup(false);
      setAuthenticated(true);
      setLoadingData(true);
      await refreshStateFromServer();
    },
    [refreshStateFromServer],
  );

  const signOut = useCallback(async () => {
    await logoutApi();
    setAuthenticated(false);
    resetState();
  }, [resetState]);

  const signOutAll = useCallback(async () => {
    await logoutAllApi();
    setAuthenticated(false);
    resetState();
  }, [resetState]);

  const getActiveProgress = useCallback(
    (title: TitleDoc): ProgressDoc => getActiveProgressFromState(trackerStore.getState(), title),
    [],
  );

  const actions = useMemo(
    () =>
      createTrackerActions({
        getState: trackerStore.getState,
        optimistic: engine.optimistic,
        applyServerMutation,
        showToast,
      }),
    [engine, applyServerMutation, showToast],
  );

  const value = useMemo<TrackerContextValue>(
    () => ({
      authReady,
      needsSetup,
      authenticated,
      loadingData,
      serverUnreachable,
      retryConnection,
      showToast,
      setupPassword,
      loginWithPassword,
      signOut,
      signOutAll,
      getActiveProgress,
      tmdbGenres,
      ...actions,
    }),
    [
      authReady,
      needsSetup,
      authenticated,
      loadingData,
      serverUnreachable,
      retryConnection,
      showToast,
      setupPassword,
      loginWithPassword,
      signOut,
      signOutAll,
      getActiveProgress,
      tmdbGenres,
      actions,
    ],
  );

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
};

export function useTracker(): TrackerContextValue {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTracker must be used within TrackerProvider');
  return ctx;
}
