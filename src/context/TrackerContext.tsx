import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { toast } from '@heroui/react';
import {
  ApiError,
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
  type UpdateTitleDetailsInput,
} from '../data/actions.ts';
import type { ToastVariant } from '../data/actions/types.ts';
import { runOneTimeLegacyStorageCleanup } from '../data/storageCleanup.ts';
import { trackerStore } from '../data/store.ts';
import { createReconciler } from '../data/reconcile.ts';
import type {
  AppSettingsDoc,
  CollectionSort,
  DisplayLang,
  ListEntryDoc,
  ListKind,
  ManualState,
  MetadataRefreshStatus,
  MetadataRefreshCounts,
  ProgressDoc,
  SeasonDoc,
  StateMutationResult,
  TitleDoc,
  WatchListDoc,
} from '../domain/types.ts';
import { applyResolvedLocaleToDom, resolveActiveLocale } from '../i18n/index.ts';
import { useSseEventStream } from './useSseEventStream.ts';

export type { CustomTitleInput, ToastVariant, UpdateTitleDetailsInput };

export interface TrackerContextValue {
  authReady: boolean;
  needsSetup: boolean;
  authenticated: boolean;
  loadingData: boolean;
  serverUnreachable: boolean;
  retryConnection: () => Promise<void>;
  showToast: (message: string, variant?: ToastVariant) => void;
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
  setStructureLock: (id: string, locked: boolean) => Promise<void>;
  resolveStructure: (id: string, input: Parameters<typeof import('../data/api.ts').decideStructureApi>[1]) => Promise<void>;
  changeTitleSource: (id: string, input: Parameters<typeof import('../data/api.ts').changeTitleSourceApi>[1]) => Promise<void>;
  fetchAndCacheTitleRatings: (titleId: string) => Promise<void>;
  refreshTitleMetadata: (titleId: string) => Promise<MetadataRefreshStatus>;
  refreshAllTmdbMetadata: (onProgress?: (done: number, total: number) => void) => Promise<MetadataRefreshCounts>;
  refreshLinkTitlePlaylist: (titleId: string) => Promise<number>;
  tmdbGenres: { zh: Record<number, string>; en: Record<number, string> } | null;
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
  deleteTitlePlaythrough: (titleId: string, playthroughId: string) => Promise<void>;
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
  const [serverUnreachable, setServerUnreachable] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const [tmdbGenres, setTmdbGenres] = useState<{
    zh: Record<number, string>;
    en: Record<number, string>;
  } | null>(null);

  const state = useSyncExternalStore(
    trackerStore.subscribe,
    trackerStore.getState,
    trackerStore.getState
  );

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
    void runOneTimeLegacyStorageCleanup();
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

    if (state.settings.theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: light)');
      applyResolvedTheme(mql.matches ? 'light' : 'dark');
      const handler = (e: MediaQueryListEvent) => applyResolvedTheme(e.matches ? 'light' : 'dark');
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    applyResolvedTheme(state.settings.theme);
  }, [state.settings.theme]);

  useEffect(() => {
    const applyCurrentLocale = () => {
      applyResolvedLocaleToDom(resolveActiveLocale(state.settings.uiLang));
    };
    applyCurrentLocale();
    if (state.settings.uiLang === 'system' && typeof window !== 'undefined') {
      window.addEventListener('languagechange', applyCurrentLocale);
      return () => window.removeEventListener('languagechange', applyCurrentLocale);
    }
  }, [state.settings.uiLang]);

  useEffect(() => {
    if (!authenticated) return;
    void fetchTmdbGenresApi()
      .then((res) => setTmdbGenres(res))
      .catch(() => {
        // Ignore; static fallback genres in catalog are used
      });
  }, [authenticated]);

  const readStateFromServer = useCallback(async () => {
    try {
      const snapshot = await fetchStateSnapshot();
      trackerStore.applySnapshot(snapshot);
      setServerUnreachable(false);
      setLoadingData(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthenticated(false);
        trackerStore.reset();
        setLoadingData(false);
        return;
      }
      setServerUnreachable(true);
      setLoadingData(false);
    }
  }, []);

  const refreshStateFromServer = useMemo(() => createReconciler(readStateFromServer), [readStateFromServer]);

  const applyServerMutation = useCallback(
    (mutation: StateMutationResult) => {
      trackerStore.applyMutation(mutation);
      void refreshStateFromServer();
    },
    [refreshStateFromServer]
  );

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
        trackerStore.reset();
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
    authenticated,
    reconnectTrigger,
    setAuthenticated,
    setServerUnreachable,
    applyServerMutation,
    refreshStateFromServer,
  });

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
    trackerStore.reset();
  }, []);

  const signOutAll = useCallback(async () => {
    await logoutAllApi();
    setAuthenticated(false);
    trackerStore.reset();
  }, []);

  const getActiveProgress = useCallback(
    (title: TitleDoc): ProgressDoc => getActiveProgressFromState(state, title),
    [state]
  );

  const actions = useMemo(
    () =>
      createTrackerActions({
        getState: trackerStore.getState,
        setState: trackerStore.setState,
        applyServerMutation,
        showToast,
        refetchState: refreshStateFromServer,
      }),
    [applyServerMutation, showToast, refreshStateFromServer]
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
      state,
      setupPassword,
      loginWithPassword,
      signOut,
      signOutAll,
      getActiveProgress,
      tmdbGenres,
      actions,
    ]
  );

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
};

export function useTracker(): TrackerContextValue {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTracker must be used within TrackerProvider');
  return ctx;
}
