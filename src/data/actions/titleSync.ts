import type { ListEntryDoc, Ratings, MetadataRefreshStatus, MetadataRefreshCounts } from '../../domain/types.ts';
import { getActiveCatalog, translateErrorObject } from '../../i18n/index.ts';
import {
  changeTitleSourceApi,
  decideStructureApi,
  deleteTitleApi,
  fetchRatingsApi,
  refreshMetadataApi,
  patchTitleApi,
  refreshLinkPlaylistApi,
} from '../api.ts';
import type { TrackerActionDeps } from './types.ts';

export function createTitleSyncActions(
  deps: TrackerActionDeps & {
    triggerRefetch: () => Promise<void>;
  },
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
          : prev,
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
            : curr,
        );
        showToast(getActiveCatalog().app.writeRollbackToast, 'danger');
        await triggerRefetch();
      }
    } catch {
      // Ignore silent background ratings fetch failure
    }
  }

  async function refreshTitleMetadata(titleId: string): Promise<MetadataRefreshStatus> {
    const current = getState().titles[titleId];
    if (
      !current ||
      current.source !== 'tmdb' ||
      !current.sourceId ||
      current.mediaType === 'other' ||
      current.sourceUnavailable
    )
      return 'skipped';
    try {
      const result = await refreshMetadataApi(titleId);
      applyServerMutation(result);
      return result.status;
    } catch {
      return 'failed';
    }
  }

  async function refreshAllTmdbMetadata(
    onProgress?: (done: number, total: number) => void,
  ): Promise<MetadataRefreshCounts> {
    const targets = Object.values(getState().titles);
    const counts: MetadataRefreshCounts = { updated: 0, needsReview: 0, partial: 0, failed: 0, skipped: 0 };
    let index = 0;
    let done = 0;
    onProgress?.(0, targets.length);
    const worker = async () => {
      while (index < targets.length) {
        const title = targets[index++];
        if (!title) continue;
        counts[await refreshTitleMetadata(title.id)]++;
        onProgress?.(++done, targets.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, targets.length) }, worker));
    showToast(
      getActiveCatalog().settings.dataManagement.refreshAllSummary(
        counts.updated,
        counts.needsReview,
        counts.partial,
        counts.failed,
        counts.skipped,
      ),
      counts.failed || counts.partial ? 'warning' : counts.updated ? 'success' : 'default',
    );
    return counts;
  }

  async function refreshLinkTitlePlaylist(titleId: string): Promise<number> {
    const current = getState().titles[titleId];
    if (!current || current.source !== 'url' || !current.sourceId) return 0;

    try {
      const res = await refreshLinkPlaylistApi(titleId);
      applyServerMutation(res);
      const cat = getActiveCatalog();
      if (res.skippedCount) showToast(cat.upstream.skippedEntries(res.skippedCount), 'warning');
      if (res.warning) showToast(translateErrorObject({ code: res.warning }, cat), 'warning');
      showToast(
        res.addedCount > 0
          ? cat.detail.menu.refreshPlaylistAddedToast(String(res.addedCount))
          : cat.detail.menu.refreshPlaylistNoNewToast,
        res.addedCount > 0 ? 'success' : 'default',
      );
      return res.addedCount;
    } catch (err) {
      const cat = getActiveCatalog();
      showToast(translateErrorObject(err, cat), 'danger');
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
          nextEntries[listId] = [...existing, ...entriesToRestore.filter((e) => !existingIds.has(e.id))];
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
      showToast(getActiveCatalog().app.writeRollbackToast, 'danger');
      await triggerRefetch();
    }
  }

  async function setStructureLock(id: string, locked: boolean) {
    applyServerMutation(await patchTitleApi(id, { structureLocked: locked }));
  }
  async function resolveStructure(id: string, input: Parameters<typeof decideStructureApi>[1]) {
    applyServerMutation(await decideStructureApi(id, input));
  }
  async function changeTitleSource(id: string, input: Parameters<typeof changeTitleSourceApi>[1]) {
    applyServerMutation(await changeTitleSourceApi(id, input));
  }

  return {
    setStructureLock,
    resolveStructure,
    changeTitleSource,
    fetchAndCacheTitleRatings,
    refreshTitleMetadata,
    refreshAllTmdbMetadata,
    refreshLinkTitlePlaylist,
    removeTitle,
  };
}
