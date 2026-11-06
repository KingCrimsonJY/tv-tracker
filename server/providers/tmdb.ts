import { z } from 'zod';
import {
  makeEpisodeKey,
  normalizeLocalizedEpisodeName,
  normalizeLocalizedSeasonName,
} from '../../src/domain/progress.ts';
import { extractGenreIdsFromNames } from '../../src/domain/genres.ts';
import type { EpisodeMeta, Ratings, SeasonDoc, TitleDoc } from '../../src/domain/types.ts';
import { en } from '../../src/i18n/messages/en.ts';
import { zhCN } from '../../src/i18n/messages/zh-CN.ts';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p';
const TMDB_TIMEOUT_MS = 10_000;

const tmdbSearchItemSchema = z.object({
  id: z.number(),
  media_type: z.string().optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  original_title: z.string().optional(),
  original_name: z.string().optional(),
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  overview: z.string().optional(),
});

const tmdbSearchResponseSchema = z.object({
  results: z.array(tmdbSearchItemSchema).optional(),
});

const tmdbTranslationItemSchema = z.object({
  iso_639_1: z.string().optional(),
  iso_3166_1: z.string().optional(),
  data: z
    .object({
      title: z.string().optional(),
      name: z.string().optional(),
      overview: z.string().optional(),
    })
    .optional(),
});

const tmdbImageItemSchema = z.object({
  file_path: z.string(),
  iso_639_1: z.string().nullable().optional(),
  iso_3166_1: z.string().nullable().optional(),
  vote_average: z.number().optional(),
  vote_count: z.number().optional(),
});

const tmdbDetailResponseSchema = z.object({
  id: z.number().optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  original_title: z.string().optional(),
  original_name: z.string().optional(),
  overview: z.string().optional(),
  release_date: z.string().optional(),
  first_air_date: z.string().optional(),
  runtime: z.number().nullable().optional(),
  episode_run_time: z.array(z.number()).optional(),
  genres: z.array(z.object({ id: z.number().optional(), name: z.string() })).optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  vote_average: z.number().nullable().optional(),
  vote_count: z.number().int().nullable().optional(),
  external_ids: z.object({ imdb_id: z.string().nullable().optional() }).optional(),
  translations: z.object({ translations: z.array(tmdbTranslationItemSchema).optional() }).optional(),
  images: z
    .object({
      posters: z.array(tmdbImageItemSchema).optional(),
      backdrops: z.array(tmdbImageItemSchema).optional(),
    })
    .optional(),
  seasons: z
    .array(z.object({ season_number: z.number(), name: z.string().optional() }))
    .optional(),
});

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
  }
): {
  posters: NonNullable<TitleDoc['posters']>;
  defaultPosterPath: string | null;
  backdropPath: string | null;
} {
  const postersList = images?.posters ?? [];
  const backdropsList = images?.backdrops ?? [];

  // Best zh poster: prefer CN/SG when present, then by vote_average desc
  const zhCandidates = postersList.filter((p) => p.iso_639_1 === 'zh');
  const zhCnSg = zhCandidates.filter(
    (p) => p.iso_3166_1 === 'CN' || p.iso_3166_1 === 'SG'
  );
  const bestZhItem =
    (zhCnSg.length > 0
      ? [...zhCnSg].sort(compareByVotesDesc)[0]
      : [...zhCandidates].sort(compareByVotesDesc)[0]) ?? null;

  // Best en poster: by vote_average desc
  const enCandidates = postersList.filter((p) => p.iso_639_1 === 'en');
  const bestEnItem = [...enCandidates].sort(compareByVotesDesc)[0] ?? null;

  // Best textless (iso_639_1: null) poster: by vote_average desc
  const textlessCandidates = postersList.filter(
    (p) => p.iso_639_1 === null || p.iso_639_1 === undefined || p.iso_639_1 === 'xx'
  );
  const bestTextlessItem = [...textlessCandidates].sort(compareByVotesDesc)[0] ?? null;

  const zhPoster = tmdbImageUrl(
    bestZhItem?.file_path ?? fallbacks.zhPosterPath ?? null,
    'w500'
  );
  const enPoster = tmdbImageUrl(
    bestEnItem?.file_path ?? fallbacks.enPosterPath ?? null,
    'w500'
  );
  const textlessPoster = tmdbImageUrl(bestTextlessItem?.file_path ?? null, 'w500');

  const posters: NonNullable<TitleDoc['posters']> = {
    ...(zhPoster ? { zh: zhPoster } : {}),
    ...(enPoster ? { en: enPoster } : {}),
    ...(textlessPoster ? { textless: textlessPoster } : {}),
  };

  const defaultPosterPath =
    zhPoster ||
    textlessPoster ||
    enPoster ||
    tmdbImageUrl(fallbacks.zhPosterPath || fallbacks.enPosterPath, 'w500');

  // Backdrops: prefer textless (iso_639_1: null), then highest voted, then fallback
  const textlessBackdrops = backdropsList.filter(
    (b) => b.iso_639_1 === null || b.iso_639_1 === undefined || b.iso_639_1 === 'xx'
  );
  const bestBackdropItem =
    (textlessBackdrops.length > 0
      ? [...textlessBackdrops].sort(compareByVotesDesc)[0]
      : [...backdropsList].sort(compareByVotesDesc)[0]) ?? null;

  const backdropPath = tmdbImageUrl(
    bestBackdropItem?.file_path ?? fallbacks.backdropPath ?? null,
    'w1280'
  );

  return {
    posters,
    defaultPosterPath,
    backdropPath,
  };
}

