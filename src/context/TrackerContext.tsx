import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  apiFetch,
  ApiError,
  fetchAuthStatus,
  fetchStateSnapshot,
  loginPasswordApi,
  logoutAllApi,
  logoutApi,
  setupPasswordApi,
} from '../data/api.ts';
import {
  createTrackerActions,
  type CustomTitleInput,
  getActiveProgressFromState,
  type UpdateTitleDetailsInput,
} from '../data/actions.ts';
import { runOneTimeLegacyStorageCleanup } from '../data/storageCleanup.ts';
import {
  applyMutationResult,
  applyStateSnapshot,
  buildExportV2FromState,
  createInitialAppState,
} from '../data/store.ts';
import type {
  AppSettingsDoc,
  AppStateSnapshot,
  CollectionSort,
  DisplayLang,
  ListEntryDoc,
  ListKind,
  ManualState,
  ProgressDoc,
  SeasonDoc,
  StateMutationResult,
  TitleDoc,
  WatchListDoc,
} from '../domain/types.ts';

export type { CustomTitleInput, UpdateTitleDetailsInput };

const SSE_WATCHDOG_TIMEOUT_MS = 15_000;
const OFFLINE_OVERLAY_DELAY_MS = 5_000;

export interface TrackerContextValue {
  authReady: boolean;
  needsSetup: boolean;
  authenticated: boolean;
  loadingData: boolean;
  serverUnreachable: boolean;
  retryConnection: () => Promise<void>;
  toastMessage: string | null;
  showToast: (message: string) => void;
  dismissToast: () => void;
  titles: Record<string, TitleDoc>;
  seasonsByTitle: Record<string, SeasonDoc[]>;
  progressByTitle: Record<string, Record<string, ProgressDoc>>;
  lists: Record<string, WatchListDoc>;
  entriesByList: Record<string, ListEntryDoc[]>;
  settings: AppSettingsDoc;
  setupPassword: (password: string, setupCode: string) => Promise<void>;
  loginWithPassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signOutAll: () => Promise<void>;
  getActiveProgress: (title: TitleDoc) => ProgressDoc;
  addTitleFromTmdb: (
    mediaType: 'movie' | 'tv',
    sourceId: string,
    targetListId?: string
  ) => Promise<TitleDoc>;
  createCustomOrLinkTitle: (input: CustomTitleInput) => Promise<TitleDoc>;
  updateTitleDetails: (titleId: string, input: UpdateTitleDetailsInput) => Promise<void>;
  updateTitleLanguage: (
    titleId: string,
    displayLang: DisplayLang | null,
    customName?: string
  ) => Promise<void>;
  setTitleManualState: (titleId: string, manualState: ManualState) => Promise<void>;
  fetchAndCacheTitleRatings: (titleId: string) => Promise<void>;
  refreshTitleMetadata: (titleId: string) => Promise<void>;
  removeTitle: (titleId: string) => Promise<void>;
  toggleEpisode: (titleId: string, episodeKey: string) => Promise<void>;
  toggleSeason: (titleId: string, seasonNumber: number, markWatched: boolean) => Promise<void>;
  markUpTo: (titleId: string, episodeKey: string) => Promise<void>;
  markWholeTitle: (titleId: string, markWatched: boolean) => Promise<void>;
  saveResume: (
    titleId: string,
    resume: { episodeKey: string | null; seconds: number } | null
  ) => Promise<void>;
  startTitleRewatch: (titleId: string) => Promise<void>;
  cancelTitleRewatch: (titleId: string) => Promise<void>;
  createList: (input: {
    name: string;
    kind: ListKind;
    description?: string;
    pinned?: boolean;
  }) => Promise<WatchListDoc>;
  deleteList: (listId: string) => Promise<void>;
  togglePinList: (listId: string) => Promise<void>;
  updateCollectionSort: (listId: string, sort: CollectionSort) => Promise<void>;
  addTitleToList: (listId: string, titleId: string) => Promise<void>;
  removeEntryFromList: (listId: string, entryId: string) => Promise<void>;
  reorderListEntry: (listId: string, activeEntryId: string, overEntryId: string) => Promise<void>;
  updateSettings: (partial: Partial<AppSettingsDoc>) => Promise<void>;
  exportAllDataJson: () => string;
  importBackupData: (rawPayload: unknown) => Promise<void>;
}

const TrackerContext = createContext<TrackerContextValue | null>(null);

