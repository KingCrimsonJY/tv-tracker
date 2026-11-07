import type { LinkImportResult, StateMutationResult } from '../../src/domain/types.ts';
import { normalizeLocalizedEpisodeName } from '../../src/domain/progress.ts';
import { getTitle } from './titlesRepo.ts';
import { readSeasons, writeMetadata } from './metadataRepo.ts';
import type { DbContext } from './types.ts';

export function fillEpisodeMetadata(ctx: DbContext, id: string, sourceUrl: string, videoId: string, detail: LinkImportResult): StateMutationResult | null {
  return ctx.runInTransaction(() => {
    const title = getTitle(ctx, id);
    if (!title || title.source !== 'url' || title.sourceId !== sourceUrl || title.sourceUnavailable) return null;
    const seasons = readSeasons(ctx, id);
    let changed = false;
    for (const season of seasons) for (const ep of season.episodes) {
      if (ep.sourceVideoId !== videoId) continue;
      if (!ep.name) {
        const name = normalizeLocalizedEpisodeName({ zh: detail.title, en: detail.title });
        if (name) { ep.name = name; changed = true; }
      }
      if (ep.runtime == null && detail.runtimeMin != null) { ep.runtime = detail.runtimeMin; changed = true; }
    }
    if (!changed) return null;
    return writeMetadata(ctx, { ...title, updatedAt: Date.now() }, seasons);
  });
}