const tmdbSeasonResponseSchema = z.object({
  name: z.string().optional(),
  episodes: z
    .array(
      z.object({
        episode_number: z.number(),
        name: z.string().optional(),
        air_date: z.string().nullable().optional(),
        runtime: z.number().nullable().optional(),
        still_path: z.string().nullable().optional(),
        overview: z.string().optional(),
      })
    )
    .optional(),
});

const tmdbGenreListResponseSchema = z.object({
  genres: z.array(z.object({ id: z.number(), name: z.string() })).optional(),
});

export interface TmdbFetchOptions {
  fetchFn?: typeof fetch;
}

export function getOmdbKey(): string {
  const raw = (process.env.OMDB_API_KEY || '').trim().replace(/^['"]|['"]$/g, '').trim();
  if (
    !raw ||
    raw.startsWith('MY_') ||
    raw.startsWith('YOUR_') ||
    raw === 'undefined' ||
    raw === 'null'
  ) {
    return '';
  }
  return raw;
}

export function getTmdbToken(): string {
  const raw = (process.env.TMDB_READ_TOKEN || process.env.TMDB_API_KEY || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (
    !raw ||
    raw.startsWith('MY_') ||
    raw.startsWith('YOUR_') ||
    raw.startsWith('<') ||
    raw === 'undefined' ||
    raw === 'null'
  ) {
    return '';
  }
  return raw;
}

export function isTmdbConfigured(): boolean {
  return Boolean(getTmdbToken());
}

export function tmdbImageUrl(
  filePath: string | null | undefined,
  size: 'w300' | 'w342' | 'w500' | 'w1280'
): string | null {
  if (!filePath) return null;
  if (filePath.startsWith('http') || filePath.startsWith('data:')) return filePath;
  return `${TMDB_IMG_BASE}/${size}${filePath}`;
}

async function fetchTmdbRawJson(
  endpoint: string,
  params: Record<string, string> = {},
  fetchFn: typeof fetch = fetch
): Promise<unknown> {
  const token = getTmdbToken();
  if (!token) throw new Error('TMDB_READ_TOKEN_NOT_CONFIGURED');

  const isV3ApiKey = /^[a-f0-9]{32}$/i.test(token);
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  if (isV3ApiKey) {
    url.searchParams.set('api_key', token);
    const res = await fetchFn(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`TMDB HTTP ${res.status}: ${await res.text()}`);
    return await res.json();
  }

  const res = await fetchFn(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
  });

  if (res.status === 401) {
    const fallbackUrl = new URL(url.toString());
    fallbackUrl.searchParams.set('api_key', token);
    const retryRes = await fetchFn(fallbackUrl.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
    });
    if (retryRes.ok) return await retryRes.json();
  }

  if (!res.ok) throw new Error(`TMDB HTTP ${res.status}: ${await res.text()}`);
  return await res.json();
}

let cachedGenres: {
  fetchedAt: number;
  zh: Record<number, string>;
  en: Record<number, string>;
} | null = null;

export async function fetchTmdbGenres(
  options: TmdbFetchOptions = {}
): Promise<{ zh: Record<number, string>; en: Record<number, string> }> {
  const now = Date.now();
  if (cachedGenres && now - cachedGenres.fetchedAt < 24 * 60 * 60 * 1000) {
    return { zh: cachedGenres.zh, en: cachedGenres.en };
  }

  const zhMap: Record<number, string> = { ...zhCN.genres };
  const enMap: Record<number, string> = { ...en.genres };

  if (isTmdbConfigured()) {
    try {
      const fetchFn = options.fetchFn || fetch;
      const [movieZh, tvZh, movieEn, tvEn] = await Promise.all([
        fetchTmdbRawJson('/genre/movie/list', { language: 'zh-CN' }, fetchFn).catch(() => null),
        fetchTmdbRawJson('/genre/tv/list', { language: 'zh-CN' }, fetchFn).catch(() => null),
        fetchTmdbRawJson('/genre/movie/list', { language: 'en-US' }, fetchFn).catch(() => null),
        fetchTmdbRawJson('/genre/tv/list', { language: 'en-US' }, fetchFn).catch(() => null),
      ]);

      for (const raw of [movieZh, tvZh]) {
        if (!raw) continue;
        const parsed = tmdbGenreListResponseSchema.safeParse(raw);
        if (parsed.success && parsed.data.genres) {
          for (const g of parsed.data.genres) {
            if (g.name) zhMap[g.id] = g.name;
          }
        }
      }

      for (const raw of [movieEn, tvEn]) {
        if (!raw) continue;
        const parsed = tmdbGenreListResponseSchema.safeParse(raw);
        if (parsed.success && parsed.data.genres) {
          for (const g of parsed.data.genres) {
            if (g.name) enMap[g.id] = g.name;
          }
        }
      }

      cachedGenres = { fetchedAt: now, zh: zhMap, en: enMap };
    } catch {
      // Fall back to static genre catalogs
    }
  }

  return { zh: zhMap, en: enMap };
}

export interface SearchResultDto {
  sourceId: string;
  mediaType: 'movie' | 'tv';
  names: { zh: string; en?: string; original: string };
  titleZh: string;
  titleEn?: string;
  titleOriginal: string;
  year: number | null;
  releaseDate: string | null;
  posterPath: string | null;
  posterUrl: string | null;
  overview: string;
}

export async function searchTmdb(
  query: string,
  lang: 'zh-CN' | 'en-US' = 'zh-CN',
  options: TmdbFetchOptions = {}
): Promise<SearchResultDto[]> {
  const fetchFn = options.fetchFn || fetch;
  const raw = await fetchTmdbRawJson(
    '/search/multi',
    {
      query,
      language: lang,
      include_adult: 'false',
      page: '1',
    },
    fetchFn
  );
  const data = tmdbSearchResponseSchema.parse(raw);

  return (data.results || [])
    .filter(
      (r): r is z.infer<typeof tmdbSearchItemSchema> & { media_type: 'movie' | 'tv' } =>
        r.media_type === 'movie' || r.media_type === 'tv'
    )
    .slice(0, 20)
    .map((r) => {
      const mediaType = r.media_type;
      const localizedTitle = (mediaType === 'movie' ? r.title : r.name) || '';
      const titleOriginal =
        (mediaType === 'movie' ? r.original_title : r.original_name) || localizedTitle;
      const dateStr = (mediaType === 'movie' ? r.release_date : r.first_air_date) || '';
      const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) || null : null;
      const posterPath = tmdbImageUrl(r.poster_path, 'w342');
      const resolvedLocalized = localizedTitle || titleOriginal;
      const isEn = lang === 'en-US';

      return {
        sourceId: String(r.id),
        mediaType,
        names: isEn
          ? { zh: resolvedLocalized, en: resolvedLocalized, original: titleOriginal }
          : { zh: resolvedLocalized, original: titleOriginal },
        titleZh: resolvedLocalized,
        ...(isEn ? { titleEn: resolvedLocalized } : {}),
        titleOriginal,
        year,
        releaseDate: dateStr || null,
        posterPath,
        posterUrl: posterPath,
        overview: r.overview || '',
      };
    });
}

