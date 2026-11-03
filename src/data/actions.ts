import { computeMovedRank, getNextRank, sortListEntries } from '../domain/ordering.ts';
import {
  cancelRewatch,
  makeEpisodeKey,
  markUpToEpisode,
  markWholeTitleWatched,
  setResumePoint,
  setSeasonWatched,
  startRewatch,
  toggleEpisodeWatched,
} from '../domain/progress.ts';
import type {
  AppSettingsDoc,
  AppStateSnapshot,
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
  StateMutationResult,
  TitleDoc,
  WatchListDoc,
} from '../domain/types.ts';
import { zh } from '../i18n/zh.ts';
import {
  apiJson,
  deleteListApi,
  deleteListEntryApi,
  deleteProgressApi,
  deleteTitleApi,
  importDataApi,
  patchListApi,
  patchListEntryApi,
  patchProgressApi,
  patchSettingsApi,
  patchTitleApi,
  putListApi,
  putListEntryApi,
  putProgressApi,
  putSeasonsApi,
  putTitleApi,
} from './api.ts';

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

export interface TrackerActionDeps {
  getState: () => AppStateSnapshot;
  setState: React.Dispatch<React.SetStateAction<AppStateSnapshot>>;
  applyServerMutation: (mutation: StateMutationResult) => void;
  showToast: (message: string) => void;
}

export function getActiveProgressFromState(
  state: AppStateSnapshot,
  title: TitleDoc
): ProgressDoc {
  const pMap = state.progressByTitle[title.id] || {};
  return (
    pMap[title.activePlaythroughId] || {
      playthroughId: title.activePlaythroughId,
      watched: {},
    }
  );
}

export function computeProgressDiff(
  prevProgress: ProgressDoc,
  nextProgress: ProgressDoc
): {
  set?: Record<string, number>;
  unset?: string[];
  movieWatchedAt?: number | null;
  hasChanges: boolean;
} {
  const setMap: Record<string, number> = {};
  const unsetList: string[] = [];

  const allKeys = new Set([
    ...Object.keys(prevProgress.watched),
    ...Object.keys(nextProgress.watched),
  ]);

  for (const key of allKeys) {
    const beforeVal = prevProgress.watched[key];
    const afterVal = nextProgress.watched[key];
    if (beforeVal !== afterVal) {
      if (afterVal !== undefined) {
        setMap[key] = afterVal;
      } else {
        unsetList.push(key);
      }
    }
  }

  let movieWatchedAt: number | null | undefined = undefined;
  if (prevProgress.movieWatchedAt !== nextProgress.movieWatchedAt) {
    movieWatchedAt = nextProgress.movieWatchedAt ?? null;
  }

  const hasSet = Object.keys(setMap).length > 0;
  const hasUnset = unsetList.length > 0;
  const hasMovieChange = movieWatchedAt !== undefined;

  return {
    ...(hasSet ? { set: setMap } : {}),
    ...(hasUnset ? { unset: unsetList } : {}),
    ...(hasMovieChange ? { movieWatchedAt } : {}),
    hasChanges: hasSet || hasUnset || hasMovieChange,
  };
}

