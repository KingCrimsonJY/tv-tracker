import { useTrackerSelection } from '../data/useTrackerSelection';
import { createMutationSync } from '../data/mutationSync';
import { applyInFlightOpsToState, type InFlightProgressOp } from '../data/actions/types';
import type { AppStateSnapshot } from '../domain/types';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@heroui/react';
import {
  ApiError,
  fetchAuthStatus,
  fetchStateSnapshot,
  fetchTmdbGenresApi,
  assertSessionEstablished,
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
  addTitleFromTmdb: (mediaType: 'movie' | 'tv', sourceId: string, targetListId?: string) => Promise<TitleDoc>;
  createCustomOrLinkTitle: (input: CustomTitleInput) => Promise<TitleDoc>;
  updateTitleDetails: (titleId: string, input: UpdateTitleDetailsInput) => Promise<void>;
  updateTitleLanguage: (titleId: string, displayLang: DisplayLang | null, customName?: string) => Promise<void>;
  setTitleManualState: (titleId: string, manualState: ManualState) => Promise<void>;
  setStructureLock: (id: string, locked: boolean) => Promise<void>;
  resolveStructure: (
    id: string,
    input: Parameters<typeof import('../data/api.ts').decideStructureApi>[1],
  ) => Promise<void>;
  changeTitleSource: (
    id: string,
    input: Parameters<typeof import('../data/api.ts').changeTitleSourceApi>[1],
  ) => Promise<void>;
  fetchAndCacheTitleRatings: (titleId: string) => Promise<void>;
  refreshTitleMetadata: (titleId: string) => Promise<MetadataRefreshStatus>;
  refreshAllTmdbMetadata: (onProgress?: (done: number, total: number) => void) => Promise<MetadataRefreshCounts>;
  refreshLinkTitlePlaylist: (titleId: string) => Promise<number>;
  tmdbGenres: { zh: Record<number, string>; en: Record<number, string> } | null;
  removeTitle: (titleId: string) => Promise<void>;
  toggleEpisode: (titleId: string, episodeKey: string) => Promise<void>;
  markEpisodeWatched: (titleId: string, episodeKey: string) => Promise<void>;
  toggleSeason: (titleId: string, seasonNumber: number, markWatched: boolean) => Promise<void>;
  markUpTo: (titleId: string, episodeKey: string) => Promise<void>;
  markWholeTitle: (titleId: string, markWatched: boolean) => Promise<void>;
  saveResume: (titleId: string, resume: { episodeKey: string | null; seconds: number } | null) => Promise<void>;
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
  exportAllDataJson: () => Promise<string>;
  importBackupData: (rawPayload: unknown) => Promise<void>;
}

type ContextValue = Omit<
  TrackerContextValue,
  'titles' | 'seasonsByTitle' | 'progressByTitle' | 'lists' | 'entriesByList' | 'settings'
>;
const TrackerContext = createContext<ContextValue | null>(null);

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

  const settings = useTrackerSelection((state) => state.settings);
  const inFlightOps = useMemo(() => new Map<string, InFlightProgressOp>(), []);

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

    if (settings.theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: light)');
      applyResolvedTheme(mql.matches ? 'light' : 'dark');
      const handler = (e: MediaQueryListEvent) => applyResolvedTheme(e.matches ? 'light' : 'dark');
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    applyResolvedTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    const applyCurrentLocale = () => {
      applyResolvedLocaleToDom(resolveActiveLocale(settings.uiLang));
    };
    applyCurrentLocale();
    if (settings.uiLang === 'system' && typeof window !== 'undefined') {
      window.addEventListener('languagechange', applyCurrentLocale);
      return () => window.removeEventListener('languagechange', applyCurrentLocale);
    }
  }, [settings.uiLang]);

  useEffect(() => {
    if (!authenticated) return;
    void fetchTmdbGenresApi()
      .then((res) => setTmdbGenres(res))
      .catch(() => {
        // Ignore; static fallback genres in catalog are used
      });
  }, [authenticated]);

  const syncRef = useRef<ReturnType<typeof createMutationSync> | null>(null);
  const readStateFromServer = useCallback(async () => {
    try {
      const snapshot = await fetchStateSnapshot();
      syncRef.current?.snapshot(snapshot);
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

  const sync = useMemo(
    () =>
      createMutationSync({
        initial: trackerStore.getState(),
        publish: (confirmed) => trackerStore.setState(applyInFlightOpsToState(confirmed, inFlightOps)),
        reconcile: refreshStateFromServer,
      }),
    [inFlightOps, refreshStateFromServer],
  );
  syncRef.current = sync;
  const applyServerMutation = sync.mutation;

  const checkAuthAndLoad = useCallback(async () => {
    try {
      const status = await fetchAuthStatus(true);
      setNeedsSetup(status.needsSetup);
      setAuthenticated(status.authenticated);
      setServerUnreachable(false);
      setAuthReady(true);

      if (status.authenticated) {
        if (status.state) {
          sync.snapshot(status.state);
          setLoadingData(false);
        } else {
          setLoadingData(true);
          await refreshStateFromServer();
        }
      } else {
        trackerStore.reset();
        setLoadingData(false);
      }
    } catch {
      setServerUnreachable(true);
      setAuthReady(true);
      setLoadingData(false);
    }
  }, [refreshStateFromServer, sync]);

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
    setAuthenticated,
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
    trackerStore.reset();
  }, []);

  const signOutAll = useCallback(async () => {
    await logoutAllApi();
    setAuthenticated(false);
    trackerStore.reset();
  }, []);

  const getActiveProgress = useCallback(
    (title: TitleDoc): ProgressDoc => getActiveProgressFromState(trackerStore.getState(), title),
    [],
  );

  const actions = useMemo(
    () =>
      createTrackerActions({
        inFlightOps,
        getState: trackerStore.getState,
        setState: trackerStore.setState,
        applyServerMutation,
        showToast,
        refetchState: refreshStateFromServer,
      }),
    [applyServerMutation, showToast, refreshStateFromServer, inFlightOps],
  );

  const value = useMemo<ContextValue>(
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

export function useTracker(selector?: (state: AppStateSnapshot) => unknown): TrackerContextValue {
  useTrackerSelection(selector);
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTracker must be used within TrackerProvider');
  return { ...ctx, ...trackerStore.getState() };
}