export async function fetchTmdbTitleDetails(
  mediaType: 'movie' | 'tv',
  sourceId: string,
  options: TmdbFetchOptions = {}
): Promise<{ title: TitleDoc; seasons: SeasonDoc[] }> {
  const fetchFn = options.fetchFn || fetch;
  const [rawDetailZh, rawDetailEn] = await Promise.all([
    fetchTmdbRawJson(
      `/${mediaType}/${sourceId}`,
      {
        language: 'zh-CN',
        append_to_response: 'external_ids,translations,images',
        include_image_language: 'zh,en,null',
      },
      fetchFn
    ),
    fetchTmdbRawJson(
      `/${mediaType}/${sourceId}`,
      {
        language: 'en-US',
      },
      fetchFn
    ).catch(() => null),
  ]);

  const detail = tmdbDetailResponseSchema.parse(rawDetailZh);
  const detailEn = rawDetailEn ? tmdbDetailResponseSchema.safeParse(rawDetailEn).data : undefined;

  const translations = detail.translations?.translations || [];
  const enTrans =
    translations.find((t) => t.iso_639_1 === 'en' && t.iso_3166_1 === 'US') ||
    translations.find((t) => t.iso_639_1 === 'en');
  const zhTrans =
    translations.find(
      (t) => t.iso_639_1 === 'zh' && t.iso_3166_1 === 'CN' && (t.data?.title || t.data?.name)
    ) || translations.find((t) => t.iso_639_1 === 'zh' && (t.data?.title || t.data?.name));

  const originalName =
    (mediaType === 'movie' ? detail.original_title : detail.original_name) ||
    detail.title ||
    detail.name ||
    'Untitled';
  const primaryZh = (mediaType === 'movie' ? detail.title : detail.name) || '';
  const transZh = zhTrans?.data?.title || zhTrans?.data?.name || '';
  const zhName =
    primaryZh && primaryZh !== originalName
      ? primaryZh
      : transZh && transZh !== originalName
        ? transZh
        : primaryZh || originalName;

  const primaryEn = detailEn ? (mediaType === 'movie' ? detailEn.title : detailEn.name) || '' : '';
  const transEn = enTrans?.data?.title || enTrans?.data?.name || '';
  const enName = primaryEn || transEn || originalName;

  const zhOverview = detail.overview || zhTrans?.data?.overview || '';
  const enOverview = detailEn?.overview || enTrans?.data?.overview || '';

  const dateStr =
    (mediaType === 'movie'
      ? detail.release_date || detailEn?.release_date
      : detail.first_air_date || detailEn?.first_air_date) || '';
  const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) || null : null;
  const releaseDate = dateStr || null;

  const runtimeMin =
    mediaType === 'movie'
      ? detail.runtime || detailEn?.runtime || null
      : Array.isArray(detail.episode_run_time) && detail.episode_run_time.length > 0
        ? detail.episode_run_time[0] ?? null
        : Array.isArray(detailEn?.episode_run_time) && detailEn.episode_run_time.length > 0
          ? detailEn.episode_run_time[0] ?? null
          : null;

  const rawGenres = Array.isArray(detail.genres) ? detail.genres.slice(0, 6) : [];
  const genres: string[] = rawGenres.map((g) => g.name);
  const directGenreIds = rawGenres
    .map((g) => g.id)
    .filter((id): id is number => typeof id === 'number');
  const genreIds =
    directGenreIds.length > 0 ? directGenreIds : extractGenreIdsFromNames(genres);

  const now = Date.now();
  const titleId = `tmdb_${mediaType}_${sourceId}`;

  const initialRatings: Ratings = {};
  if (typeof detail.vote_average === 'number' && detail.vote_average > 0) {
    initialRatings.tmdb = detail.vote_average.toFixed(1);
    if (typeof detail.vote_count === 'number' && detail.vote_count >= 0) {
      initialRatings.tmdbVotes = detail.vote_count;
    }
  }

  const selectedImages = selectBestTmdbImages(detail.images, {
    zhPosterPath: detail.poster_path,
    enPosterPath: detailEn?.poster_path,
    backdropPath: detail.backdrop_path || detailEn?.backdrop_path,
  });

  const titleDoc: TitleDoc = {
    id: titleId,
    source: 'tmdb',
    sourceId,
    mediaType,
    names: { original: originalName, zh: zhName, en: enName },
    displayLang: null,
    year,
    releaseDate,
    runtimeMin,
    genres,
    genreIds,
    posterPath: selectedImages.defaultPosterPath,
    posters: selectedImages.posters,
    backdropPath: selectedImages.backdropPath,
    overview: { zh: zhOverview, en: enOverview },
    showStatus: (detail.status || detailEn?.status || null) as TitleDoc['showStatus'],
    externalIds: detail.external_ids?.imdb_id ? { imdb: detail.external_ids.imdb_id } : {},
    ratings: initialRatings,
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

  if (mediaType === 'tv' && Array.isArray(detail.seasons)) {
    const rawSeasons = detail.seasons.filter((s) => s.season_number >= 0);
    const enSeasonsList = detailEn?.seasons || [];
    const resolvedSeasons = await Promise.all(
      rawSeasons.map(async (s) => {
        try {
          const [rawSeasonZh, rawSeasonEn] = await Promise.all([
            fetchTmdbRawJson(
              `/tv/${sourceId}/season/${s.season_number}`,
              { language: 'zh-CN' },
              fetchFn
            ),
            fetchTmdbRawJson(
              `/tv/${sourceId}/season/${s.season_number}`,
              { language: 'en-US' },
              fetchFn
            ).catch(() => null),
          ]);
          const sDetailZh = tmdbSeasonResponseSchema.parse(rawSeasonZh);
          const sDetailEn = rawSeasonEn
            ? tmdbSeasonResponseSchema.safeParse(rawSeasonEn).data
            : undefined;

          type TmdbEpisodeItem = NonNullable<typeof sDetailZh.episodes>[number];
          const enEpisodesByNum = new Map<number, TmdbEpisodeItem>();
          if (sDetailEn?.episodes) {
            for (const epEn of sDetailEn.episodes) {
              enEpisodesByNum.set(epEn.episode_number, epEn);
            }
          }

          const episodes: EpisodeMeta[] = Array.isArray(sDetailZh.episodes)
            ? sDetailZh.episodes.map((epZh) => {
                const epEn = enEpisodesByNum.get(epZh.episode_number);
                const normalizedEpName = normalizeLocalizedEpisodeName({
                  zh: epZh.name,
                  en: epEn?.name,
                });
                const zhEpOverview = epZh.overview?.trim();
                const enEpOverview = epEn?.overview?.trim();
                return {
                  number: epZh.episode_number,
                  key: makeEpisodeKey(s.season_number, epZh.episode_number),
                  name: normalizedEpName,
                  airDate: epZh.air_date || epEn?.air_date || null,
                  runtime: epZh.runtime || epEn?.runtime || runtimeMin || null,
                  stillPath: tmdbImageUrl(epZh.still_path || epEn?.still_path, 'w300'),
                  overview: {
                    ...(zhEpOverview ? { zh: zhEpOverview } : {}),
                    ...(enEpOverview ? { en: enEpOverview } : {}),
                  },
                };
              })
            : [];

          const enSeasonSummary = enSeasonsList.find((es) => es.season_number === s.season_number);
          const normalizedSeasonName = normalizeLocalizedSeasonName({
            zh: sDetailZh.name || s.name,
            en: sDetailEn?.name || enSeasonSummary?.name,
          });

          return {
            seasonNumber: s.season_number,
            name: normalizedSeasonName,
            episodes,
          } satisfies SeasonDoc;
        } catch (err) {
          console.warn(`Failed to fetch season ${s.season_number}:`, err);
          return null;
        }
      })
    );
    for (const s of resolvedSeasons) {
      if (s) seasons.push(s);
    }
  }

  return { title: titleDoc, seasons };
}

