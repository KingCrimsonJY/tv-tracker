import type { z } from 'zod';
import type { TitleDoc } from '../../src/domain/types.ts';
import { tmdbImagePath } from './tmdbClient.ts';
import { tmdbImageItemSchema } from './tmdbSchemas.ts';

type TmdbImageItem = z.infer<typeof tmdbImageItemSchema>;

function compareByVotesDesc(a: TmdbImageItem, b: TmdbImageItem): number {
  const va = a.vote_average ?? 0;
  const vb = b.vote_average ?? 0;
  if (vb !== va) return vb - va;
  return (b.vote_count ?? 0) - (a.vote_count ?? 0);
}

export function selectBestTmdbImages(
  images: { posters?: TmdbImageItem[]; backdrops?: TmdbImageItem[] } | undefined,
  fallbacks: {
    zhPosterPath?: string | null;
    enPosterPath?: string | null;
    backdropPath?: string | null;
  },
): {
  posters: NonNullable<TitleDoc['posters']>;
  defaultPosterPath: string | null;
  backdropPath: string | null;
} {
  const postersList = images?.posters ?? [];
  const backdropsList = images?.backdrops ?? [];

  // Best zh poster: prefer CN/SG when present, then by vote_average desc
  const zhCandidates = postersList.filter((p) => p.iso_639_1 === 'zh');
  const zhCnSg = zhCandidates.filter((p) => p.iso_3166_1 === 'CN' || p.iso_3166_1 === 'SG');
  const bestZhItem =
    (zhCnSg.length > 0 ? [...zhCnSg].sort(compareByVotesDesc)[0] : [...zhCandidates].sort(compareByVotesDesc)[0]) ??
    null;

  // Best en poster: by vote_average desc
  const enCandidates = postersList.filter((p) => p.iso_639_1 === 'en');
  const bestEnItem = [...enCandidates].sort(compareByVotesDesc)[0] ?? null;

  // Best textless (iso_639_1: null) poster: by vote_average desc
  const textlessCandidates = postersList.filter(
    (p) => p.iso_639_1 === null || p.iso_639_1 === undefined || p.iso_639_1 === 'xx',
  );
  const bestTextlessItem = [...textlessCandidates].sort(compareByVotesDesc)[0] ?? null;

  const zhPoster = tmdbImagePath(bestZhItem?.file_path ?? null);
  const enPoster = tmdbImagePath(bestEnItem?.file_path ?? null);
  const textlessPoster = tmdbImagePath(bestTextlessItem?.file_path ?? null);

  const posters: NonNullable<TitleDoc['posters']> = {
    ...(zhPoster ? { zh: zhPoster } : {}),
    ...(enPoster ? { en: enPoster } : {}),
    ...(textlessPoster ? { textless: textlessPoster } : {}),
  };

  const defaultPosterPath =
    zhPoster || textlessPoster || enPoster || tmdbImagePath(fallbacks.zhPosterPath || fallbacks.enPosterPath);

  // Backdrops: prefer textless (iso_639_1: null), then highest voted, then fallback
  const textlessBackdrops = backdropsList.filter(
    (b) => b.iso_639_1 === null || b.iso_639_1 === undefined || b.iso_639_1 === 'xx',
  );
  const bestBackdropItem =
    (textlessBackdrops.length > 0
      ? [...textlessBackdrops].sort(compareByVotesDesc)[0]
      : [...backdropsList].sort(compareByVotesDesc)[0]) ?? null;

  const backdropPath = tmdbImagePath(bestBackdropItem?.file_path ?? fallbacks.backdropPath ?? null);

  return {
    posters,
    defaultPosterPath,
    backdropPath,
  };
}
