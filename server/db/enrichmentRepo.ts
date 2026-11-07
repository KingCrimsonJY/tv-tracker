import type { LinkImportResult, StateMutationResult } from '../../src/domain/types.ts';
import { normalizeLocalizedEpisodeName } from '../../src/domain/progress.ts';
import { getTitle } from './titlesRepo.ts';
import { readSeasons, writeMetadata } from './metadataRepo.ts';
import type { DbContext } from './types.ts';

export function fillEpisodeMetadataBatch(
  ctx: DbContext,
  id: string,
  sourceUrl: string,
  entries: Array<{ videoId: string; detail: LinkImportResult }>,
): StateMutationResult | null {
  return ctx.runInTransaction(() => {
    const title = getTitle(ctx, id);
    if (!title || title.source !== 'url' || title.sourceId !== sourceUrl || title.sourceUnavailable) return null;
    const seasons = readSeasons(ctx, id);
    let changed = false;
    const details = new Map(entries.map((entry) => [entry.videoId, entry.detail]));
    for (const season of seasons)
      for (const ep of season.episodes) {
        const detail = ep.sourceVideoId ? details.get(ep.sourceVideoId) : undefined;
        if (!detail) continue;
        if (!ep.name) {
          const name = normalizeLocalizedEpisodeName({ zh: detail.title, en: detail.title });
          if (name) {
            ep.name = name;
            changed = true;
          }
        }
        if (ep.runtime == null && detail.runtimeMin != null) {
          ep.runtime = detail.runtimeMin;
          changed = true;
        }
      }
    if (!changed) return null;
    return writeMetadata(ctx, { ...title, updatedAt: Date.now() }, seasons);
  });
}

export function enrichmentDue(ctx: DbContext, id: string, sourceUrl: string, videoId: string, now: number): boolean {
  const row = ctx.db
    .prepare('SELECT next_attempt_at FROM enrichment_attempts WHERE title_id = ? AND source_url = ? AND video_id = ?')
    .get(id, sourceUrl, videoId) as { next_attempt_at: number } | undefined;
  return !row || row.next_attempt_at <= now;
}
/** Claim before network I/O. A restart or an incomplete success must also honor the backoff. */
export function claimEnrichment(ctx: DbContext, id: string, sourceUrl: string, videoId: string, now: number): boolean {
  return ctx.runInTransaction(() => {
    if (!getTitle(ctx, id) || !enrichmentDue(ctx, id, sourceUrl, videoId, now)) return false;
    const previous = ctx.db
      .prepare('SELECT attempts FROM enrichment_attempts WHERE title_id = ? AND source_url = ? AND video_id = ?')
      .get(id, sourceUrl, videoId) as { attempts: number } | undefined;
    const attempts = (previous?.attempts || 0) + 1;
    const delay = Math.min(7 * 86400_000, 3600_000 * 2 ** Math.min(attempts - 1, 8));
    ctx.db
      .prepare(
        'INSERT INTO enrichment_attempts (title_id, source_url, video_id, attempts, next_attempt_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(title_id, source_url, video_id) DO UPDATE SET attempts = excluded.attempts, next_attempt_at = excluded.next_attempt_at',
      )
      .run(id, sourceUrl, videoId, attempts, now + delay);
    return true;
  });
}
