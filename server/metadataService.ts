import type { MetadataRefreshResult, TmdbDetails } from '../src/domain/types.ts';
import { NotFoundError, type TrackerRepository } from './db/repository.ts';
import { fetchTmdbTitleDetails, isTmdbConfigured, TmdbRequestError } from './providers/tmdb.ts';

export async function refreshTmdbTitle(repo: TrackerRepository, id: string, options: {
  configured?: boolean;
  fetchDetails?: (type: 'movie' | 'tv', id: string) => Promise<TmdbDetails>;
  now?: number;
} = {}): Promise<MetadataRefreshResult> {
  const title = repo.getTitle(id);
  if (!title) throw new NotFoundError('TITLE_NOT_FOUND');
  const empty = { version: repo.getVersion(), upserts: {}, deletes: {} };
  if (title.source !== 'tmdb' || !title.sourceId || title.mediaType === 'other' || title.sourceUnavailable) {
    return { ...empty, status: 'skipped' };
  }
  if (!(options.configured ?? isTmdbConfigured())) return { ...empty, status: 'failed' };
  const now = options.now ?? Date.now();
  try {
    const data = await (options.fetchDetails ?? fetchTmdbTitleDetails)(title.mediaType, title.sourceId);
    const result = repo.refreshMetadata(id, data, now);
    return { ...result, status: data.failedSeasons?.length || result.upserts.titles?.[id]?.upstreamChange ? 'partial' : 'updated' };
  } catch (error) {
    if (error instanceof TmdbRequestError && (error.status === 404 || error.status === 410)) {
      // Do not mark a title that was deleted or re-linked while this request was running.
      const latest = repo.getTitle(id);
      if (latest?.source === title.source && latest.sourceId === title.sourceId) {
        return { ...repo.patchTitle(id, { sourceUnavailable: true, updatedAt: now }), status: 'failed' };
      }
    }
    return { version: repo.getVersion(), upserts: {}, deletes: {}, status: 'failed' };
  }
}
