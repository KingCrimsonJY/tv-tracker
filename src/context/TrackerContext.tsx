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
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
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
import { zh } from '../i18n/zh';
import { apiFetch } from '../lib/api';
import {
  auth,
  buildFirestoreErrorInfo,
  db,
  googleProvider,
  OperationType,
} from '../lib/firebase';

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

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandaloneDisplay = window.matchMedia?.('(display-mode: standalone)').matches;
  const isIosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(isStandaloneDisplay || isIosStandalone);
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
  loadingData: boolean;
  toastMessage: string | null;
  showToast: (message: string) => void;
  dismissToast: () => void;
  titles: Record<string, TitleDoc>;
  seasonsByTitle: Record<string, SeasonDoc[]>;
  progressByTitle: Record<string, Record<string, ProgressDoc>>;
  lists: Record<string, WatchListDoc>;
  entriesByList: Record<string, ListEntryDoc[]>;
  settings: AppSettingsDoc;
  signIn: () => Promise<void>;
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
}

const TrackerContext = createContext<TrackerContextValue | null>(null);

export const TrackerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [titles, setTitles] = useState<Record<string, TitleDoc>>({});
  const [seasonsByTitle, setSeasonsByTitle] = useState<Record<string, SeasonDoc[]>>({});
  const [progressByTitle, setProgressByTitle] = useState<
    Record<string, Record<string, ProgressDoc>>
  >({});
  const [lists, setLists] = useState<Record<string, WatchListDoc>>({});
  const [entriesByList, setEntriesByList] = useState<Record<string, ListEntryDoc[]>>({});
  const [settings, setSettings] = useState<AppSettingsDoc>(DEFAULT_SETTINGS);

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

  // Clean up any legacy localStorage demo keys from earlier versions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('zhenji_demo_state_v3');
        window.localStorage.removeItem('zhenji_use_demo');
      } catch {
        // ignore
      }
    }
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

  // Complete any pending OAuth redirect flow and listen to Firebase Auth state
  useEffect(() => {
    getRedirectResult(auth).catch((err) => {
      console.warn('Redirect sign-in check:', err);
    });

    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setLoadingData(true);
      } else {
        setTitles({});
        setSeasonsByTitle({});
        setProgressByTitle({});
        setLists({});
        setEntriesByList({});
        setSettings(DEFAULT_SETTINGS);
        setLoadingData(false);
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
              (err) => {
                buildFirestoreErrorInfo(err, OperationType.LIST, sPath);
              }
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
              (err) => {
                buildFirestoreErrorInfo(err, OperationType.LIST, pPath);
              }
            );
            subUnsubscribers.set(progressKey, unsubP);
          }
        });

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
      (err) => {
        buildFirestoreErrorInfo(err, OperationType.LIST, titlesPath);
        setLoadingData(false);
        showToast(zh.app.unauthorizedAccountToast);
      }
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
              (err) => {
                buildFirestoreErrorInfo(err, OperationType.LIST, ePath);
              }
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
      (err) => {
        buildFirestoreErrorInfo(err, OperationType.LIST, listsPath);
      }
    );

    const unsubSettings = onSnapshot(
      doc(db, settingsPath),
      (docSnap) => {
        if (docSnap.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...(docSnap.data() as Partial<AppSettingsDoc>) });
        }
      },
      (err) => {
        buildFirestoreErrorInfo(err, OperationType.GET, settingsPath);
      }
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
  }, [authReady, user, showToast]);

  const signIn = useCallback(async () => {
    if (isStandalonePwa()) {
      await signInWithRedirect(auth, googleProvider);
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      showToast(err instanceof Error ? err.message : '登录失败，请重试');
    }
  }, [showToast]);

  const signOut = useCallback(async () => {
    if (user) {
      await firebaseSignOut(auth);
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

  // Used only when creating a brand-new title document + initial progress + seasons
  const createTitleDocumentBatch = useCallback(
    async (newTitle: TitleDoc, initialProgress: ProgressDoc, initialSeasons: SeasonDoc[]) => {
      setTitles((prev) => ({ ...prev, [newTitle.id]: newTitle }));
      setProgressByTitle((prev) => ({
        ...prev,
        [newTitle.id]: {
          ...(prev[newTitle.id] || {}),
          [initialProgress.playthroughId]: initialProgress,
        },
      }));
      setSeasonsByTitle((prev) => ({ ...prev, [newTitle.id]: initialSeasons }));

      if (!user) return;

      const uid = user.uid;
      const titlePath = `users/${uid}/titles/${newTitle.id}`;
      const progressPath = `users/${uid}/titles/${newTitle.id}/progress/${initialProgress.playthroughId}`;

      try {
        const batch = writeBatch(db);
        const { id: _id, ...titlePayload } = sanitizeForFirestore(newTitle);
        batch.set(doc(db, titlePath), titlePayload);

        const { playthroughId: _pid, ...progressPayload } = sanitizeForFirestore(initialProgress);
        batch.set(doc(db, progressPath), progressPayload);

        for (const season of initialSeasons) {
          const sPath = `users/${uid}/titles/${newTitle.id}/seasons/s_${season.seasonNumber}`;
          batch.set(doc(db, sPath), sanitizeForFirestore(season));
        }

        await batch.commit();
      } catch (err) {
        buildFirestoreErrorInfo(err, OperationType.CREATE, titlePath);
        // Roll back creation
        setTitles((prev) => {
          const copy = { ...prev };
          delete copy[newTitle.id];
          return copy;
        });
        setProgressByTitle((prev) => {
          const copy = { ...prev };
          delete copy[newTitle.id];
          return copy;
        });
        setSeasonsByTitle((prev) => {
          const copy = { ...prev };
          delete copy[newTitle.id];
          return copy;
        });
        showToast(zh.app.writeRollbackToast);
      }
    },
    [user, showToast]
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
        const res = await apiFetch(`/api/tmdb/${mediaType}/${sourceId}`, {
          headers: { Accept: 'application/json' },
        });
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          let errMsg = '获取 TMDB 影视详情失败';
          if (contentType.includes('application/json')) {
            const errJson = (await res.json()) as { error?: string };
            if (errJson.error) errMsg = errJson.error;
          }
          showToast(errMsg);
          throw new Error(errMsg);
        }

        const data = (await res.json()) as { title: TitleDoc; seasons: SeasonDoc[] };
        titleDoc = data.title;
        const initialProgress: ProgressDoc = {
          playthroughId: titleDoc.activePlaythroughId,
          watched: {},
        };
        await createTitleDocumentBatch(titleDoc, initialProgress, data.seasons || []);
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
          const prevListEntries = currentEntries;
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
              buildFirestoreErrorInfo(err, OperationType.CREATE, entryPath);
              setEntriesByList((prev) => ({
                ...prev,
                [targetListId]: prevListEntries,
              }));
              showToast(zh.app.writeRollbackToast);
            }
          }
        }
      }

      return titleDoc;
    },
    [titles, lists, entriesByList, createTitleDocumentBatch, user, showToast]
  );

  // Item 3: Metadata refresh must never touch manualState, resume, playthroughs or progress
  const refreshTitleMetadata = useCallback(
    async (titleId: string) => {
      const current = titles[titleId];
      if (!current || current.source !== 'tmdb' || !current.sourceId) return;
      if (current.mediaType !== 'movie' && current.mediaType !== 'tv') return;

      try {
        const res = await apiFetch(`/api/tmdb/${current.mediaType}/${current.sourceId}`, {
          headers: { Accept: 'application/json' },
        });
        const contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) return;
        const data = (await res.json()) as { title: TitleDoc; seasons: SeasonDoc[] };
        const now = Date.now();

        const nextZh =
          data.title.names.zh && data.title.names.zh !== data.title.names.original
            ? data.title.names.zh
            : current.names.zh || data.title.names.zh;
        const nextYear = data.title.year ?? current.year;
        const nextRuntime = data.title.runtimeMin ?? current.runtimeMin;
        const nextGenres = data.title.genres.length > 0 ? data.title.genres : current.genres;
        const nextPoster = data.title.posterPath || current.posterPath;
        const nextBackdrop = data.title.backdropPath || current.backdropPath;
        const nextOverview = {
          zh: data.title.overview.zh || current.overview.zh,
          en: data.title.overview.en || current.overview.en,
        };
        const nextShowStatus = data.title.showStatus || current.showStatus;

        const prevTitle = current;
        const prevSeasons = seasonsByTitle[titleId] || [];

        setTitles((prev) => {
          const latest = prev[titleId];
          if (!latest) return prev;
          return {
            ...prev,
            [titleId]: {
              ...latest,
              names: {
                ...latest.names,
                original: data.title.names.original,
                zh: nextZh,
                en: data.title.names.en,
              },
              year: nextYear,
              runtimeMin: nextRuntime,
              genres: nextGenres,
              posterPath: nextPoster,
              backdropPath: nextBackdrop,
              overview: nextOverview,
              showStatus: nextShowStatus,
              metaFetchedAt: now,
              updatedAt: now,
            },
          };
        });
        setSeasonsByTitle((prev) => ({ ...prev, [titleId]: data.seasons }));

        if (user) {
          const uid = user.uid;
          const titlePath = `users/${uid}/titles/${titleId}`;
          try {
            const batch = writeBatch(db);
            // Field-level update on title doc: never touches manualState, resume, playthroughs, or progress
            batch.update(doc(db, titlePath), {
              'names.original': data.title.names.original,
              'names.zh': nextZh || null,
              'names.en': data.title.names.en || null,
              year: nextYear,
              runtimeMin: nextRuntime,
              genres: nextGenres,
              posterPath: nextPoster,
              backdropPath: nextBackdrop,
              overview: sanitizeForFirestore(nextOverview),
              showStatus: nextShowStatus,
              metaFetchedAt: now,
              updatedAt: now,
            });
            for (const season of data.seasons) {
              const sPath = `users/${uid}/titles/${titleId}/seasons/s_${season.seasonNumber}`;
              batch.set(doc(db, sPath), sanitizeForFirestore(season));
            }
            await batch.commit();
          } catch (err) {
            buildFirestoreErrorInfo(err, OperationType.UPDATE, titlePath);
            setTitles((prev) => ({ ...prev, [titleId]: prevTitle }));
            setSeasonsByTitle((prev) => ({ ...prev, [titleId]: prevSeasons }));
            showToast(zh.app.writeRollbackToast);
          }
        }
      } catch {
        // Ignore silent background metadata fetch network failure
      }
    },
    [titles, seasonsByTitle, user, showToast]
  );

  // Item 4: Deleting a title also deletes its seasons and progress subcollections and removes it from every list, in one batch.
  const removeTitle = useCallback(
    async (titleId: string) => {
      const prevTitle = titles[titleId];
      if (!prevTitle) return;
      const prevSeasons = seasonsByTitle[titleId] || [];
      const prevProgressMap = progressByTitle[titleId] || {};
      const prevEntriesByList: Record<string, ListEntryDoc[]> = {};
      for (const [listId, entries] of Object.entries(entriesByList)) {
        prevEntriesByList[listId] = entries;
      }

      // Optimistic removal from state
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
      setEntriesByList((prev) => {
        const next: Record<string, ListEntryDoc[]> = {};
        for (const [listId, entries] of Object.entries(prev)) {
          next[listId] = entries.filter((e) => e.titleId !== titleId);
        }
        return next;
      });

      if (!user) return;

      const uid = user.uid;
      const titlePath = `users/${uid}/titles/${titleId}`;
      try {
        const batch = writeBatch(db);

        // Collect all season doc IDs (from memory + subcollection query)
        const seasonDocIds = new Set<string>(
          prevSeasons.map((s) => `s_${s.seasonNumber}`)
        );
        try {
          const sSnap = await getDocs(collection(db, `${titlePath}/seasons`));
          sSnap.forEach((d) => seasonDocIds.add(d.id));
        } catch {
          // Use in-memory set if offline
        }
        for (const sDocId of seasonDocIds) {
          batch.delete(doc(db, `${titlePath}/seasons/${sDocId}`));
        }

        // Collect all progress doc IDs (from memory + playthroughs + subcollection query)
        const progressDocIds = new Set<string>([
          ...Object.keys(prevProgressMap),
          ...prevTitle.playthroughs.map((p) => p.id),
        ]);
        try {
          const pSnap = await getDocs(collection(db, `${titlePath}/progress`));
          pSnap.forEach((d) => progressDocIds.add(d.id));
        } catch {
          // Use in-memory set if offline
        }
        for (const pDocId of progressDocIds) {
          batch.delete(doc(db, `${titlePath}/progress/${pDocId}`));
        }

        // Remove matching entries across every list
        for (const [listId, entries] of Object.entries(prevEntriesByList)) {
          for (const entry of entries) {
            if (entry.titleId === titleId) {
              batch.delete(doc(db, `users/${uid}/lists/${listId}/entries/${entry.id}`));
            }
          }
        }

        // Delete the title document itself
        batch.delete(doc(db, titlePath));

        await batch.commit();
      } catch (err) {
        buildFirestoreErrorInfo(err, OperationType.DELETE, titlePath);
        // Roll back optimistic delete
        setTitles((prev) => ({ ...prev, [titleId]: prevTitle }));
        setSeasonsByTitle((prev) => ({ ...prev, [titleId]: prevSeasons }));
        setProgressByTitle((prev) => ({ ...prev, [titleId]: prevProgressMap }));
        setEntriesByList(prevEntriesByList);
        showToast(zh.app.writeRollbackToast);
      }
    },
    [titles, seasonsByTitle, progressByTitle, entriesByList, user, showToast]
  );

  // Item 3: Checking an episode updates only watched.<key> (deleteField() to uncheck) plus the changed title fields via updateDoc / batch.update
  const toggleEpisode = useCallback(
    async (titleId: string, episodeKey: string) => {
      const prevTitle = titles[titleId];
      if (!prevTitle) return;
      const seasons = seasonsByTitle[titleId] || [];
      const prevProgress = getActiveProgress(prevTitle);
      const now = Date.now();

      const res = toggleEpisodeWatched(prevTitle, seasons, prevProgress, episodeKey, {
        includeSpecials: settings.includeSpecials,
        now,
      });

      const updatedTitle: TitleDoc = {
        ...prevTitle,
        manualState: res.manualState,
        resume: res.resume,
        playthroughs: res.playthroughs,
        activePlaythroughId: res.activePlaythroughId,
        updatedAt: now,
        lastActivityAt: now,
      };

      // Optimistic update
      setTitles((prev) => ({ ...prev, [titleId]: updatedTitle }));
      setProgressByTitle((prev) => ({
        ...prev,
        [titleId]: {
          ...(prev[titleId] || {}),
          [res.progress.playthroughId]: res.progress,
        },
      }));

      if (!user) return;

      const uid = user.uid;
      const titlePath = `users/${uid}/titles/${titleId}`;
      const progressPath = `users/${uid}/titles/${titleId}/progress/${res.progress.playthroughId}`;
      const newWatchedVal = res.progress.watched[episodeKey];

      try {
        const batch = writeBatch(db);
        batch.set(
          doc(db, progressPath),
          {
            watched: {
              [episodeKey]: newWatchedVal !== undefined ? newWatchedVal : deleteField(),
            },
          },
          { merge: true }
        );
        batch.update(doc(db, titlePath), {
          manualState: res.manualState,
          resume: res.resume ? sanitizeForFirestore(res.resume) : null,
          playthroughs: sanitizeForFirestore(res.playthroughs),
          updatedAt: now,
          lastActivityAt: now,
        });
        await batch.commit();
      } catch (err) {
        buildFirestoreErrorInfo(err, OperationType.UPDATE, titlePath);
        setTitles((prev) => ({ ...prev, [titleId]: prevTitle }));
        setProgressByTitle((prev) => ({
          ...prev,
          [titleId]: {
            ...(prev[titleId] || {}),
            [prevProgress.playthroughId]: prevProgress,
          },
        }));
        showToast(zh.app.writeRollbackToast);
      }
    },
    [titles, seasonsByTitle, getActiveProgress, settings.includeSpecials, user, showToast]
  );

  // Helper to build field-level progress diff for multi-episode actions (toggleSeason, markUpTo, markWholeTitle)
  const commitFieldLevelProgressAndTitleUpdate = useCallback(
    async (
      prevTitle: TitleDoc,
      prevProgress: ProgressDoc,
      updatedTitle: TitleDoc,
      nextProgress: ProgressDoc
    ) => {
      const titleId = prevTitle.id;
      setTitles((prev) => ({ ...prev, [titleId]: updatedTitle }));
      setProgressByTitle((prev) => ({
        ...prev,
        [titleId]: {
          ...(prev[titleId] || {}),
          [nextProgress.playthroughId]: nextProgress,
        },
      }));

      if (!user) return;

      const uid = user.uid;
      const titlePath = `users/${uid}/titles/${titleId}`;
      const progressPath = `users/${uid}/titles/${titleId}/progress/${nextProgress.playthroughId}`;

      // Compute exact field-level nested watched map updates
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const watchedUpdates: Record<string, any> = {};
      const allKeys = new Set([
        ...Object.keys(prevProgress.watched),
        ...Object.keys(nextProgress.watched),
      ]);
      for (const k of allKeys) {
        const beforeVal = prevProgress.watched[k];
        const afterVal = nextProgress.watched[k];
        if (beforeVal !== afterVal) {
          watchedUpdates[k] = afterVal !== undefined ? afterVal : deleteField();
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const progressPayload: Record<string, any> = {};
      if (Object.keys(watchedUpdates).length > 0) {
        progressPayload.watched = watchedUpdates;
      }
      if (prevProgress.movieWatchedAt !== nextProgress.movieWatchedAt) {
        progressPayload.movieWatchedAt =
          nextProgress.movieWatchedAt !== undefined
            ? nextProgress.movieWatchedAt
            : deleteField();
      }

      try {
        const batch = writeBatch(db);
        if (Object.keys(progressPayload).length > 0) {
          batch.set(doc(db, progressPath), progressPayload, { merge: true });
        }
        batch.update(doc(db, titlePath), {
          manualState: updatedTitle.manualState,
          resume: updatedTitle.resume ? sanitizeForFirestore(updatedTitle.resume) : null,
          playthroughs: sanitizeForFirestore(updatedTitle.playthroughs),
          updatedAt: updatedTitle.updatedAt,
          lastActivityAt: updatedTitle.lastActivityAt,
        });
        await batch.commit();
      } catch (err) {
        buildFirestoreErrorInfo(err, OperationType.UPDATE, titlePath);
        setTitles((prev) => ({ ...prev, [titleId]: prevTitle }));
        setProgressByTitle((prev) => ({
          ...prev,
          [titleId]: {
            ...(prev[titleId] || {}),
            [prevProgress.playthroughId]: prevProgress,
          },
        }));
        showToast(zh.app.writeRollbackToast);
      }
    },
    [user, showToast]
  );

  const toggleSeason = useCallback(
    async (titleId: string, seasonNumber: number, markWatched: boolean) => {
      const prevTitle = titles[titleId];
      if (!prevTitle) return;
      const seasons = seasonsByTitle[titleId] || [];
      const prevProgress = getActiveProgress(prevTitle);
      const now = Date.now();

      const res = setSeasonWatched(
        prevTitle,
        seasons,
        prevProgress,
        seasonNumber,
        markWatched,
        {
          includeSpecials: settings.includeSpecials,
          now,
        }
      );

      const updatedTitle: TitleDoc = {
        ...prevTitle,
        manualState: res.manualState,
        resume: res.resume,
        playthroughs: res.playthroughs,
        activePlaythroughId: res.activePlaythroughId,
        updatedAt: now,
        lastActivityAt: now,
      };

      await commitFieldLevelProgressAndTitleUpdate(
        prevTitle,
        prevProgress,
        updatedTitle,
        res.progress
      );
    },
    [
      titles,
      seasonsByTitle,
      getActiveProgress,
      settings.includeSpecials,
      commitFieldLevelProgressAndTitleUpdate,
    ]
  );

  const markUpTo = useCallback(
    async (titleId: string, episodeKey: string) => {
      const prevTitle = titles[titleId];
      if (!prevTitle) return;
      const seasons = seasonsByTitle[titleId] || [];
      const prevProgress = getActiveProgress(prevTitle);
      const now = Date.now();

      const res = markUpToEpisode(prevTitle, seasons, prevProgress, episodeKey, {
        includeSpecials: settings.includeSpecials,
        now,
      });

      const updatedTitle: TitleDoc = {
        ...prevTitle,
        manualState: res.manualState,
        resume: res.resume,
        playthroughs: res.playthroughs,
        activePlaythroughId: res.activePlaythroughId,
        updatedAt: now,
        lastActivityAt: now,
      };

      await commitFieldLevelProgressAndTitleUpdate(
        prevTitle,
        prevProgress,
        updatedTitle,
        res.progress
      );
    },
    [
      titles,
      seasonsByTitle,
      getActiveProgress,
      settings.includeSpecials,
      commitFieldLevelProgressAndTitleUpdate,
    ]
  );

  const markWholeTitle = useCallback(
    async (titleId: string, markWatched: boolean) => {
      const prevTitle = titles[titleId];
      if (!prevTitle) return;
      const seasons = seasonsByTitle[titleId] || [];
      const prevProgress = getActiveProgress(prevTitle);
      const now = Date.now();

      const res = markWholeTitleWatched(prevTitle, seasons, prevProgress, markWatched, {
        includeSpecials: settings.includeSpecials,
        now,
      });

      const updatedTitle: TitleDoc = {
        ...prevTitle,
        manualState: res.manualState,
        resume: res.resume,
        playthroughs: res.playthroughs,
        activePlaythroughId: res.activePlaythroughId,
        updatedAt: now,
        lastActivityAt: now,
      };

      await commitFieldLevelProgressAndTitleUpdate(
        prevTitle,
        prevProgress,
        updatedTitle,
        res.progress
      );
    },
    [
      titles,
      seasonsByTitle,
      getActiveProgress,
      settings.includeSpecials,
      commitFieldLevelProgressAndTitleUpdate,
    ]
  );

  const saveResume = useCallback(
    async (
      titleId: string,
      resume: { episodeKey: string | null; seconds: number } | null
    ) => {
      const prevTitle = titles[titleId];
      if (!prevTitle) return;
      const now = Date.now();
      const res = setResumePoint(prevTitle, resume, now);
      const updatedTitle: TitleDoc = {
        ...prevTitle,
        manualState: res.manualState,
        resume: res.resume,
        updatedAt: now,
        lastActivityAt: now,
      };

      setTitles((prev) => ({ ...prev, [titleId]: updatedTitle }));

      if (!user) return;
      const titlePath = `users/${user.uid}/titles/${titleId}`;
      try {
        await updateDoc(doc(db, titlePath), {
          manualState: res.manualState,
          resume: res.resume ? sanitizeForFirestore(res.resume) : null,
          updatedAt: now,
          lastActivityAt: now,
        });
      } catch (err) {
        buildFirestoreErrorInfo(err, OperationType.UPDATE, titlePath);
        setTitles((prev) => ({ ...prev, [titleId]: prevTitle }));
        showToast(zh.app.writeRollbackToast);
      }
    },
    [titles, user, showToast]
  );

  const startTitleRewatch = useCallback(
    async (titleId: string) => {
      const prevTitle = titles[titleId];
      if (!prevTitle) return;
      const seasons = seasonsByTitle[titleId] || [];
      const activeProgress = getActiveProgress(prevTitle);
      const now = Date.now();

      const res = startRewatch(prevTitle, seasons, activeProgress, {
        includeSpecials: settings.includeSpecials,
        now,
      });

      const updatedTitle: TitleDoc = {
        ...prevTitle,
        manualState: res.manualState,
        resume: res.resume,
        playthroughs: res.playthroughs,
        activePlaythroughId: res.activePlaythroughId,
        updatedAt: now,
        lastActivityAt: now,
      };

      setTitles((prev) => ({ ...prev, [titleId]: updatedTitle }));
      setProgressByTitle((prev) => ({
        ...prev,
        [titleId]: {
          ...(prev[titleId] || {}),
          [res.progress.playthroughId]: res.progress,
        },
      }));

      if (!user) return;
      const uid = user.uid;
      const titlePath = `users/${uid}/titles/${titleId}`;
      const newProgressPath = `users/${uid}/titles/${titleId}/progress/${res.progress.playthroughId}`;

      try {
        const batch = writeBatch(db);
        batch.update(doc(db, titlePath), {
          manualState: res.manualState,
          resume: res.resume ? sanitizeForFirestore(res.resume) : null,
          playthroughs: sanitizeForFirestore(res.playthroughs),
          activePlaythroughId: res.activePlaythroughId,
          updatedAt: now,
          lastActivityAt: now,
        });
        const { playthroughId: _pid, ...progressPayload } = sanitizeForFirestore(res.progress);
        batch.set(doc(db, newProgressPath), progressPayload);
        await batch.commit();
      } catch (err) {
        buildFirestoreErrorInfo(err, OperationType.UPDATE, titlePath);
        setTitles((prev) => ({ ...prev, [titleId]: prevTitle }));
        setProgressByTitle((prev) => {
          const copy = { ...(prev[titleId] || {}) };
          delete copy[res.progress.playthroughId];
          return { ...prev, [titleId]: copy };
        });
        showToast(zh.app.writeRollbackToast);
      }
    },
    [titles, seasonsByTitle, getActiveProgress, settings.includeSpecials, user, showToast]
  );

  const cancelTitleRewatch = useCallback(
    async (titleId: string) => {
      const prevTitle = titles[titleId];
      if (!prevTitle || prevTitle.playthroughs.length <= 1) return;
      const prevProgressMap = progressByTitle[titleId] || {};
      const now = Date.now();
      const res = cancelRewatch(prevTitle, prevProgressMap);
      if (!res.removedPlaythroughId) return;

      const updatedTitle: TitleDoc = {
        ...prevTitle,
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

      if (!user) return;
      const uid = user.uid;
      const titlePath = `users/${uid}/titles/${titleId}`;
      const removedProgressPath = `users/${uid}/titles/${titleId}/progress/${res.removedPlaythroughId}`;
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, titlePath), {
          manualState: res.manualState,
          resume: res.resume ? sanitizeForFirestore(res.resume) : null,
          playthroughs: sanitizeForFirestore(res.playthroughs),
          activePlaythroughId: res.activePlaythroughId,
          updatedAt: now,
          lastActivityAt: now,
        });
        batch.delete(doc(db, removedProgressPath));
        await batch.commit();
      } catch (err) {
        buildFirestoreErrorInfo(err, OperationType.UPDATE, titlePath);
        setTitles((prev) => ({ ...prev, [titleId]: prevTitle }));
        setProgressByTitle((prev) => ({ ...prev, [titleId]: prevProgressMap }));
        showToast(zh.app.writeRollbackToast);
      }
    },
    [titles, progressByTitle, user, showToast]
  );

  const setTitleManualState = useCallback(
    async (titleId: string, manualState: ManualState) => {
      const prevTitle = titles[titleId];
      if (!prevTitle) return;
      const now = Date.now();
      const updatedTitle: TitleDoc = {
        ...prevTitle,
        manualState,
        updatedAt: now,
        lastActivityAt: now,
      };
      setTitles((prev) => ({ ...prev, [titleId]: updatedTitle }));

      if (!user) return;
      const titlePath = `users/${user.uid}/titles/${titleId}`;
      try {
        await updateDoc(doc(db, titlePath), {
          manualState,
          updatedAt: now,
          lastActivityAt: now,
        });
      } catch (err) {
        buildFirestoreErrorInfo(err, OperationType.UPDATE, titlePath);
        setTitles((prev) => ({ ...prev, [titleId]: prevTitle }));
        showToast(zh.app.writeRollbackToast);
      }
    },
    [titles, user, showToast]
  );

  const updateTitleLanguage = useCallback(
    async (titleId: string, displayLang: DisplayLang | null, customName?: string) => {
      const prevTitle = titles[titleId];
      if (!prevTitle) return;
      const now = Date.now();
      const trimmedCustom = customName?.trim();
      const updatedNames = { ...prevTitle.names };
      if (trimmedCustom) {
        updatedNames.custom = trimmedCustom;
      } else if (customName !== undefined) {
        delete updatedNames.custom;
      }

      const updatedTitle: TitleDoc = {
        ...prevTitle,
        names: updatedNames,
        displayLang,
        updatedAt: now,
      };
      setTitles((prev) => ({ ...prev, [titleId]: updatedTitle }));

      if (!user) return;
      const titlePath = `users/${user.uid}/titles/${titleId}`;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatePayload: Record<string, any> = {
          displayLang,
          updatedAt: now,
        };
        if (trimmedCustom) {
          updatePayload['names.custom'] = trimmedCustom;
        } else if (customName !== undefined) {
          updatePayload['names.custom'] = deleteField();
        }
        await updateDoc(doc(db, titlePath), updatePayload);
      } catch (err) {
        buildFirestoreErrorInfo(err, OperationType.UPDATE, titlePath);
        setTitles((prev) => ({ ...prev, [titleId]: prevTitle }));
        showToast(zh.app.writeRollbackToast);
      }
    },
    [titles, user, showToast]
  );

  // Item 3: Ratings refresh must never touch manualState, resume, playthroughs or progress
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
        const res = await apiFetch(`/api/ratings?${params.toString()}`, {
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

        const prevTitle = current;
        setTitles((prev) => {
          const latest = prev[titleId];
          if (!latest) return prev;
          return {
            ...prev,
            [titleId]: {
              ...latest,
              ratings: mergedRatings,
              externalIds: mergedExternalIds,
              updatedAt: now,
            },
          };
        });

        if (user) {
          const titlePath = `users/${user.uid}/titles/${titleId}`;
          try {
            await updateDoc(doc(db, titlePath), {
              ratings: sanitizeForFirestore(mergedRatings),
              externalIds: sanitizeForFirestore(mergedExternalIds),
              updatedAt: now,
            });
          } catch (err) {
            buildFirestoreErrorInfo(err, OperationType.UPDATE, titlePath);
            setTitles((prev) => ({ ...prev, [titleId]: prevTitle }));
            showToast(zh.app.writeRollbackToast);
          }
        }
      } catch {
        // Silently ignore ratings fetch error
      }
    },
    [titles, user, showToast]
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

      await createTitleDocumentBatch(newTitle, initialProgress, seasons);

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
          const prevListEntries = currentEntries;
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
              buildFirestoreErrorInfo(err, OperationType.CREATE, entryPath);
              setEntriesByList((prev) => ({
                ...prev,
                [listId]: prevListEntries,
              }));
              showToast(zh.app.writeRollbackToast);
            }
          }
        }
      }

      return newTitle;
    },
    [createTitleDocumentBatch, lists, entriesByList, user, showToast]
  );

  const updateTitleDetails = useCallback(
    async (titleId: string, input: UpdateTitleDetailsInput) => {
      const prevTitle = titles[titleId];
      if (!prevTitle) return;
      const prevSeasons = seasonsByTitle[titleId] || [];
      const now = Date.now();

      const nextZh =
        input.name !== undefined ? input.name.trim() || prevTitle.names.zh : prevTitle.names.zh;
      const nextOrig =
        input.originalName !== undefined
          ? input.originalName.trim() || nextZh || prevTitle.names.original
          : prevTitle.names.original;

      const posterUrl =
        input.posterPath !== undefined
          ? input.posterPath?.trim()
            ? input.posterPath.trim().slice(0, 500)
            : null
          : prevTitle.posterPath;

      let doubanField =
        input.doubanUrl !== undefined ? input.doubanUrl.trim() : prevTitle.externalIds?.douban;
      if (doubanField && doubanField.includes('douban.com/subject/')) {
        const m = doubanField.match(/subject\/(\d+)/);
        if (m) doubanField = m[1];
      }

      const nextExternalIds = { ...prevTitle.externalIds };
      if (doubanField) {
        nextExternalIds.douban = doubanField;
      } else if (input.doubanUrl !== undefined) {
        delete nextExternalIds.douban;
      }

      const nextRatings = { ...prevTitle.ratings };
      if (input.doubanScore !== undefined) {
        const s = input.doubanScore.trim();
        if (s) {
          nextRatings.douban = s;
        } else {
          delete nextRatings.douban;
        }
      }

      const nextBackdrop =
        prevTitle.source !== 'tmdb' ? posterUrl || prevTitle.backdropPath : prevTitle.backdropPath;
      const nextOverview = {
        ...prevTitle.overview,
        ...(input.overview !== undefined ? { zh: input.overview.trim() } : {}),
      };

      const updatedTitle: TitleDoc = {
        ...prevTitle,
        mediaType: input.mediaType ?? prevTitle.mediaType,
        names: {
          ...prevTitle.names,
          original: nextOrig,
          zh: nextZh,
        },
        year: input.year !== undefined ? input.year : prevTitle.year,
        runtimeMin: input.runtimeMin !== undefined ? input.runtimeMin : prevTitle.runtimeMin,
        posterPath: posterUrl,
        backdropPath: nextBackdrop,
        overview: nextOverview,
        externalIds: nextExternalIds,
        ratings: nextRatings,
        updatedAt: now,
        lastActivityAt: now,
      };

      let updatedSeasons: SeasonDoc[] | undefined = undefined;
      if (
        (prevTitle.source === 'custom' || prevTitle.source === 'url') &&
        input.episodeCount !== undefined
      ) {
        const epCount =
          input.episodeCount && input.episodeCount > 0
            ? Math.min(2000, Math.floor(input.episodeCount))
            : 0;
        if (epCount > 0) {
          const existingS1 = prevSeasons.find((s) => s.seasonNumber === 1);
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

      setTitles((prev) => ({ ...prev, [titleId]: updatedTitle }));
      if (updatedSeasons !== undefined) {
        setSeasonsByTitle((prev) => ({ ...prev, [titleId]: updatedSeasons! }));
      }

      if (!user) return;
      const uid = user.uid;
      const titlePath = `users/${uid}/titles/${titleId}`;
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, titlePath), {
          mediaType: updatedTitle.mediaType,
          'names.original': nextOrig,
          'names.zh': nextZh || null,
          year: updatedTitle.year,
          runtimeMin: updatedTitle.runtimeMin,
          posterPath: posterUrl,
          backdropPath: nextBackdrop,
          overview: sanitizeForFirestore(nextOverview),
          externalIds: sanitizeForFirestore(nextExternalIds),
          ratings: sanitizeForFirestore(nextRatings),
          updatedAt: now,
          lastActivityAt: now,
        });

        if (updatedSeasons !== undefined) {
          if (updatedSeasons.length === 0) {
            batch.delete(doc(db, `${titlePath}/seasons/s_1`));
          } else {
            for (const season of updatedSeasons) {
              batch.set(
                doc(db, `${titlePath}/seasons/s_${season.seasonNumber}`),
                sanitizeForFirestore(season)
              );
            }
          }
        }

        await batch.commit();
      } catch (err) {
        buildFirestoreErrorInfo(err, OperationType.UPDATE, titlePath);
        setTitles((prev) => ({ ...prev, [titleId]: prevTitle }));
        if (updatedSeasons !== undefined) {
          setSeasonsByTitle((prev) => ({ ...prev, [titleId]: prevSeasons }));
        }
        showToast(zh.app.writeRollbackToast);
      }
    },
    [titles, seasonsByTitle, user, showToast]
  );

  const updateSettings = useCallback(
    async (partial: Partial<AppSettingsDoc>) => {
      const prevSettings = settings;
      const nextSettings: AppSettingsDoc = {
        ...settings,
        ...partial,
      };
      setSettings(nextSettings);

      if (user) {
        const settingsPath = `users/${user.uid}/settings/app`;
        try {
          await setDoc(doc(db, settingsPath), sanitizeForFirestore(nextSettings), { merge: true });
        } catch (err) {
          buildFirestoreErrorInfo(err, OperationType.UPDATE, settingsPath);
          setSettings(prevSettings);
          showToast(zh.app.writeRollbackToast);
        }
      }
    },
    [settings, user, showToast]
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
          buildFirestoreErrorInfo(err, OperationType.CREATE, listPath);
          setLists((prev) => {
            const copy = { ...prev };
            delete copy[newList.id];
            return copy;
          });
          setEntriesByList((prev) => {
            const copy = { ...prev };
            delete copy[newList.id];
            return copy;
          });
          showToast(zh.app.writeRollbackToast);
        }
      }

      return newList;
    },
    [lists, user, showToast]
  );

  const deleteList = useCallback(
    async (listId: string) => {
      const prevList = lists[listId];
      if (!prevList) return;
      const prevEntries = entriesByList[listId] || [];

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
        const uid = user.uid;
        const listPath = `users/${uid}/lists/${listId}`;
        try {
          const batch = writeBatch(db);
          for (const entry of prevEntries) {
            batch.delete(doc(db, `${listPath}/entries/${entry.id}`));
          }
          batch.delete(doc(db, listPath));
          await batch.commit();
        } catch (err) {
          buildFirestoreErrorInfo(err, OperationType.DELETE, listPath);
          setLists((prev) => ({ ...prev, [listId]: prevList }));
          setEntriesByList((prev) => ({ ...prev, [listId]: prevEntries }));
          showToast(zh.app.writeRollbackToast);
        }
      }
    },
    [lists, entriesByList, user, showToast]
  );

  const togglePinList = useCallback(
    async (listId: string) => {
      const prevList = lists[listId];
      if (!prevList) return;
      const nextPinned = !prevList.pinned;
      const updated: WatchListDoc = {
        ...prevList,
        pinned: nextPinned,
      };
      setLists((prev) => ({ ...prev, [listId]: updated }));

      if (user) {
        const listPath = `users/${user.uid}/lists/${listId}`;
        try {
          await updateDoc(doc(db, listPath), { pinned: nextPinned });
        } catch (err) {
          buildFirestoreErrorInfo(err, OperationType.UPDATE, listPath);
          setLists((prev) => ({ ...prev, [listId]: prevList }));
          showToast(zh.app.writeRollbackToast);
        }
      }
    },
    [lists, user, showToast]
  );

  const updateCollectionSort = useCallback(
    async (listId: string, sort: CollectionSort) => {
      const prevList = lists[listId];
      if (!prevList) return;
      const updated: WatchListDoc = {
        ...prevList,
        collectionSort: sort,
      };
      setLists((prev) => ({ ...prev, [listId]: updated }));

      if (user) {
        const listPath = `users/${user.uid}/lists/${listId}`;
        try {
          await updateDoc(doc(db, listPath), { collectionSort: sort });
        } catch (err) {
          buildFirestoreErrorInfo(err, OperationType.UPDATE, listPath);
          setLists((prev) => ({ ...prev, [listId]: prevList }));
          showToast(zh.app.writeRollbackToast);
        }
      }
    },
    [lists, user, showToast]
  );

  const addTitleToList = useCallback(
    async (listId: string, titleId: string) => {
      const prevEntries = entriesByList[listId] || [];
      if (prevEntries.some((e) => e.titleId === titleId)) return;

      const rank = getNextRank(prevEntries.map((e) => e.rank));
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
          buildFirestoreErrorInfo(err, OperationType.CREATE, entryPath);
          setEntriesByList((prev) => ({
            ...prev,
            [listId]: prevEntries,
          }));
          showToast(zh.app.writeRollbackToast);
        }
      }
    },
    [entriesByList, user, showToast]
  );

  const removeEntryFromList = useCallback(
    async (listId: string, entryId: string) => {
      const prevEntries = entriesByList[listId] || [];
      setEntriesByList((prev) => ({
        ...prev,
        [listId]: (prev[listId] || []).filter((e) => e.id !== entryId),
      }));

      if (user) {
        const entryPath = `users/${user.uid}/lists/${listId}/entries/${entryId}`;
        try {
          await deleteDoc(doc(db, entryPath));
        } catch (err) {
          buildFirestoreErrorInfo(err, OperationType.DELETE, entryPath);
          setEntriesByList((prev) => ({
            ...prev,
            [listId]: prevEntries,
          }));
          showToast(zh.app.writeRollbackToast);
        }
      }
    },
    [entriesByList, user, showToast]
  );

  const reorderListEntry = useCallback(
    async (listId: string, activeEntryId: string, overEntryId: string) => {
      if (activeEntryId === overEntryId) return;
      const list = lists[listId];
      if (!list) return;

      const prevEntries = entriesByList[listId] || [];
      const hydrated = prevEntries
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

      // Single field-level document write thanks to fractional-indexing!
      if (user) {
        const entryPath = `users/${user.uid}/lists/${listId}/entries/${updatedEntry.id}`;
        try {
          await updateDoc(doc(db, entryPath), { rank: newRank });
        } catch (err) {
          buildFirestoreErrorInfo(err, OperationType.UPDATE, entryPath);
          setEntriesByList((prev) => ({
            ...prev,
            [listId]: prevEntries,
          }));
          showToast(zh.app.writeRollbackToast);
        }
      }
    },
    [lists, entriesByList, titles, settings.defaultTitleLang, user, showToast]
  );

  const value = useMemo<TrackerContextValue>(
    () => ({
      user,
      authReady,
      loadingData,
      toastMessage,
      showToast,
      dismissToast,
      titles,
      seasonsByTitle,
      progressByTitle,
      lists,
      entriesByList,
      settings,
      signIn,
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
    }),
    [
      user,
      authReady,
      loadingData,
      toastMessage,
      showToast,
      dismissToast,
      titles,
      seasonsByTitle,
      progressByTitle,
      lists,
      entriesByList,
      settings,
      signIn,
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
