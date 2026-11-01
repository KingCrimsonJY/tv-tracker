import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { buildInitialDemoDataset, SEED_CATALOG } from '../data/seedCatalog';
import { computeMovedRank, getNextRank, sortListEntries } from '../domain/ordering';
import {
  cancelRewatch,
  makeEpisodeKey,
  markUpToEpisode,
  markWholeTitleWatched,
  setResumePoint,
  setSeasonWatched,
  startRewatch,
  toggleEpisodeWatched,
} from '../domain/progress';
import type {
  AppSettingsDoc,
  CollectionSort,
  DisplayLang,
  EpisodeMeta,
  ListEntryDoc,
  ListKind,
  ManualState,
  MediaType,
  ProgressDoc,
  Ratings,
  SeasonDoc,
  TitleDoc,
  WatchListDoc,
} from '../domain/types';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';

const DEFAULT_SETTINGS: AppSettingsDoc = {
  defaultTitleLang: 'zh',
  includeSpecials: false,
  homeSections: [
    { id: 'continue_watching', enabled: true, rank: 'a0' },
    { id: 'new_episodes', enabled: true, rank: 'a1' },
    { id: 'pinned_lists', enabled: true, rank: 'a2' },
    { id: 'recently_added', enabled: false, rank: 'a3' },
    { id: 'watchlist', enabled: false, rank: 'a4' },
  ],
  theme: 'dark',
};

function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export interface CustomTitleInput {
  source: 'url' | 'custom';
  sourceUrl?: string | null;
  sourceId?: string | null;
  name: string;
  originalName?: string;
  mediaType: MediaType;
  year?: number | null;
  runtimeMin?: number | null;
  posterPath?: string | null;
  posterUrl?: string | null;
  overview?: string;
  episodeCount?: number | null;
  doubanScore?: string;
  doubanUrl?: string;
  targetListId?: string;
}

export interface UpdateTitleDetailsInput {
  name?: string;
  originalName?: string;
  mediaType?: MediaType;
  year?: number | null;
  runtimeMin?: number | null;
  posterPath?: string | null;
  overview?: string;
  episodeCount?: number | null;
  doubanScore?: string;
  doubanUrl?: string;
}

interface TrackerContextValue {
  user: User | null;
  authReady: boolean;
  isDemoMode: boolean;
  loadingData: boolean;
  titles: Record<string, TitleDoc>;
  seasonsByTitle: Record<string, SeasonDoc[]>;
  progressByTitle: Record<string, Record<string, ProgressDoc>>;
  lists: Record<string, WatchListDoc>;
  entriesByList: Record<string, ListEntryDoc[]>;
  settings: AppSettingsDoc;
  signIn: () => Promise<void>;
  enterDemoMode: () => void;
  signOut: () => Promise<void>;
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
  seedDemoLibrary: () => Promise<void>;
}

const TrackerContext = createContext<TrackerContextValue | null>(null);

const LOCAL_STORAGE_KEY = 'zhenji_demo_state_v3';