export async function fetchCombinedRatings(params: {
  imdbId: string;
}): Promise<{ ratings: Ratings }> {
  const { imdbId } = params;
  const omdbKey = getOmdbKey();
  const ratings: Ratings = { fetchedAt: Date.now() };

  if (!omdbKey || !imdbId) {
    return { ratings };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const url = `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(omdbKey)}`;
    const omdbRes = await fetch(url, { signal: controller.signal });
    if (omdbRes.ok) {
      const data = (await omdbRes.json()) as {
        Response?: string;
        imdbRating?: string;
        imdbVotes?: string;
        Metascore?: string;
        Ratings?: Array<{ Source?: string; Value?: string }>;
      };
      if (data.Response !== 'False') {
        if (data.imdbRating && data.imdbRating !== 'N/A') ratings.imdb = data.imdbRating;
        if (data.imdbVotes && data.imdbVotes !== 'N/A') ratings.imdbVotes = data.imdbVotes;
        if (Array.isArray(data.Ratings)) {
          const rt = data.Ratings.find((r) => r.Source === 'Rotten Tomatoes');
          if (rt?.Value && rt.Value !== 'N/A') ratings.rottenTomatoes = rt.Value;
          const mc = data.Ratings.find((r) => r.Source === 'Metacritic');
          if (mc?.Value && mc.Value !== 'N/A') ratings.metacritic = mc.Value.replace(/\/100$/, '');
        }
        if (!ratings.metacritic && data.Metascore && data.Metascore !== 'N/A') {
          ratings.metacritic = data.Metascore;
        }
      }
    }
  } catch {
    // Ignore OMDb network errors
  } finally {
    clearTimeout(timeout);
  }

  return { ratings };
}
