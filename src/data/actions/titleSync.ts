import type {
  ListEntryDoc,
  Ratings,
  TitleDoc,
} from '../../domain/types.ts';
import { zh } from '../../i18n/zh.ts';
import {
  deleteTitleApi,
  fetchRatingsApi,
  fetchTmdbDetailsApi,
  patchTitleApi,
  putSeasonsApi,
  refreshLinkPlaylistApi,
} from '../api.ts';
import type { TrackerActionDeps } from './types.ts';

export function createTitleSyncActions(
  deps: TrackerActionDeps & {
    triggerRefetch: () => Promise<void>;
  }
) {
  const { getState, setState, applyServerMutation, showToast, triggerRefetch } = deps;

  async function fetchAndCacheTitleRatings(titleId: string): Promise<void> {
    const current = getState().titles[titleId];
    if (!current || current.source === 'custom' || current.source === 'url') return;

    const imdbId = current.externalIds?.imdb || '';
    if (!imdbId) return;

    const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;
    const now = Date.now();
    if (current.ratings?.fetchedAt && now - current.ratings.fetchedAt < SEVEN_DAYS_MS) {
      return;
    }

    try {
      const data = await fetchRatingsApi({ imdbId });

      const latest = getState().titles[titleId];
      if (!latest) return;
      const prevRatings = latest.ratings;
      const prevUpdatedAt = latest.updatedAt;

      const mergedRatings: Ratings = {
        ...latest.ratings,
        ...(data.ratings?.imdb ? { imdb: data.ratings.imdb } : {}),
        ...(data.ratings?.imdbVotes ? { imdbVotes: data.ratings.imdbVotes } : {}),
        ...(data.ratings?.rottenTomatoes ? { rottenTomatoes: data.ratings.rottenTomatoes } : {}),
        ...(data.ratings?.metacritic ? { metacritic: data.ratings.metacritic } : {}),
        fetchedAt: now,
      };

      setState((prev) =>
        prev.titles[titleId]
          ? {
              ...prev,
              titles: {
                ...prev.titles,
                [titleId]: {
                  ...prev.titles[titleId],
                  ratings: mergedRatings,
                  updatedAt: now,
                },
              },
            }
          : prev
      );

      try {
        const mut = await patchTitleApi(titleId, {
          ratings: mergedRatings,
          updatedAt: now,
        });
        applyServerMutation(mut);
      } catch {
        setState((curr) =>
          curr.titles[titleId]
            ? {
                ...curr,
                titles: {
                  ...curr.titles,
                  [titleId]: {
                    ...curr.titles[titleId],
                    ratings: prevRatings,
                    updatedAt: prevUpdatedAt,
                  },
                },
              }
            : curr
        );
        showToast(zh.app.writeRollbackToast, 'danger');
        await triggerRefetch();
      }
    } catch {
      // Ignore silent background ratings fetch failure
    }
  }

  async function refreshTitleMetadata(titleId: string): Promise<void> {
    const current = getState().titles[titleId];
    if (!current || current.source !== 'tmdb' || !current.sourceId) return;
    if (current.mediaType !== 'movie' && current.mediaType !== 'tv') return;

    try {
      const data = await fetchTmdbDetailsApi(current.mediaType, current.sourceId);
      const latest = getState().titles[titleId];
      if (!latest) return;
      const prevSeasons = getState().seasonsByTitle[titleId] || [];

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
      const nextRatings: Ratings = {
        ...latest.ratings,
        ...(data.title.ratings?.tmdb ? { tmdb: data.title.ratings.tmdb } : {}),
        ...(data.title.ratings?.tmdbVotes !== undefined
          ? { tmdbVotes: data.title.ratings.tmdbVotes }
          : {}),
      };
      const patch: Partial<Omit<TitleDoc, 'id'>> = {
        names: nextNames,
        year: data.title.year ?? latest.year,
        runtimeMin: data.title.runtimeMin ?? latest.runtimeMin,
        genres: data.title.genres.length > 0 ? data.title.genres : latest.genres,
        posterPath: data.title.posterPath || latest.posterPath,
        backdropPath: data.title.backdropPath || latest.backdropPath,
        overview: {
          zh: data.title.overview.zh || latest.overview.zh,
          en: data.title.overview.en || latest.overview.en,
        },
        showStatus: data.title.showStatus || latest.showStatus,
        ratings: nextRatings,
        metaFetchedAt: now,
        updatedAt: now,
      };

      setState((prev) =>
        prev.titles[titleId]
          ? {
              ...prev,
              titles: {
                ...prev.titles,
                [titleId]: { ...prev.titles[titleId], ...patch, id: titleId },
              },
              seasonsByTitle: {
                ...prev.seasonsByTitle,
                [titleId]: data.seasons,
              },
            }
          : prev
      );

      try {
        const tMut = await patchTitleApi(titleId, patch);
        applyServerMutation(tMut);
        const sMut = await putSeasonsApi(titleId, data.seasons);
        applyServerMutation(sMut);
      } catch {
        setState((curr) =>
          curr.titles[titleId]
            ? {
                ...curr,
                titles: {
                  ...curr.titles,
                  [titleId]: {
                    ...curr.titles[titleId],
                    names: latest.names,
                    year: latest.year,
                    runtimeMin: latest.runtimeMin,
                    genres: latest.genres,
                    posterPath: latest.posterPath,
                    backdropPath: latest.backdropPath,
                    overview: latest.overview,
                    showStatus: latest.showStatus,
                    metaFetchedAt: latest.metaFetchedAt,
                    updatedAt: latest.updatedAt,
                  },
                },
                seasonsByTitle: {
                  ...curr.seasonsByTitle,
                  [titleId]: prevSeasons,
                },
              }
            : curr
        );
        showToast(zh.app.writeRollbackToast, 'danger');
        await triggerRefetch();
      }
    } catch {
      // Ignore silent background metadata refresh failure
    }
  }

  async function refreshLinkTitlePlaylist(titleId: string): Promise<number> {
    const current = getState().titles[titleId];
    if (!current || current.source !== 'url' || !current.sourceId) return 0;

    try {
      const res = await refreshLinkPlaylistApi(titleId);
      applyServerMutation(res);
      showToast(
        res.addedCount > 0
          ? zh.detail.menu.refreshPlaylistAddedToast(res.addedCount)
          : zh.detail.menu.refreshPlaylistNoNewToast,
        res.addedCount > 0 ? 'success' : 'default'
      );
      return res.addedCount;
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : zh.detail.menu.refreshPlaylistFailedToast,
        'danger'
      );
      throw err;
    }
  }

  async function removeTitle(titleId: string): Promise<void> {
    const state = getState();
    const removedTitle = state.titles[titleId];
    if (!removedTitle) return;
    const removedSeasons = state.seasonsByTitle[titleId];
    const removedProgress = state.progressByTitle[titleId];
    const removedEntriesByList: Record<string, ListEntryDoc[]> = {};
    for (const [listId, entries] of Object.entries(state.entriesByList)) {
      const matching = entries.filter((e) => e.titleId === titleId);
      if (matching.length > 0) {
        removedEntriesByList[listId] = matching;
      }
    }

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
      setState((curr) => {
        const nextEntries = { ...curr.entriesByList };
        for (const [listId, entriesToRestore] of Object.entries(removedEntriesByList)) {
          const existing = nextEntries[listId] || [];
          const existingIds = new Set(existing.map((e) => e.id));
          nextEntries[listId] = [
            ...existing,
            ...entriesToRestore.filter((e) => !existingIds.has(e.id)),
          ];
        }
        return {
          ...curr,
          titles: { ...curr.titles, [titleId]: removedTitle },
          ...(removedSeasons !== undefined
            ? { seasonsByTitle: { ...curr.seasonsByTitle, [titleId]: removedSeasons } }
            : {}),
          ...(removedProgress !== undefined
            ? { progressByTitle: { ...curr.progressByTitle, [titleId]: removedProgress } }
            : {}),
          entriesByList: nextEntries,
        };
      });
      showToast(zh.app.writeRollbackToast, 'danger');
      await triggerRefetch();
    }
  }

  return {
    fetchAndCacheTitleRatings,
    refreshTitleMetadata,
    refreshLinkTitlePlaylist,
    removeTitle,
  };
}