export const TrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return true;
    const saved = window.localStorage.getItem('zhenji_use_demo');
    return saved !== 'false';
  });
  const [loadingData, setLoadingData] = useState(false);

  const initialDemo = useMemo(() => buildInitialDemoDataset(), []);

  const [titles, setTitles] = useState<Record<string, TitleDoc>>(() => {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.titles) return parsed.titles;
        } catch {
          // ignore
        }
      }
    }
    return initialDemo.titles;
  });

  const [seasonsByTitle, setSeasonsByTitle] = useState<Record<string, SeasonDoc[]>>(() => {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.seasonsByTitle) return parsed.seasonsByTitle;
        } catch {
          // ignore
        }
      }
    }
    return initialDemo.seasonsByTitle;
  });

  const [progressByTitle, setProgressByTitle] = useState<
    Record<string, Record<string, ProgressDoc>>
  >(() => {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.progressByTitle) return parsed.progressByTitle;
        } catch {
          // ignore
        }
      }
    }
    return initialDemo.progressByTitle;
  });

  const [lists, setLists] = useState<Record<string, WatchListDoc>>(() => {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.lists) return parsed.lists;
        } catch {
          // ignore
        }
      }
    }
    return initialDemo.lists;
  });

  const [entriesByList, setEntriesByList] = useState<Record<string, ListEntryDoc[]>>(() => {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.entriesByList) return parsed.entriesByList;
        } catch {
          // ignore
        }
      }
    }
    return initialDemo.entriesByList;
  });

  const [settings, setSettings] = useState<AppSettingsDoc>(() => {
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.settings) return { ...DEFAULT_SETTINGS, ...parsed.settings };
        } catch {
          // ignore
        }
      }
    }
    return DEFAULT_SETTINGS;
  });

  // Apply theme (dark / light / system) to document.documentElement
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const root = document.documentElement;
    const applyResolvedTheme = (mode: 'dark' | 'light') => {
      root.classList.toggle('dark', mode === 'dark');
      root.classList.toggle('light', mode === 'light');
      root.setAttribute('data-theme', mode);
    };

    if (settings.theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: light)');
      applyResolvedTheme(mql.matches ? 'light' : 'dark');
      const handler = (e: MediaQueryListEvent) => applyResolvedTheme(e.matches ? 'light' : 'dark');
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    } else {
      applyResolvedTheme(settings.theme);
    }
  }, [settings.theme]);

  // Persist demo state to localStorage when in demo mode
  useEffect(() => {
    if (!user && isDemoMode && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify({
            titles,
            seasonsByTitle,
            progressByTitle,
            lists,
            entriesByList,
            settings,
          })
        );
      } catch {
        // ignore storage quota errors
      }
    }
  }, [user, isDemoMode, titles, seasonsByTitle, progressByTitle, lists, entriesByList, settings]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsDemoMode(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Attach Firestore real-time listeners when authenticated
  useEffect(() => {
    if (!authReady || !user) return;

    setLoadingData(true);
    const uid = user.uid;
    const titlesPath = `users/${uid}/titles`;
    const listsPath = `users/${uid}/lists`;
    const settingsPath = `users/${uid}/settings/app`;

    const subUnsubscribers = new Map<string, () => void>();

    const unsubTitles = onSnapshot(
      collection(db, titlesPath),
      (snapshot) => {
        const nextTitles: Record<string, TitleDoc> = {};
        const currentIds = new Set<string>();

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Omit<TitleDoc, 'id'>;
          const id = docSnap.id;
          currentIds.add(id);
          nextTitles[id] = { ...data, id };

          // Subscribe to seasons & progress for each title if not already subscribed
          const seasonsKey = `seasons_${id}`;
          if (!subUnsubscribers.has(seasonsKey)) {
            const sPath = `users/${uid}/titles/${id}/seasons`;
            const unsubS = onSnapshot(
              collection(db, sPath),
              (sSnap) => {
                const sList: SeasonDoc[] = [];
                sSnap.forEach((sDoc) => {
                  sList.push(sDoc.data() as SeasonDoc);
                });
                sList.sort((a, b) => a.seasonNumber - b.seasonNumber);
                setSeasonsByTitle((prev) => ({ ...prev, [id]: sList }));
              },
              (err) => handleFirestoreError(err, OperationType.LIST, sPath)
            );
            subUnsubscribers.set(seasonsKey, unsubS);
          }

          const progressKey = `progress_${id}`;
          if (!subUnsubscribers.has(progressKey)) {
            const pPath = `users/${uid}/titles/${id}/progress`;
            const unsubP = onSnapshot(
              collection(db, pPath),
              (pSnap) => {
                const pMap: Record<string, ProgressDoc> = {};
                pSnap.forEach((pDoc) => {
                  const pData = pDoc.data() as Omit<ProgressDoc, 'playthroughId'>;
                  pMap[pDoc.id] = {
                    playthroughId: pDoc.id,
                    watched: pData.watched || {},
                    ...(pData.movieWatchedAt ? { movieWatchedAt: pData.movieWatchedAt } : {}),
                  };
                });
                setProgressByTitle((prev) => ({ ...prev, [id]: pMap }));
              },
              (err) => handleFirestoreError(err, OperationType.LIST, pPath)
            );
            subUnsubscribers.set(progressKey, unsubP);
          }
        });

        // Clean up removed title listeners
        for (const [key, unsubFn] of subUnsubscribers.entries()) {
          if (key.startsWith('seasons_') || key.startsWith('progress_')) {
            const tId = key.replace(/^(seasons_|progress_)/, '');
            if (!currentIds.has(tId)) {
              unsubFn();
              subUnsubscribers.delete(key);
            }
          }
        }

        setTitles(nextTitles);
        setLoadingData(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, titlesPath)
    );

    const unsubLists = onSnapshot(
      collection(db, listsPath),
      (snapshot) => {
        const nextLists: Record<string, WatchListDoc> = {};
        const currentListIds = new Set<string>();

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Omit<WatchListDoc, 'id'>;
          const id = docSnap.id;
          currentListIds.add(id);
          nextLists[id] = { ...data, id };

          const entriesKey = `entries_${id}`;
          if (!subUnsubscribers.has(entriesKey)) {
            const ePath = `users/${uid}/lists/${id}/entries`;
            const unsubE = onSnapshot(
              collection(db, ePath),
              (eSnap) => {
                const eList: ListEntryDoc[] = [];
                eSnap.forEach((eDoc) => {
                  const eData = eDoc.data() as Omit<ListEntryDoc, 'id'>;
                  eList.push({ ...eData, id: eDoc.id });
                });
                eList.sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
                setEntriesByList((prev) => ({ ...prev, [id]: eList }));
              },
              (err) => handleFirestoreError(err, OperationType.LIST, ePath)
            );
            subUnsubscribers.set(entriesKey, unsubE);
          }
        });

        for (const [key, unsubFn] of subUnsubscribers.entries()) {
          if (key.startsWith('entries_')) {
            const lId = key.replace(/^entries_/, '');
            if (!currentListIds.has(lId)) {
              unsubFn();
              subUnsubscribers.delete(key);
            }
          }
        }

        setLists(nextLists);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, listsPath)
    );

    const unsubSettings = onSnapshot(
      doc(db, settingsPath),
      (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as AppSettingsDoc);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, settingsPath)
    );

    return () => {
      unsubTitles();
      unsubLists();
      unsubSettings();
      for (const unsubFn of subUnsubscribers.values()) {
        unsubFn();
      }
      subUnsubscribers.clear();
    };
  }, [authReady, user]);

  const signIn = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const enterDemoMode = useCallback(() => {
    setIsDemoMode(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('zhenji_use_demo', 'true');
    }
  }, []);

  const signOut = useCallback(async () => {
    if (user) {
      await firebaseSignOut(auth);
    }
    setIsDemoMode(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('zhenji_use_demo', 'false');
    }
  }, [user]);

  const getActiveProgress = useCallback(
    (title: TitleDoc): ProgressDoc => {
      const pMap = progressByTitle[title.id] || {};
      return (
        pMap[title.activePlaythroughId] || {
          playthroughId: title.activePlaythroughId,
          watched: {},
        }
      );
    },
    [progressByTitle]
  );

  const persistTitleAndProgress = useCallback(
    async (
      updatedTitle: TitleDoc,
      updatedProgress: ProgressDoc,
      updatedSeasons?: SeasonDoc[]
    ) => {
      // Optimistic state update
      setTitles((prev) => ({ ...prev, [updatedTitle.id]: updatedTitle }));
      setProgressByTitle((prev) => ({
        ...prev,
        [updatedTitle.id]: {
          ...(prev[updatedTitle.id] || {}),
          [updatedProgress.playthroughId]: updatedProgress,
        },
      }));
      if (updatedSeasons) {
        setSeasonsByTitle((prev) => ({ ...prev, [updatedTitle.id]: updatedSeasons }));
      }

      if (!user) return;

      const uid = user.uid;
      const titlePath = `users/${uid}/titles/${updatedTitle.id}`;
      const progressPath = `users/${uid}/titles/${updatedTitle.id}/progress/${updatedProgress.playthroughId}`;

      try {
        const batch = writeBatch(db);
        const { id: _id, ...titlePayload } = sanitizeForFirestore(updatedTitle);
        batch.set(doc(db, titlePath), titlePayload);

        const { playthroughId: _pid, ...progressPayload } = sanitizeForFirestore(updatedProgress);
        batch.set(doc(db, progressPath), progressPayload);

        if (updatedSeasons) {
          for (const season of updatedSeasons) {
            const sPath = `users/${uid}/titles/${updatedTitle.id}/seasons/s_${season.seasonNumber}`;
            batch.set(doc(db, sPath), sanitizeForFirestore(season));
          }
        }

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, titlePath);
      }
    },
    [user]
  );

  const addTitleFromTmdb = useCallback(
    async (
      mediaType: 'movie' | 'tv',
      sourceId: string,
      targetListId?: string
    ): Promise<TitleDoc> => {
      const existingId = `tmdb_${mediaType}_${sourceId}`;
      let titleDoc = titles[existingId];

      if (!titleDoc) {
        let fetchedTitle: TitleDoc | null = null;
        let fetchedSeasons: SeasonDoc[] = [];

        try {
          const res = await fetch(`/api/tmdb/${mediaType}/${sourceId}`, {
            headers: { Accept: 'application/json' },
          });
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const data = (await res.json()) as { title: TitleDoc; seasons: SeasonDoc[] };
            fetchedTitle = data.title;
            fetchedSeasons = data.seasons || [];
          }
        } catch {
          // Fall back to local SEED_CATALOG below if needed
        }

        if (!fetchedTitle) {
          const seedMatch = SEED_CATALOG.find(
            (c) => c.mediaType === mediaType && c.tmdbId === sourceId
          );
          if (!seedMatch) {
            throw new Error('获取影视详情失败');
          }
          const now = Date.now();
          fetchedTitle = {
            ...structuredClone(seedMatch.title),
            resume: null,
            manualState: null,
            playthroughs: [{ id: 'p1', number: 1, startedAt: now }],
            activePlaythroughId: 'p1',
            metaFetchedAt: now,
            addedAt: now,
            updatedAt: now,
            lastActivityAt: now,
          };
          fetchedSeasons = structuredClone(seedMatch.seasons);
        }

        titleDoc = fetchedTitle;
        const initialProgress: ProgressDoc = {
          playthroughId: titleDoc.activePlaythroughId,
          watched: {},
        };
        await persistTitleAndProgress(titleDoc, initialProgress, fetchedSeasons);
      }

      if (targetListId && lists[targetListId]) {
        const currentEntries = entriesByList[targetListId] || [];
        if (!currentEntries.some((e) => e.titleId === titleDoc.id)) {
          const rank = getNextRank(currentEntries.map((e) => e.rank));
          const now = Date.now();
          const newEntry: ListEntryDoc = {
            id: `entry_${now}`,
            titleId: titleDoc.id,
            rank,
            addedAt: now,
          };
          setEntriesByList((prev) => ({
            ...prev,
            [targetListId]: [...(prev[targetListId] || []), newEntry],
          }));

          if (user) {
            const entryPath = `users/${user.uid}/lists/${targetListId}/entries/${newEntry.id}`;
            try {
              const { id: _id, ...payload } = sanitizeForFirestore(newEntry);
              await setDoc(doc(db, entryPath), payload);
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, entryPath);
            }
          }
        }
      }

      return titleDoc;
    },
    [titles, lists, entriesByList, persistTitleAndProgress, user]
  );

  const refreshTitleMetadata = useCallback(
    async (titleId: string) => {
      const current = titles[titleId];
      if (!current || current.source !== 'tmdb' || !current.sourceId) return;
      if (current.mediaType !== 'movie' && current.mediaType !== 'tv') return;

      try {
        const res = await fetch(`/api/tmdb/${current.mediaType}/${current.sourceId}`, {
          headers: { Accept: 'application/json' },
        });
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) return;
        const data = (await res.json()) as { title: TitleDoc; seasons: SeasonDoc[] };
        const now = Date.now();
        const mergedTitle: TitleDoc = {
          ...current,
          names: {
            ...data.title.names,
            zh:
              data.title.names.zh && data.title.names.zh !== data.title.names.original
                ? data.title.names.zh
                : current.names.zh || data.title.names.zh,
            ...(current.names.custom ? { custom: current.names.custom } : {}),
          },
          year: data.title.year ?? current.year,
          runtimeMin: data.title.runtimeMin ?? current.runtimeMin,
          genres: data.title.genres.length > 0 ? data.title.genres : current.genres,
          posterPath: data.title.posterPath || current.posterPath,
          backdropPath: data.title.backdropPath || current.backdropPath,
          overview: {
            zh: data.title.overview.zh || current.overview.zh,
            en: data.title.overview.en || current.overview.en,
          },
          showStatus: data.title.showStatus || current.showStatus,
          metaFetchedAt: now,
          updatedAt: now,
        };
        const activeProgress = getActiveProgress(current);
        await persistTitleAndProgress(mergedTitle, activeProgress, data.seasons);
      } catch {
        // Ignore silent background metadata refresh failure
      }
    },
    [titles, getActiveProgress, persistTitleAndProgress]
  );

  const removeTitle = useCallback(
    async (titleId: string) => {
      setTitles((prev) => {
        const copy = { ...prev };
        delete copy[titleId];
        return copy;
      });
      setSeasonsByTitle((prev) => {
        const copy = { ...prev };
        delete copy[titleId];
        return copy;
      });
      setProgressByTitle((prev) => {
        const copy = { ...prev };
        delete copy[titleId];
        return copy;
      });

      if (user) {
        const path = `users/${user.uid}/titles/${titleId}`;
        try {
          await deleteDoc(doc(db, path));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, path);
        }
      }
    },
    [user]
  );

  const toggleEpisode = useCallback(
    async (titleId: string, episodeKey: string) => {
      const title = titles[titleId];
      if (!title) return;
      const seasons = seasonsByTitle[titleId] || [];
      const activeProgress = getActiveProgress(title);
      const now = Date.now();

      const res = toggleEpisodeWatched(title, seasons, activeProgress, episodeKey, {
        includeSpecials: settings.includeSpecials,
        now,
      });

      const updatedTitle: TitleDoc = {
        ...title,
        manualState: res.manualState,
        resume: res.resume,
        playthroughs: res.playthroughs,
        activePlaythroughId: res.activePlaythroughId,
        updatedAt: now,
        lastActivityAt: now,
      };

      await persistTitleAndProgress(updatedTitle, res.progress);
    },
    [titles, seasonsByTitle, getActiveProgress, settings.includeSpecials, persistTitleAndProgress]
  );

  const toggleSeason = useCallback(
    async (titleId: string, seasonNumber: number, markWatched: boolean) => {
      const title = titles[titleId];
      if (!title) return;
      const seasons = seasonsByTitle[titleId] || [];
      const activeProgress = getActiveProgress(title);
      const now = Date.now();

      const res = setSeasonWatched(
        title,
        seasons,
        activeProgress,
        seasonNumber,
        markWatched,
        {
          includeSpecials: settings.includeSpecials,
          now,
        }
      );

      const updatedTitle: TitleDoc = {
        ...title,
        manualState: res.manualState,
        resume: res.resume,
        playthroughs: res.playthroughs,
        activePlaythroughId: res.activePlaythroughId,
        updatedAt: now,
        lastActivityAt: now,
      };

      await persistTitleAndProgress(updatedTitle, res.progress);
    },
    [titles, seasonsByTitle, getActiveProgress, settings.includeSpecials, persistTitleAndProgress]
  );

  const markUpTo = useCallback(
    async (titleId: string, episodeKey: string) => {
      const title = titles[titleId];
      if (!title) return;
      const seasons = seasonsByTitle[titleId] || [];
      const activeProgress = getActiveProgress(title);
      const now = Date.now();

      const res = markUpToEpisode(title, seasons, activeProgress, episodeKey, {
        includeSpecials: settings.includeSpecials,
        now,
      });

      const updatedTitle: TitleDoc = {
        ...title,
        manualState: res.manualState,
        resume: res.resume,
        playthroughs: res.playthroughs,
        activePlaythroughId: res.activePlaythroughId,
        updatedAt: now,
        lastActivityAt: now,
      };

      await persistTitleAndProgress(updatedTitle, res.progress);
    },
    [titles, seasonsByTitle, getActiveProgress, settings.includeSpecials, persistTitleAndProgress]
  );

  const markWholeTitle = useCallback(
    async (titleId: string, markWatched: boolean) => {
      const title = titles[titleId];
      if (!title) return;
      const seasons = seasonsByTitle[titleId] || [];
      const activeProgress = getActiveProgress(title);
      const now = Date.now();

      const res = markWholeTitleWatched(title, seasons, activeProgress, markWatched, {
        includeSpecials: settings.includeSpecials,
        now,
      });

      const updatedTitle: TitleDoc = {
        ...title,
        manualState: res.manualState,
        resume: res.resume,
        playthroughs: res.playthroughs,
        activePlaythroughId: res.activePlaythroughId,
        updatedAt: now,
        lastActivityAt: now,
      };

      await persistTitleAndProgress(updatedTitle, res.progress);
    },
    [titles, seasonsByTitle, getActiveProgress, settings.includeSpecials, persistTitleAndProgress]
  );

  const saveResume = useCallback(
    async (
      titleId: string,
      resume: { episodeKey: string | null; seconds: number } | null
    ) => {
      const title = titles[titleId];
      if (!title) return;
      const now = Date.now();
      const res = setResumePoint(title, resume, now);
      const updatedTitle: TitleDoc = {
        ...title,
        manualState: res.manualState,
        resume: res.resume,
        updatedAt: now,
        lastActivityAt: now,
      };
      const activeProgress = getActiveProgress(title);
      await persistTitleAndProgress(updatedTitle, activeProgress);
    },
    [titles, getActiveProgress, persistTitleAndProgress]
  );

  const startTitleRewatch = useCallback(
    async (titleId: string) => {
      const title = titles[titleId];
      if (!title) return;
      const seasons = seasonsByTitle[titleId] || [];
      const activeProgress = getActiveProgress(title);
      const now = Date.now();

      const res = startRewatch(title, seasons, activeProgress, {
        includeSpecials: settings.includeSpecials,
        now,
      });

      const updatedTitle: TitleDoc = {
        ...title,
        manualState: res.manualState,
        resume: res.resume,
        playthroughs: res.playthroughs,
        activePlaythroughId: res.activePlaythroughId,
        updatedAt: now,
        lastActivityAt: now,
      };

      await persistTitleAndProgress(updatedTitle, res.progress);
    },
    [titles, seasonsByTitle, getActiveProgress, settings.includeSpecials, persistTitleAndProgress]
  );

  const cancelTitleRewatch = useCallback(
    async (titleId: string) => {
      const title = titles[titleId];
      if (!title || title.playthroughs.length <= 1) return;
      const now = Date.now();
      const res = cancelRewatch(title, progressByTitle[titleId] || {});
      if (!res.removedPlaythroughId) return;

      const updatedTitle: TitleDoc = {
        ...title,
        manualState: res.manualState,
        resume: res.resume,
        playthroughs: res.playthroughs,
        activePlaythroughId: res.activePlaythroughId,
        updatedAt: now,
        lastActivityAt: now,
      };

      setTitles((prev) => ({ ...prev, [titleId]: updatedTitle }));
      setProgressByTitle((prev) => {
        const copy = { ...(prev[titleId] || {}) };
        delete copy[res.removedPlaythroughId];
        return { ...prev, [titleId]: copy };
      });

      if (user) {
        const uid = user.uid;
        const titlePath = `users/${uid}/titles/${titleId}`;
        const removedProgressPath = `users/${uid}/titles/${titleId}/progress/${res.removedPlaythroughId}`;
        try {
          const batch = writeBatch(db);
          const { id: _id, ...titlePayload } = sanitizeForFirestore(updatedTitle);
          batch.set(doc(db, titlePath), titlePayload);
          batch.delete(doc(db, removedProgressPath));
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, titlePath);
        }
      }
    },
    [titles, progressByTitle, user]
  );

  const setTitleManualState = useCallback(
    async (titleId: string, manualState: ManualState) => {
      const title = titles[titleId];
      if (!title) return;
      const now = Date.now();
      const updatedTitle: TitleDoc = {
        ...title,
        manualState,
        updatedAt: now,
        lastActivityAt: now,
      };
      const activeProgress = getActiveProgress(title);
      await persistTitleAndProgress(updatedTitle, activeProgress);
    },
    [titles, getActiveProgress, persistTitleAndProgress]
  );

  const updateTitleLanguage = useCallback(
    async (titleId: string, displayLang: DisplayLang | null, customName?: string) => {
      const title = titles[titleId];
      if (!title) return;
      const now = Date.now();
      const trimmedCustom = customName?.trim();
      const updatedNames = { ...title.names };
      if (trimmedCustom) {
        updatedNames.custom = trimmedCustom;
      } else if (customName !== undefined) {
        delete updatedNames.custom;
      }

      const updatedTitle: TitleDoc = {
        ...title,
        names: updatedNames,
        displayLang,
        updatedAt: now,
      };
      const activeProgress = getActiveProgress(title);
      await persistTitleAndProgress(updatedTitle, activeProgress);
    },
    [titles, getActiveProgress, persistTitleAndProgress]
  );

  const fetchAndCacheTitleRatings = useCallback(
    async (titleId: string) => {
      const current = titles[titleId];
      if (!current) return;

      const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;
      const now = Date.now();
      if (current.ratings?.fetchedAt && now - current.ratings.fetchedAt < SEVEN_DAYS_MS) {
        return;
      }

      const imdbId = current.externalIds?.imdb || '';
      const doubanId = current.externalIds?.douban || '';
      const titleQuery = current.names.zh || current.names.original || '';
      const params = new URLSearchParams();
      if (imdbId) params.set('imdbId', imdbId);
      if (titleQuery) params.set('title', titleQuery);
      if (current.year) params.set('year', String(current.year));
      if (doubanId) params.set('doubanId', doubanId);

      try {
        const res = await fetch(`/api/ratings?${params.toString()}`, {
          headers: { Accept: 'application/json' },
        });
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) return;

        const data = (await res.json()) as {
          ratings?: Ratings;
          externalIds?: { douban?: string };
        };

        const mergedRatings: Ratings = {
          ...current.ratings,
          ...(data.ratings?.imdb ? { imdb: data.ratings.imdb } : {}),
          ...(data.ratings?.imdbVotes ? { imdbVotes: data.ratings.imdbVotes } : {}),
          ...(data.ratings?.rottenTomatoes ? { rottenTomatoes: data.ratings.rottenTomatoes } : {}),
          ...(data.ratings?.metacritic ? { metacritic: data.ratings.metacritic } : {}),
          // Keep manual Douban score if automatic lookup didn't find one
          ...(data.ratings?.douban
            ? { douban: data.ratings.douban }
            : current.ratings?.douban
              ? { douban: current.ratings.douban }
              : {}),
          fetchedAt: now,
        };

        const mergedExternalIds = {
          ...current.externalIds,
          ...(data.externalIds?.douban && !current.externalIds?.douban
            ? { douban: data.externalIds.douban }
            : {}),
        };

        const updatedTitle: TitleDoc = {
          ...current,
          ratings: mergedRatings,
          externalIds: mergedExternalIds,
          updatedAt: now,
        };
        const activeProgress = getActiveProgress(current);
        await persistTitleAndProgress(updatedTitle, activeProgress);
      } catch {
        // Silently ignore ratings fetch error
      }
    },
    [titles, getActiveProgress, persistTitleAndProgress]
  );

  const createCustomOrLinkTitle = useCallback(
    async (input: CustomTitleInput): Promise<TitleDoc> => {
      const now = Date.now();
      const id = `${input.source}_${now}`;
      const trimmedName = input.name.trim() || '未命名作品';
      const trimmedOrig = input.originalName?.trim() || trimmedName;
      const epCount =
        input.episodeCount && input.episodeCount > 0
          ? Math.min(2000, Math.floor(input.episodeCount))
          : 0;

      const rawPoster = input.posterPath ?? input.posterUrl;
      const posterUrl = rawPoster?.trim() ? rawPoster.trim().slice(0, 500) : null;
      const rawSource = input.sourceUrl ?? input.sourceId;
      const sourceId = rawSource?.trim() ? rawSource.trim().slice(0, 128) : null;

      let doubanField = input.doubanUrl?.trim() || undefined;
      if (doubanField && doubanField.includes('douban.com/subject/')) {
        const m = doubanField.match(/subject\/(\d+)/);
        if (m) doubanField = m[1];
      }

      const newTitle: TitleDoc = {
        id,
        source: input.source,
        sourceId,
        mediaType: input.mediaType,
        names: {
          original: trimmedOrig,
          zh: trimmedName,
          en: trimmedOrig,
        },
        displayLang: null,
        year: input.year || null,
        runtimeMin: input.runtimeMin || null,
        genres: [],
        posterPath: posterUrl,
        backdropPath: posterUrl,
        overview: {
          zh: input.overview?.trim() || '',
        },
        showStatus: 'Ended',
        externalIds: {
          ...(doubanField ? { douban: doubanField } : {}),
        },
        ratings: {
          ...(input.doubanScore?.trim() ? { douban: input.doubanScore.trim() } : {}),
        },
        manualState: null,
        playthroughs: [{ id: 'p1', number: 1, startedAt: now }],
        activePlaythroughId: 'p1',
        resume: null,
        metaFetchedAt: now,
        addedAt: now,
        updatedAt: now,
        lastActivityAt: now,
      };

      const seasons: SeasonDoc[] = [];
      if (epCount > 0) {
        const episodes: EpisodeMeta[] = Array.from({ length: epCount }, (_, idx) => {
          const epNum = idx + 1;
          return {
            number: epNum,
            key: makeEpisodeKey(1, epNum),
            name: `第 ${epNum} 集`,
            airDate: '2020-01-01',
            runtime: input.runtimeMin || null,
            stillPath: null,
            overview: {},
          };
        });
        seasons.push({
          seasonNumber: 1,
          name: '第 1 季',
          episodes,
        });
      }

      const initialProgress: ProgressDoc = {
        playthroughId: 'p1',
        watched: {},
      };

      await persistTitleAndProgress(newTitle, initialProgress, seasons);

      if (input.targetListId && lists[input.targetListId]) {
        const listId = input.targetListId;
        const currentEntries = entriesByList[listId] || [];
        if (!currentEntries.some((e) => e.titleId === newTitle.id)) {
          const rank = getNextRank(currentEntries.map((e) => e.rank));
          const newEntry: ListEntryDoc = {
            id: `entry_${now}`,
            titleId: newTitle.id,
            rank,
            addedAt: now,
          };
          setEntriesByList((prev) => ({
            ...prev,
            [listId]: [...(prev[listId] || []), newEntry],
          }));
          if (user) {
            const entryPath = `users/${user.uid}/lists/${listId}/entries/${newEntry.id}`;
            try {
              const { id: _id, ...payload } = sanitizeForFirestore(newEntry);
              await setDoc(doc(db, entryPath), payload);
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, entryPath);
            }
          }
        }
      }

      return newTitle;
    },
    [persistTitleAndProgress, lists, entriesByList, user]
  );

  const updateTitleDetails = useCallback(
    async (titleId: string, input: UpdateTitleDetailsInput) => {
      const current = titles[titleId];
      if (!current) return;
      const now = Date.now();

      const nextZh = input.name !== undefined ? input.name.trim() || current.names.zh : current.names.zh;
      const nextOrig =
        input.originalName !== undefined
          ? input.originalName.trim() || nextZh || current.names.original
          : current.names.original;

      const posterUrl =
        input.posterPath !== undefined
          ? input.posterPath?.trim()
            ? input.posterPath.trim().slice(0, 500)
            : null
          : current.posterPath;

      let doubanField =
        input.doubanUrl !== undefined ? input.doubanUrl.trim() : current.externalIds?.douban;
      if (doubanField && doubanField.includes('douban.com/subject/')) {
        const m = doubanField.match(/subject\/(\d+)/);
        if (m) doubanField = m[1];
      }

      const nextExternalIds = { ...current.externalIds };
      if (doubanField) {
        nextExternalIds.douban = doubanField;
      } else if (input.doubanUrl !== undefined) {
        delete nextExternalIds.douban;
      }

      const nextRatings = { ...current.ratings };
      if (input.doubanScore !== undefined) {
        const s = input.doubanScore.trim();
        if (s) {
          nextRatings.douban = s;
        } else {
          delete nextRatings.douban;
        }
      }

      const updatedTitle: TitleDoc = {
        ...current,
        mediaType: input.mediaType ?? current.mediaType,
        names: {
          ...current.names,
          original: nextOrig,
          zh: nextZh,
        },
        year: input.year !== undefined ? input.year : current.year,
        runtimeMin: input.runtimeMin !== undefined ? input.runtimeMin : current.runtimeMin,
        posterPath: posterUrl,
        backdropPath:
          current.source !== 'tmdb' ? posterUrl || current.backdropPath : current.backdropPath,
        overview: {
          ...current.overview,
          ...(input.overview !== undefined ? { zh: input.overview.trim() } : {}),
        },
        externalIds: nextExternalIds,
        ratings: nextRatings,
        updatedAt: now,
        lastActivityAt: now,
      };

      let updatedSeasons: SeasonDoc[] | undefined = undefined;
      if (
        (current.source === 'custom' || current.source === 'url') &&
        input.episodeCount !== undefined
      ) {
        const epCount =
          input.episodeCount && input.episodeCount > 0
            ? Math.min(2000, Math.floor(input.episodeCount))
            : 0;
        if (epCount > 0) {
          const existingS1 = (seasonsByTitle[titleId] || []).find((s) => s.seasonNumber === 1);
          const episodes: EpisodeMeta[] = Array.from({ length: epCount }, (_, idx) => {
            const epNum = idx + 1;
            const prevEp = existingS1?.episodes.find((e) => e.number === epNum);
            return (
              prevEp || {
                number: epNum,
                key: makeEpisodeKey(1, epNum),
                name: `第 ${epNum} 集`,
                airDate: '2020-01-01',
                runtime: updatedTitle.runtimeMin || null,
                stillPath: null,
                overview: {},
              }
            );
          });
          updatedSeasons = [
            {
              seasonNumber: 1,
              name: '第 1 季',
              episodes,
            },
          ];
        } else {
          updatedSeasons = [];
        }
      }

      const activeProgress = getActiveProgress(current);
      await persistTitleAndProgress(updatedTitle, activeProgress, updatedSeasons);
    },
    [titles, seasonsByTitle, getActiveProgress, persistTitleAndProgress]
  );

  const updateSettings = useCallback(
    async (partial: Partial<AppSettingsDoc>) => {
      const nextSettings: AppSettingsDoc = {
        ...settings,
        ...partial,
      };
      setSettings(nextSettings);

      if (user) {
        const settingsPath = `users/${user.uid}/settings/app`;
        try {
          await setDoc(doc(db, settingsPath), sanitizeForFirestore(nextSettings));
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, settingsPath);
        }
      }
    },
    [settings, user]
  );

  const exportAllDataJson = useCallback((): string => {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        version: 1,
        settings,
        titles,
        seasonsByTitle,
        progressByTitle,
        lists,
        entriesByList,
      },
      null,
      2
    );
  }, [settings, titles, seasonsByTitle, progressByTitle, lists, entriesByList]);

  const createList = useCallback(
    async (input: {
      name: string;
      kind: ListKind;
      description?: string;
      pinned?: boolean;
    }): Promise<WatchListDoc> => {
      const now = Date.now();
      const existingRanks = Object.values(lists).map((l) => l.rank);
      const rank = getNextRank(existingRanks);
      const newList: WatchListDoc = {
        id: `list_${now}`,
        name: input.name.trim(),
        kind: input.kind,
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        pinned: Boolean(input.pinned),
        rank,
        collectionSort: input.kind === 'ordered' ? 'manual' : 'added',
        createdAt: now,
      };

      setLists((prev) => ({ ...prev, [newList.id]: newList }));
      setEntriesByList((prev) => ({ ...prev, [newList.id]: [] }));

      if (user) {
        const listPath = `users/${user.uid}/lists/${newList.id}`;
        try {
          const { id: _id, ...payload } = sanitizeForFirestore(newList);
          await setDoc(doc(db, listPath), payload);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, listPath);
        }
      }

      return newList;
    },
    [lists, user]
  );

  const deleteList = useCallback(
    async (listId: string) => {
      setLists((prev) => {
        const copy = { ...prev };
        delete copy[listId];
        return copy;
      });
      setEntriesByList((prev) => {
        const copy = { ...prev };
        delete copy[listId];
        return copy;
      });

      if (user) {
        const listPath = `users/${user.uid}/lists/${listId}`;
        try {
          await deleteDoc(doc(db, listPath));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, listPath);
        }
      }
    },
    [user]
  );

  const togglePinList = useCallback(
    async (listId: string) => {
      const list = lists[listId];
      if (!list) return;
      const updated: WatchListDoc = {
        ...list,
        pinned: !list.pinned,
      };
      setLists((prev) => ({ ...prev, [listId]: updated }));

      if (user) {
        const listPath = `users/${user.uid}/lists/${listId}`;
        try {
          const { id: _id, ...payload } = sanitizeForFirestore(updated);
          await setDoc(doc(db, listPath), payload);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, listPath);
        }
      }
    },
    [lists, user]
  );

  const updateCollectionSort = useCallback(
    async (listId: string, sort: CollectionSort) => {
      const list = lists[listId];
      if (!list) return;
      const updated: WatchListDoc = {
        ...list,
        collectionSort: sort,
      };
      setLists((prev) => ({ ...prev, [listId]: updated }));

      if (user) {
        const listPath = `users/${user.uid}/lists/${listId}`;
        try {
          const { id: _id, ...payload } = sanitizeForFirestore(updated);
          await setDoc(doc(db, listPath), payload);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, listPath);
        }
      }
    },
    [lists, user]
  );

  const addTitleToList = useCallback(
    async (listId: string, titleId: string) => {
      const currentEntries = entriesByList[listId] || [];
      if (currentEntries.some((e) => e.titleId === titleId)) return;

      const rank = getNextRank(currentEntries.map((e) => e.rank));
      const now = Date.now();
      const newEntry: ListEntryDoc = {
        id: `entry_${now}`,
        titleId,
        rank,
        addedAt: now,
      };

      setEntriesByList((prev) => ({
        ...prev,
        [listId]: [...(prev[listId] || []), newEntry],
      }));

      if (user) {
        const entryPath = `users/${user.uid}/lists/${listId}/entries/${newEntry.id}`;
        try {
          const { id: _id, ...payload } = sanitizeForFirestore(newEntry);
          await setDoc(doc(db, entryPath), payload);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, entryPath);
        }
      }
    },
    [entriesByList, user]
  );

  const removeEntryFromList = useCallback(
    async (listId: string, entryId: string) => {
      setEntriesByList((prev) => ({
        ...prev,
        [listId]: (prev[listId] || []).filter((e) => e.id !== entryId),
      }));

      if (user) {
        const entryPath = `users/${user.uid}/lists/${listId}/entries/${entryId}`;
        try {
          await deleteDoc(doc(db, entryPath));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, entryPath);
        }
      }
    },
    [user]
  );

  const reorderListEntry = useCallback(
    async (listId: string, activeEntryId: string, overEntryId: string) => {
      if (activeEntryId === overEntryId) return;
      const list = lists[listId];
      if (!list) return;

      const rawEntries = entriesByList[listId] || [];
      const hydrated = rawEntries
        .map((entry) => ({ entry, title: titles[entry.titleId] }))
        .filter((item): item is { entry: ListEntryDoc; title: TitleDoc } => Boolean(item.title));

      const sorted = sortListEntries(hydrated, list.kind, 'manual', settings.defaultTitleLang).map(
        (h) => h.entry
      );

      const activeIdx = sorted.findIndex((e) => e.id === activeEntryId);
      const overIdx = sorted.findIndex((e) => e.id === overEntryId);
      if (activeIdx === -1 || overIdx === -1) return;

      const newRank = computeMovedRank(sorted, activeIdx, overIdx);
      if (!newRank) return;

      const updatedEntry: ListEntryDoc = {
        ...sorted[activeIdx],
        rank: newRank,
      };

      setEntriesByList((prev) => {
        const next = (prev[listId] || [])
          .map((e) => (e.id === activeEntryId ? updatedEntry : e))
          .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
        return { ...prev, [listId]: next };
      });

      // Single document write thanks to fractional-indexing!
      if (user) {
        const entryPath = `users/${user.uid}/lists/${listId}/entries/${updatedEntry.id}`;
        try {
          const { id: _id, ...payload } = sanitizeForFirestore(updatedEntry);
          await setDoc(doc(db, entryPath), payload);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, entryPath);
        }
      }
    },
    [lists, entriesByList, titles, settings.defaultTitleLang, user]
  );

  const seedDemoLibrary = useCallback(async () => {
    const demo = buildInitialDemoDataset();
    setTitles(demo.titles);
    setSeasonsByTitle(demo.seasonsByTitle);
    setProgressByTitle(demo.progressByTitle);
    setLists(demo.lists);
    setEntriesByList(demo.entriesByList);

    if (user) {
      const uid = user.uid;
      try {
        const batch = writeBatch(db);
        for (const t of Object.values(demo.titles)) {
          const { id: _id, ...tPayload } = sanitizeForFirestore(t);
          batch.set(doc(db, `users/${uid}/titles/${t.id}`), tPayload);
          const seasons = demo.seasonsByTitle[t.id] || [];
          for (const s of seasons) {
            batch.set(
              doc(db, `users/${uid}/titles/${t.id}/seasons/s_${s.seasonNumber}`),
              sanitizeForFirestore(s)
            );
          }
          const pMap = demo.progressByTitle[t.id] || {};
          for (const p of Object.values(pMap)) {
            const { playthroughId: _pid, ...pPayload } = sanitizeForFirestore(p);
            batch.set(
              doc(db, `users/${uid}/titles/${t.id}/progress/${p.playthroughId}`),
              pPayload
            );
          }
        }
        for (const l of Object.values(demo.lists)) {
          const { id: _id, ...lPayload } = sanitizeForFirestore(l);
          batch.set(doc(db, `users/${uid}/lists/${l.id}`), lPayload);
          const entries = demo.entriesByList[l.id] || [];
          for (const e of entries) {
            const { id: _eid, ...ePayload } = sanitizeForFirestore(e);
            batch.set(doc(db, `users/${uid}/lists/${l.id}/entries/${e.id}`), ePayload);
          }
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
      }
    }
  }, [user]);

  const value = useMemo<TrackerContextValue>(
    () => ({
      user,
      authReady,
      isDemoMode,
      loadingData,
      titles,
      seasonsByTitle,
      progressByTitle,
      lists,
      entriesByList,
      settings,
      signIn,
      enterDemoMode,
      signOut,
      getActiveProgress,
      addTitleFromTmdb,
      createCustomOrLinkTitle,
      updateTitleDetails,
      updateTitleLanguage,
      setTitleManualState,
      fetchAndCacheTitleRatings,
      refreshTitleMetadata,
      removeTitle,
      toggleEpisode,
      toggleSeason,
      markUpTo,
      markWholeTitle,
      saveResume,
      startTitleRewatch,
      cancelTitleRewatch,
      createList,
      deleteList,
      togglePinList,
      updateCollectionSort,
      addTitleToList,
      removeEntryFromList,
      reorderListEntry,
      updateSettings,
      exportAllDataJson,
      seedDemoLibrary,
    }),
    [
      user,
      authReady,
      isDemoMode,
      loadingData,
      titles,
      seasonsByTitle,
      progressByTitle,
      lists,
      entriesByList,
      settings,
      signIn,
      enterDemoMode,
      signOut,
      getActiveProgress,
      addTitleFromTmdb,
      createCustomOrLinkTitle,
      updateTitleDetails,
      updateTitleLanguage,
      setTitleManualState,
      fetchAndCacheTitleRatings,
      refreshTitleMetadata,
      removeTitle,
      toggleEpisode,
      toggleSeason,
      markUpTo,
      markWholeTitle,
      saveResume,
      startTitleRewatch,
      cancelTitleRewatch,
      createList,
      deleteList,
      togglePinList,
      updateCollectionSort,
      addTitleToList,
      removeEntryFromList,
      reorderListEntry,
      updateSettings,
      exportAllDataJson,
      seedDemoLibrary,
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