export function createTrackerActions(deps: TrackerActionDeps) {
  const { getState, setState, applyServerMutation, showToast } = deps;

  async function commitProgressAndTitleDiff(
    prevTitle: TitleDoc,
    prevProgress: ProgressDoc,
    updatedTitle: TitleDoc,
    nextProgress: ProgressDoc
  ): Promise<void> {
    const titleId = prevTitle.id;
    const snapshot = getState();

    // Optimistic update
    setState((prev) => ({
      ...prev,
      titles: { ...prev.titles, [titleId]: updatedTitle },
      progressByTitle: {
        ...prev.progressByTitle,
        [titleId]: {
          ...(prev.progressByTitle[titleId] || {}),
          [nextProgress.playthroughId]: nextProgress,
        },
      },
    }));

    const diff = computeProgressDiff(prevProgress, nextProgress);

    try {
      if (diff.hasChanges) {
        const progMut = await patchProgressApi(titleId, nextProgress.playthroughId, {
          set: diff.set,
          unset: diff.unset,
          movieWatchedAt: diff.movieWatchedAt,
        });
        applyServerMutation(progMut);
      }

      const titlePatch: Partial<Omit<TitleDoc, 'id'>> = {
        updatedAt: updatedTitle.updatedAt,
        lastActivityAt: updatedTitle.lastActivityAt,
      };
      if (prevTitle.manualState !== updatedTitle.manualState) {
        titlePatch.manualState = updatedTitle.manualState;
      }
      if (JSON.stringify(prevTitle.resume) !== JSON.stringify(updatedTitle.resume)) {
        titlePatch.resume = updatedTitle.resume;
      }
      if (JSON.stringify(prevTitle.playthroughs) !== JSON.stringify(updatedTitle.playthroughs)) {
        titlePatch.playthroughs = updatedTitle.playthroughs;
      }
      if (prevTitle.activePlaythroughId !== updatedTitle.activePlaythroughId) {
        titlePatch.activePlaythroughId = updatedTitle.activePlaythroughId;
      }

      const titleMut = await patchTitleApi(titleId, titlePatch);
      applyServerMutation(titleMut);
    } catch {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
    }
  }

  async function addTitleToList(listId: string, titleId: string): Promise<void> {
    const state = getState();
    const prevEntries = state.entriesByList[listId] || [];
    if (prevEntries.some((e) => e.titleId === titleId)) return;

    const rank = getNextRank(prevEntries.map((e) => e.rank));
    const now = Date.now();
    const newEntry: ListEntryDoc = {
      id: `entry_${now}`,
      titleId,
      rank,
      addedAt: now,
    };

    const snapshot = state;
    setState((prev) => ({
      ...prev,
      entriesByList: {
        ...prev.entriesByList,
        [listId]: [...(prev.entriesByList[listId] || []), newEntry],
      },
    }));

    try {
      const { id: _id, ...payload } = newEntry;
      const mut = await putListEntryApi(listId, newEntry.id, payload);
      applyServerMutation(mut);
    } catch {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
    }
  }

  async function addTitleFromTmdb(
    mediaType: 'movie' | 'tv',
    sourceId: string,
    targetListId?: string
  ): Promise<TitleDoc> {
    const state = getState();
    const existingId = `tmdb_${mediaType}_${sourceId}`;
    let titleDoc = state.titles[existingId];

    if (!titleDoc) {
      let data: { title: TitleDoc; seasons: SeasonDoc[] };
      try {
        data = await apiJson<{ title: TitleDoc; seasons: SeasonDoc[] }>(
          `/api/tmdb/${mediaType}/${sourceId}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : '获取 TMDB 影视详情失败';
        showToast(msg);
        throw err;
      }

      titleDoc = data.title;
      const initialProgress: ProgressDoc = {
        playthroughId: titleDoc.activePlaythroughId,
        watched: {},
      };
      const seasons = data.seasons || [];
      const snapshot = getState();

      setState((prev) => ({
        ...prev,
        titles: { ...prev.titles, [titleDoc!.id]: titleDoc! },
        seasonsByTitle: { ...prev.seasonsByTitle, [titleDoc!.id]: seasons },
        progressByTitle: {
          ...prev.progressByTitle,
          [titleDoc!.id]: {
            ...(prev.progressByTitle[titleDoc!.id] || {}),
            [initialProgress.playthroughId]: initialProgress,
          },
        },
      }));

      try {
        const mut = await putTitleApi(titleDoc.id, {
          title: titleDoc,
          seasons,
          progress: { [initialProgress.playthroughId]: initialProgress },
        });
        applyServerMutation(mut);
      } catch (err) {
        setState(snapshot);
        showToast(zh.app.writeRollbackToast);
        throw err;
      }
    }

    if (targetListId && getState().lists[targetListId]) {
      await addTitleToList(targetListId, titleDoc.id);
    }

    return titleDoc;
  }

  async function createCustomOrLinkTitle(input: CustomTitleInput): Promise<TitleDoc> {
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
    if (doubanField) {
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

    const snapshot = getState();
    setState((prev) => ({
      ...prev,
      titles: { ...prev.titles, [newTitle.id]: newTitle },
      seasonsByTitle: { ...prev.seasonsByTitle, [newTitle.id]: seasons },
      progressByTitle: {
        ...prev.progressByTitle,
        [newTitle.id]: { p1: initialProgress },
      },
    }));

    try {
      const mut = await putTitleApi(newTitle.id, {
        title: newTitle,
        seasons,
        progress: { p1: initialProgress },
      });
      applyServerMutation(mut);
    } catch (err) {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
      throw err;
    }

    if (input.targetListId && getState().lists[input.targetListId]) {
      await addTitleToList(input.targetListId, newTitle.id);
    }

    return newTitle;
  }

  async function updateTitleDetails(titleId: string, input: UpdateTitleDetailsInput): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const prevSeasons = state.seasonsByTitle[titleId] || [];
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
    if (doubanField) {
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

    const nextNames = {
      ...prevTitle.names,
      original: nextOrig,
      zh: nextZh,
    };

    const updatedTitle: TitleDoc = {
      ...prevTitle,
      mediaType: input.mediaType ?? prevTitle.mediaType,
      names: nextNames,
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

    // Build patch containing only changed title fields
    const patch: Partial<Omit<TitleDoc, 'id'>> = {
      updatedAt: now,
      lastActivityAt: now,
    };
    if (updatedTitle.mediaType !== prevTitle.mediaType) patch.mediaType = updatedTitle.mediaType;
    if (JSON.stringify(updatedTitle.names) !== JSON.stringify(prevTitle.names)) {
      patch.names = updatedTitle.names;
    }
    if (updatedTitle.year !== prevTitle.year) patch.year = updatedTitle.year;
    if (updatedTitle.runtimeMin !== prevTitle.runtimeMin) patch.runtimeMin = updatedTitle.runtimeMin;
    if (updatedTitle.posterPath !== prevTitle.posterPath) patch.posterPath = updatedTitle.posterPath;
    if (updatedTitle.backdropPath !== prevTitle.backdropPath) {
      patch.backdropPath = updatedTitle.backdropPath;
    }
    if (JSON.stringify(updatedTitle.overview) !== JSON.stringify(prevTitle.overview)) {
      patch.overview = updatedTitle.overview;
    }
    if (JSON.stringify(updatedTitle.externalIds) !== JSON.stringify(prevTitle.externalIds)) {
      patch.externalIds = updatedTitle.externalIds;
    }
    if (JSON.stringify(updatedTitle.ratings) !== JSON.stringify(prevTitle.ratings)) {
      patch.ratings = updatedTitle.ratings;
    }

    const snapshot = state;
    setState((prev) => ({
      ...prev,
      titles: { ...prev.titles, [titleId]: updatedTitle },
      ...(updatedSeasons !== undefined
        ? { seasonsByTitle: { ...prev.seasonsByTitle, [titleId]: updatedSeasons } }
        : {}),
    }));

    try {
      const mut = await patchTitleApi(titleId, patch);
      applyServerMutation(mut);
      if (updatedSeasons !== undefined) {
        const sMut = await putSeasonsApi(titleId, updatedSeasons);
        applyServerMutation(sMut);
      }
    } catch {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
    }
  }

  async function updateTitleLanguage(
    titleId: string,
    displayLang: DisplayLang | null,
    customName?: string
  ): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
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

    const snapshot = state;
    setState((prev) => ({
      ...prev,
      titles: { ...prev.titles, [titleId]: updatedTitle },
    }));

    try {
      const patch: Partial<Omit<TitleDoc, 'id'>> = {
        displayLang,
        updatedAt: now,
      };
      if (JSON.stringify(updatedNames) !== JSON.stringify(prevTitle.names)) {
        patch.names = updatedNames;
      }
      const mut = await patchTitleApi(titleId, patch);
      applyServerMutation(mut);
    } catch {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
    }
  }

  async function setTitleManualState(titleId: string, manualState: ManualState): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const now = Date.now();
    const updatedTitle: TitleDoc = {
      ...prevTitle,
      manualState,
      updatedAt: now,
      lastActivityAt: now,
    };

    const snapshot = state;
    setState((prev) => ({
      ...prev,
      titles: { ...prev.titles, [titleId]: updatedTitle },
    }));

    try {
      const mut = await patchTitleApi(titleId, {
        manualState,
        updatedAt: now,
        lastActivityAt: now,
      });
      applyServerMutation(mut);
    } catch {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
    }
  }

  async function fetchAndCacheTitleRatings(titleId: string): Promise<void> {
    const state = getState();
    const current = state.titles[titleId];
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
      const data = await apiJson<{
        ratings?: Ratings;
        externalIds?: { douban?: string };
      }>(`/api/ratings?${params.toString()}`);

      const latest = getState().titles[titleId];
      if (!latest) return;

      const mergedRatings: Ratings = {
        ...latest.ratings,
        ...(data.ratings?.imdb ? { imdb: data.ratings.imdb } : {}),
        ...(data.ratings?.imdbVotes ? { imdbVotes: data.ratings.imdbVotes } : {}),
        ...(data.ratings?.rottenTomatoes ? { rottenTomatoes: data.ratings.rottenTomatoes } : {}),
        ...(data.ratings?.metacritic ? { metacritic: data.ratings.metacritic } : {}),
        ...(data.ratings?.douban
          ? { douban: data.ratings.douban }
          : latest.ratings?.douban
            ? { douban: latest.ratings.douban }
            : {}),
        fetchedAt: now,
      };

      const mergedExternalIds = {
        ...latest.externalIds,
        ...(data.externalIds?.douban && !latest.externalIds?.douban
          ? { douban: data.externalIds.douban }
          : {}),
      };

      const snapshot = getState();
      setState((prev) => ({
        ...prev,
        titles: {
          ...prev.titles,
          [titleId]: {
            ...latest,
            ratings: mergedRatings,
            externalIds: mergedExternalIds,
            updatedAt: now,
          },
        },
      }));

      try {
        const mut = await patchTitleApi(titleId, {
          ratings: mergedRatings,
          externalIds: mergedExternalIds,
          updatedAt: now,
        });
        applyServerMutation(mut);
      } catch {
        setState(snapshot);
        showToast(zh.app.writeRollbackToast);
      }
    } catch {
      // Ignore silent background ratings fetch failure
    }
  }

  async function refreshTitleMetadata(titleId: string): Promise<void> {
    const state = getState();
    const current = state.titles[titleId];
    if (!current || current.source !== 'tmdb' || !current.sourceId) return;
    if (current.mediaType !== 'movie' && current.mediaType !== 'tv') return;

    try {
      const data = await apiJson<{ title: TitleDoc; seasons: SeasonDoc[] }>(
        `/api/tmdb/${current.mediaType}/${current.sourceId}`
      );
      const latest = getState().titles[titleId];
      if (!latest) return;

      const now = Date.now();
      const nextZh =
        data.title.names.zh && data.title.names.zh !== data.title.names.original
          ? data.title.names.zh
          : latest.names.zh || data.title.names.zh;
      const nextNames = {
        ...latest.names,
        original: data.title.names.original,
        zh: nextZh,
        en: data.title.names.en,
      };
      const nextYear = data.title.year ?? latest.year;
      const nextRuntime = data.title.runtimeMin ?? latest.runtimeMin;
      const nextGenres = data.title.genres.length > 0 ? data.title.genres : latest.genres;
      const nextPoster = data.title.posterPath || latest.posterPath;
      const nextBackdrop = data.title.backdropPath || latest.backdropPath;
      const nextOverview = {
        zh: data.title.overview.zh || latest.overview.zh,
        en: data.title.overview.en || latest.overview.en,
      };
      const nextShowStatus = data.title.showStatus || latest.showStatus;

      const snapshot = getState();
      setState((prev) => ({
        ...prev,
        titles: {
          ...prev.titles,
          [titleId]: {
            ...latest,
            names: nextNames,
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
        },
        seasonsByTitle: {
          ...prev.seasonsByTitle,
          [titleId]: data.seasons,
        },
      }));

      try {
        const tMut = await patchTitleApi(titleId, {
          names: nextNames,
          year: nextYear,
          runtimeMin: nextRuntime,
          genres: nextGenres,
          posterPath: nextPoster,
          backdropPath: nextBackdrop,
          overview: nextOverview,
          showStatus: nextShowStatus,
          metaFetchedAt: now,
          updatedAt: now,
        });
        applyServerMutation(tMut);

        const sMut = await putSeasonsApi(titleId, data.seasons);
        applyServerMutation(sMut);
      } catch {
        setState(snapshot);
        showToast(zh.app.writeRollbackToast);
      }
    } catch {
      // Ignore silent background metadata refresh failure
    }
  }

  async function removeTitle(titleId: string): Promise<void> {
    const snapshot = getState();
    if (!snapshot.titles[titleId]) return;

    setState((prev) => {
      const nextTitles = { ...prev.titles };
      delete nextTitles[titleId];
      const nextSeasons = { ...prev.seasonsByTitle };
      delete nextSeasons[titleId];
      const nextProgress = { ...prev.progressByTitle };
      delete nextProgress[titleId];
      const nextEntries: Record<string, ListEntryDoc[]> = {};
      for (const [listId, entries] of Object.entries(prev.entriesByList)) {
        nextEntries[listId] = entries.filter((e) => e.titleId !== titleId);
      }
      return {
        ...prev,
        titles: nextTitles,
        seasonsByTitle: nextSeasons,
        progressByTitle: nextProgress,
        entriesByList: nextEntries,
      };
    });

    try {
      const mut = await deleteTitleApi(titleId);
      applyServerMutation(mut);
    } catch {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
    }
  }

  async function toggleEpisode(titleId: string, episodeKey: string): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const seasons = state.seasonsByTitle[titleId] || [];
    const prevProgress = getActiveProgressFromState(state, prevTitle);
    const now = Date.now();

    const res = toggleEpisodeWatched(prevTitle, seasons, prevProgress, episodeKey, {
      includeSpecials: state.settings.includeSpecials,
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

    await commitProgressAndTitleDiff(prevTitle, prevProgress, updatedTitle, res.progress);
  }

  async function toggleSeason(
    titleId: string,
    seasonNumber: number,
    markWatched: boolean
  ): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const seasons = state.seasonsByTitle[titleId] || [];
    const prevProgress = getActiveProgressFromState(state, prevTitle);
    const now = Date.now();

    const res = setSeasonWatched(
      prevTitle,
      seasons,
      prevProgress,
      seasonNumber,
      markWatched,
      {
        includeSpecials: state.settings.includeSpecials,
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

    await commitProgressAndTitleDiff(prevTitle, prevProgress, updatedTitle, res.progress);
  }

  async function markUpTo(titleId: string, episodeKey: string): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const seasons = state.seasonsByTitle[titleId] || [];
    const prevProgress = getActiveProgressFromState(state, prevTitle);
    const now = Date.now();

    const res = markUpToEpisode(prevTitle, seasons, prevProgress, episodeKey, {
      includeSpecials: state.settings.includeSpecials,
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

    await commitProgressAndTitleDiff(prevTitle, prevProgress, updatedTitle, res.progress);
  }

  async function markWholeTitle(titleId: string, markWatched: boolean): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const seasons = state.seasonsByTitle[titleId] || [];
    const prevProgress = getActiveProgressFromState(state, prevTitle);
    const now = Date.now();

    const res = markWholeTitleWatched(prevTitle, seasons, prevProgress, markWatched, {
      includeSpecials: state.settings.includeSpecials,
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

    await commitProgressAndTitleDiff(prevTitle, prevProgress, updatedTitle, res.progress);
  }

  async function saveResume(
    titleId: string,
    resume: { episodeKey: string | null; seconds: number } | null
  ): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
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

    const snapshot = state;
    setState((prev) => ({
      ...prev,
      titles: { ...prev.titles, [titleId]: updatedTitle },
    }));

    try {
      const mut = await patchTitleApi(titleId, {
        manualState: res.manualState,
        resume: res.resume,
        updatedAt: now,
        lastActivityAt: now,
      });
      applyServerMutation(mut);
    } catch {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
    }
  }

  async function startTitleRewatch(titleId: string): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const seasons = state.seasonsByTitle[titleId] || [];
    const activeProgress = getActiveProgressFromState(state, prevTitle);
    const now = Date.now();

    const res = startRewatch(prevTitle, seasons, activeProgress, {
      includeSpecials: state.settings.includeSpecials,
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

    const snapshot = state;
    setState((prev) => ({
      ...prev,
      titles: { ...prev.titles, [titleId]: updatedTitle },
      progressByTitle: {
        ...prev.progressByTitle,
        [titleId]: {
          ...(prev.progressByTitle[titleId] || {}),
          [res.progress.playthroughId]: res.progress,
        },
      },
    }));

    try {
      const pMut = await putProgressApi(titleId, res.progress.playthroughId, {
        watched: res.progress.watched,
        movieWatchedAt: res.progress.movieWatchedAt,
      });
      applyServerMutation(pMut);

      const tMut = await patchTitleApi(titleId, {
        manualState: res.manualState,
        resume: res.resume,
        playthroughs: res.playthroughs,
        activePlaythroughId: res.activePlaythroughId,
        updatedAt: now,
        lastActivityAt: now,
      });
      applyServerMutation(tMut);
    } catch {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
    }
  }

  async function cancelTitleRewatch(titleId: string): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle || prevTitle.playthroughs.length <= 1) return;
    const prevProgressMap = state.progressByTitle[titleId] || {};
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

    const snapshot = state;
    setState((prev) => {
      const nextPMap = { ...(prev.progressByTitle[titleId] || {}) };
      delete nextPMap[res.removedPlaythroughId];
      return {
        ...prev,
        titles: { ...prev.titles, [titleId]: updatedTitle },
        progressByTitle: {
          ...prev.progressByTitle,
          [titleId]: nextPMap,
        },
      };
    });

    try {
      const tMut = await patchTitleApi(titleId, {
        manualState: res.manualState,
        resume: res.resume,
        playthroughs: res.playthroughs,
        activePlaythroughId: res.activePlaythroughId,
        updatedAt: now,
        lastActivityAt: now,
      });
      applyServerMutation(tMut);

      const dMut = await deleteProgressApi(titleId, res.removedPlaythroughId);
      applyServerMutation(dMut);
    } catch {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
    }
  }

  async function createList(input: {
    name: string;
    kind: ListKind;
    description?: string;
    pinned?: boolean;
  }): Promise<WatchListDoc> {
    const state = getState();
    const now = Date.now();
    const existingRanks = Object.values(state.lists).map((l) => l.rank);
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

    const snapshot = state;
    setState((prev) => ({
      ...prev,
      lists: { ...prev.lists, [newList.id]: newList },
      entriesByList: { ...prev.entriesByList, [newList.id]: [] },
    }));

    try {
      const { id: _id, ...payload } = newList;
      const mut = await putListApi(newList.id, payload);
      applyServerMutation(mut);
    } catch (err) {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
      throw err;
    }

    return newList;
  }

  async function deleteList(listId: string): Promise<void> {
    const snapshot = getState();
    if (!snapshot.lists[listId]) return;

    setState((prev) => {
      const nextLists = { ...prev.lists };
      delete nextLists[listId];
      const nextEntries = { ...prev.entriesByList };
      delete nextEntries[listId];
      return {
        ...prev,
        lists: nextLists,
        entriesByList: nextEntries,
      };
    });

    try {
      const mut = await deleteListApi(listId);
      applyServerMutation(mut);
    } catch {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
    }
  }

  async function togglePinList(listId: string): Promise<void> {
    const state = getState();
    const prevList = state.lists[listId];
    if (!prevList) return;
    const nextPinned = !prevList.pinned;
    const updated: WatchListDoc = {
      ...prevList,
      pinned: nextPinned,
    };

    const snapshot = state;
    setState((prev) => ({
      ...prev,
      lists: { ...prev.lists, [listId]: updated },
    }));

    try {
      const mut = await patchListApi(listId, { pinned: nextPinned });
      applyServerMutation(mut);
    } catch {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
    }
  }

  async function updateCollectionSort(listId: string, sort: CollectionSort): Promise<void> {
    const state = getState();
    const prevList = state.lists[listId];
    if (!prevList) return;
    const updated: WatchListDoc = {
      ...prevList,
      collectionSort: sort,
    };

    const snapshot = state;
    setState((prev) => ({
      ...prev,
      lists: { ...prev.lists, [listId]: updated },
    }));

    try {
      const mut = await patchListApi(listId, { collectionSort: sort });
      applyServerMutation(mut);
    } catch {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
    }
  }

  async function removeEntryFromList(listId: string, entryId: string): Promise<void> {
    const snapshot = getState();
    setState((prev) => ({
      ...prev,
      entriesByList: {
        ...prev.entriesByList,
        [listId]: (prev.entriesByList[listId] || []).filter((e) => e.id !== entryId),
      },
    }));

    try {
      const mut = await deleteListEntryApi(listId, entryId);
      applyServerMutation(mut);
    } catch {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
    }
  }

  async function reorderListEntry(
    listId: string,
    activeEntryId: string,
    overEntryId: string
  ): Promise<void> {
    if (activeEntryId === overEntryId) return;
    const state = getState();
    const list = state.lists[listId];
    if (!list) return;

    const prevEntries = state.entriesByList[listId] || [];
    const hydrated = prevEntries
      .map((entry) => ({ entry, title: state.titles[entry.titleId] }))
      .filter((item): item is { entry: ListEntryDoc; title: TitleDoc } => Boolean(item.title));

    const sorted = sortListEntries(
      hydrated,
      list.kind,
      'manual',
      state.settings.defaultTitleLang
    ).map((h) => h.entry);

    const activeIdx = sorted.findIndex((e) => e.id === activeEntryId);
    const overIdx = sorted.findIndex((e) => e.id === overEntryId);
    if (activeIdx === -1 || overIdx === -1) return;

    const newRank = computeMovedRank(sorted, activeIdx, overIdx);
    if (!newRank) return;

    const updatedEntry: ListEntryDoc = {
      ...sorted[activeIdx],
      rank: newRank,
    };

    const snapshot = state;
    setState((prev) => {
      const next = (prev.entriesByList[listId] || [])
        .map((e) => (e.id === activeEntryId ? updatedEntry : e))
        .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
      return {
        ...prev,
        entriesByList: { ...prev.entriesByList, [listId]: next },
      };
    });

    try {
      const mut = await patchListEntryApi(listId, updatedEntry.id, { rank: newRank });
      applyServerMutation(mut);
    } catch {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
    }
  }

  async function updateSettings(partial: Partial<AppSettingsDoc>): Promise<void> {
    const snapshot = getState();
    const nextSettings: AppSettingsDoc = {
      ...snapshot.settings,
      ...partial,
    };

    setState((prev) => ({
      ...prev,
      settings: nextSettings,
    }));

    try {
      const mut = await patchSettingsApi(partial);
      applyServerMutation(mut);
    } catch {
      setState(snapshot);
      showToast(zh.app.writeRollbackToast);
    }
  }

  async function importBackupData(rawPayload: unknown): Promise<void> {
    const mut = await importDataApi(rawPayload);
    setState((prev) => ({
      version: mut.version,
      titles: mut.upserts.titles || {},
      seasonsByTitle: mut.upserts.seasonsByTitle || {},
      progressByTitle: mut.upserts.progressByTitle || {},
      lists: mut.upserts.lists || {},
      entriesByList: mut.upserts.entriesByList || {},
      settings: mut.upserts.settings || prev.settings,
    }));
  }

  return {
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
    importBackupData,
  };
}
