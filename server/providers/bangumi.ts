import { toTmdbSearchItem } from './tmdbSearchItem.ts';
import type { LinkImportResult, TmdbSearchItem } from '../../src/domain/types.ts';
import { isTmdbConfigured, searchTmdb } from './tmdb.ts';

export async function suggestBangumiMatches(
  result: LinkImportResult,
  search?: (query: string) => Promise<TmdbSearchItem[]>,
): Promise<LinkImportResult> {
  if (result.kind !== 'tmdb-suggestion') return result;
  const lookup =
    search ??
    (isTmdbConfigured()
      ? async (query: string) => (await searchTmdb(query)).map((item) => toTmdbSearchItem(item))
      : undefined);
  let matches: TmdbSearchItem[] = [];
  try {
    matches = lookup ? await lookup(result.seriesTitle || result.title) : [];
  } catch {
    /* A missing TMDB result must not block a Bilibili-only work. */
  }
  return matches.length
    ? { ...result, tmdbMatches: matches }
    : { ...result, kind: result.episodes.length ? 'playlist' : 'video' };
}
