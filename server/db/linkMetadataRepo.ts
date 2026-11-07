import { normalizeLocalizedEpisodeName } from '../../src/domain/progress.ts';
import type { LinkImportEpisodeSeed, LinkImportResult, PlaylistRefreshResult, SeasonDoc } from '../../src/domain/types.ts';
import { refreshMetadata, readSeasons } from './metadataRepo.ts';
import { getTitle } from './titlesRepo.ts';
import { NotFoundError, type DbContext } from './types.ts';

export function appendPlaylistEpisodes(ctx: DbContext, id: string, episodes: LinkImportEpisodeSeed[], now = Date.now(), metadata?: LinkImportResult): PlaylistRefreshResult {
  const title = getTitle(ctx, id);
  if (!title) throw new NotFoundError('TITLE_NOT_FOUND');
  const local = readSeasons(ctx, id);
  const oldById = new Map(local.flatMap(s => s.episodes).flatMap(ep => ep.sourceVideoId ? [[ep.sourceVideoId, ep] as const] : []));
  const before = local.reduce((sum, season) => sum + season.episodes.length, 0);
  const unique = episodes.filter((ep, index) => !ep.sourceVideoId || episodes.findIndex(other => other.sourceVideoId === ep.sourceVideoId) === index);
  const seasons: SeasonDoc[] = unique.length ? [{ seasonNumber: 1, name: null, episodes: unique.map((ep, index) => ({
    number: index + 1, key: `s1e${index + 1}`, sourceVideoId: ep.sourceVideoId,
    name: normalizeLocalizedEpisodeName({ zh: ep.name || undefined, en: ep.name || undefined }),
    airDate: ep.airDate ?? null, runtime: ep.runtime ?? null, stillPath: null, overview: {},
  })) }] : [];
  for (const season of seasons) {
    for (const ep of season.episodes) {
      const previous = ep.sourceVideoId ? oldById.get(ep.sourceVideoId) : undefined;
      if (previous) { ep.name = previous.name || ep.name; ep.runtime = previous.runtime ?? ep.runtime; ep.airDate = previous.airDate ?? ep.airDate; }
    }
  }
  const incoming = metadata ? { ...title, names: { ...title.names, original: metadata.title, zh: metadata.title, en: metadata.title },
    year: metadata.year, runtimeMin: metadata.runtimeMin, posterPath: metadata.posterUrl,
    overview: { zh: metadata.overview, en: metadata.overview },
  } : { ...title };
  if (episodes.length && title.mediaType === 'movie' && metadata?.mediaType !== 'movie') incoming.mediaType = 'other';
  const result = refreshMetadata(ctx, id, { title: incoming, seasons,
    failedSeasons: !metadata || metadata.warning ? [1] : [],
  }, now);
  const after = result.upserts.seasonsByTitle?.[id]?.reduce((sum, season) => sum + season.episodes.length, 0) ?? before;
  return { ...result, addedCount: Math.max(0, after - before) };
}
