import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
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
import { trackerStore } from '../data/store.ts';
import type {
  AppSettingsDoc,
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
import { useSseEventStream } from './useSseEventStream.ts';

export type { CustomTitleInput, UpdateTitleDetailsInput };

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
  const [serverUnreachable, setServerUnreachable] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );
  const [reconnectTrigger, setReconnectTrigger] = useState(0);

  const state = useSyncExternalStore(
    trackerStore.subscribe,
    trackerStore.getState,
    trackerStore.getState
  );

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (typeof window !== 'undefined') {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 4500);
    }
  }, []);

  const dismissToast = useCallback(() => {
    setToastMessage(null);
    if (typeof window !== 'undefined' && toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
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

  const refreshStateFromServer = useCallback(async () => {
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

  const applyServerMutation = useCallback(
    (mutation: StateMutationResult) => {
      const { epochChanged } = trackerStore.applyMutation(mutation);
      if (epochChanged) void refreshStateFromServer();
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
    ]
  );

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
};

export function useTracker(): TrackerContextValue {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error('useTracker must be used within TrackerProvider');
  return ctx;
}
