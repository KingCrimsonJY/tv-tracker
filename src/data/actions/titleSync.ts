import type { Ratings, MetadataRefreshStatus, MetadataRefreshCounts } from '../../domain/types.ts';
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
import { patchTitle, removeTitles } from '../overlays.ts';
import type { Commit } from './commit.ts';
import type { TrackerActionDeps } from './types.ts';

export function createTitleSyncActions(
  { getState, applyServerMutation, showToast }: TrackerActionDeps,
  { commit }: Commit,
) {
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
      const patch = {
        ratings: {
          ...latest.ratings,
          ...(data.ratings?.imdb ? { imdb: data.ratings.imdb } : {}),
          ...(data.ratings?.imdbVotes ? { imdbVotes: data.ratings.imdbVotes } : {}),
          ...(data.ratings?.rottenTomatoes ? { rottenTomatoes: data.ratings.rottenTomatoes } : {}),
          ...(data.ratings?.metacritic ? { metacritic: data.ratings.metacritic } : {}),
          fetchedAt: now,
        } satisfies Ratings,
        updatedAt: now,
      };
      await commit(patchTitle(titleId, patch), () => patchTitleApi(titleId, patch));
    } catch {
      // Ratings are a background nicety; a failed lookup is not worth interrupting the user.
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
    if (!getState().titles[titleId]) return;
    await commit(removeTitles([titleId]), () => deleteTitleApi(titleId));
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