export const TrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authReady, setAuthReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [serverUnreachable, setServerUnreachable] = useState(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false
  );
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  const [state, setState] = useState<AppStateSnapshot>(() => createInitialAppState());
  const stateRef = useRef<AppStateSnapshot>(state);
  stateRef.current = state;

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (typeof window !== 'undefined') {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setToastMessage(null);
      }, 4500);
    }
  }, []);

  const dismissToast = useCallback(() => {
    setToastMessage(null);
    if (typeof window !== 'undefined' && toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  // Run one-time cleanup of leftover Firebase IndexedDB & localStorage keys on app start
  useEffect(() => {
    void runOneTimeLegacyStorageCleanup();
  }, []);

  // Apply theme (dark / light / system) to document.documentElement
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const root = document.documentElement;
    const applyResolvedTheme = (mode: 'dark' | 'light') => {
      root.classList.toggle('dark', mode === 'dark');
      root.classList.toggle('light', mode === 'light');
      root.setAttribute('data-theme', mode);
    };

    if (state.settings.theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: light)');
      applyResolvedTheme(mql.matches ? 'light' : 'dark');
      const handler = (e: MediaQueryListEvent) => applyResolvedTheme(e.matches ? 'light' : 'dark');
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    } else {
      applyResolvedTheme(state.settings.theme);
    }
  }, [state.settings.theme]);

  const applyServerMutation = useCallback((mutation: StateMutationResult) => {
    setState((prev) => applyMutationResult(prev, mutation));
  }, []);

  const refreshStateFromServer = useCallback(async () => {
    try {
      const snapshot = await fetchStateSnapshot();
      // Only replace local state with a snapshot whose version >= current local version
      setState((prev) => applyStateSnapshot(prev, snapshot));
      setServerUnreachable(false);
      setLoadingData(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthenticated(false);
        setState(createInitialAppState());
        setLoadingData(false);
        return;
      }
      setServerUnreachable(true);
      setLoadingData(false);
    }
  }, []);

  // Initial auth check
  const checkAuthAndLoad = useCallback(async () => {
    try {
      const status = await fetchAuthStatus();
      setNeedsSetup(status.needsSetup);
      setAuthenticated(status.authenticated);
      setServerUnreachable(false);
      setAuthReady(true);

      if (status.authenticated) {
        setLoadingData(true);
        await refreshStateFromServer();
      } else {
        setState(createInitialAppState());
        setLoadingData(false);
      }
    } catch {
      setServerUnreachable(true);
      setAuthReady(true);
      setLoadingData(false);
    }
  }, [refreshStateFromServer]);

  useEffect(() => {
    void checkAuthAndLoad();
  }, [checkAuthAndLoad]);

  const retryConnection = useCallback(async () => {
    await checkAuthAndLoad();
    setReconnectTrigger((n) => n + 1);
  }, [checkAuthAndLoad]);

  // Listen to browser offline / online events: show 无法连接到服务器 immediately when offline
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOffline = () => {
      setServerUnreachable(true);
    };
    const handleOnline = () => {
      void retryConnection();
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [retryConnection]);

  // Refetch state when tab becomes visible again
  useEffect(() => {
    if (!authenticated || typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshStateFromServer();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [authenticated, refreshStateFromServer]);

  // Subscribe to SSE /api/events with 15s byte watchdog and 5s offline blocking policy
  useEffect(() => {
    if (!authenticated) return;

    let cancelled = false;
    let abortController: AbortController | null = null;
    let offlineTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

    const clearWatchdog = () => {
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
    };

    const resetWatchdog = () => {
      clearWatchdog();
      if (cancelled) return;
      watchdogTimer = setTimeout(() => {
        if (!cancelled) {
          abortController?.abort();
        }
      }, SSE_WATCHDOG_TIMEOUT_MS);
    };

    const startOfflineCountdown = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setServerUnreachable(true);
        return;
      }
      if (offlineTimer || cancelled) return;
      offlineTimer = setTimeout(() => {
        if (!cancelled) {
          setServerUnreachable(true);
        }
      }, OFFLINE_OVERLAY_DELAY_MS);
    };

    const clearOfflineCountdown = () => {
      if (offlineTimer) {
        clearTimeout(offlineTimer);
        offlineTimer = null;
      }
      if (!cancelled && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
        setServerUnreachable(false);
      }
    };

    const connectEventStream = async (isReconnect: boolean) => {
      if (cancelled) return;
      abortController = new AbortController();
      resetWatchdog();

      try {
        const res = await apiFetch('/api/events', {
          signal: abortController.signal,
          headers: { Accept: 'text/event-stream' },
        });

        if (res.status === 401) {
          clearWatchdog();
          if (!cancelled) {
            setAuthenticated(false);
            setState(createInitialAppState());
          }
          return;
        }

        if (!res.ok || !res.body) {
          throw new Error(`SSE HTTP ${res.status}`);
        }

        clearOfflineCountdown();
        resetWatchdog();
        if (isReconnect) {
          await refreshStateFromServer();
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          clearOfflineCountdown();
          resetWatchdog();

          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() || '';

          for (const block of blocks) {
            const lines = block.split('\n');
            for (const line of lines) {
              if (line.startsWith('data:')) {
                const jsonStr = line.slice(5).trim();
                if (!jsonStr) continue;
                try {
                  const mutation = JSON.parse(jsonStr) as StateMutationResult;
                  applyServerMutation(mutation);
                } catch {
                  // ignore malformed event
                }
              }
            }
          }
        }

        clearWatchdog();
        if (!cancelled) {
          startOfflineCountdown();
          retryTimer = setTimeout(() => connectEventStream(true), 1500);
        }
      } catch {
        clearWatchdog();
        if (!cancelled) {
          startOfflineCountdown();
          retryTimer = setTimeout(() => connectEventStream(true), 2000);
        }
      }
    };

    void connectEventStream(false);

    return () => {
      cancelled = true;
      clearWatchdog();
      abortController?.abort();
      if (offlineTimer) clearTimeout(offlineTimer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [authenticated, reconnectTrigger, applyServerMutation, refreshStateFromServer]);

  const setupPassword = useCallback(
    async (password: string, setupCode: string) => {
      await setupPasswordApi(password, setupCode);
      setNeedsSetup(false);
      setAuthenticated(true);
      setLoadingData(true);
      await refreshStateFromServer();
    },
    [refreshStateFromServer]
  );

  const loginWithPassword = useCallback(
    async (password: string) => {
      await loginPasswordApi(password);
      setNeedsSetup(false);
      setAuthenticated(true);
      setLoadingData(true);
      await refreshStateFromServer();
    },
    [refreshStateFromServer]
  );

  const signOut = useCallback(async () => {
    await logoutApi();
    setAuthenticated(false);
    setState(createInitialAppState());
  }, []);

  const signOutAll = useCallback(async () => {
    await logoutAllApi();
    setAuthenticated(false);
    setState(createInitialAppState());
  }, []);

  const getActiveProgress = useCallback(
    (title: TitleDoc): ProgressDoc => {
      return getActiveProgressFromState(state, title);
    },
    [state]
  );

  const actions = useMemo(
    () =>
      createTrackerActions({
        getState: () => stateRef.current,
        setState,
        applyServerMutation,
        showToast,
      }),
    [applyServerMutation, showToast]
  );

  const exportAllDataJson = useCallback((): string => {
    return JSON.stringify(buildExportV2FromState(stateRef.current), null, 2);
  }, []);

  const value = useMemo<TrackerContextValue>(
    () => ({
      authReady,
      needsSetup,
      authenticated,
      loadingData,
      serverUnreachable,
      retryConnection,
      toastMessage,
      showToast,
      dismissToast,
      titles: state.titles,
      seasonsByTitle: state.seasonsByTitle,
      progressByTitle: state.progressByTitle,
      lists: state.lists,
      entriesByList: state.entriesByList,
      settings: state.settings,
      setupPassword,
      loginWithPassword,
      signOut,
      signOutAll,
      getActiveProgress,
      ...actions,
      exportAllDataJson,
    }),
    [
      authReady,
      needsSetup,
      authenticated,
      loadingData,
      serverUnreachable,
      retryConnection,
      toastMessage,
      showToast,
      dismissToast,
      state,
      setupPassword,
      loginWithPassword,
      signOut,
      signOutAll,
      getActiveProgress,
      actions,
      exportAllDataJson,
    ]
  );

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
};

export function useTracker(): TrackerContextValue {
  const ctx = useContext(TrackerContext);
  if (!ctx) {
    throw new Error('useTracker must be used within TrackerProvider');
  }
  return ctx;
}
