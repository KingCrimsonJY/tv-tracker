import { z } from 'zod';
import { makeEpisodeKey } from '../../src/domain/progress.ts';
import type { EpisodeMeta, Ratings, SeasonDoc, TitleDoc } from '../../src/domain/types.ts';
import { lookupDoubanBestEffort } from './douban.ts';

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
  genres: z.array(z.object({ name: z.string() })).optional(),
  poster_path: z.string().nullable().optional(),
  backdrop_path: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  external_ids: z.object({ imdb_id: z.string().nullable().optional() }).optional(),
  translations: z.object({ translations: z.array(tmdbTranslationItemSchema).optional() }).optional(),
  seasons: z
    .array(z.object({ season_number: z.number(), name: z.string().optional() }))
    .optional(),
});

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
  params: Record<string, string> = {}
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
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`TMDB HTTP ${res.status}: ${await res.text()}`);
    return await res.json();
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
  });

  if (res.status === 401) {
    const fallbackUrl = new URL(url.toString());
    fallbackUrl.searchParams.set('api_key', token);
    const retryRes = await fetch(fallbackUrl.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
    });
    if (retryRes.ok) return await retryRes.json();
  }

  if (!res.ok) throw new Error(`TMDB HTTP ${res.status}: ${await res.text()}`);
  return await res.json();
}

export interface SearchResultDto {
  sourceId: string;
  mediaType: 'movie' | 'tv';
  titleZh: string;
  titleOriginal: string;
  year: number | null;
  posterUrl: string | null;
  overview: string;
}

export async function searchTmdb(query: string): Promise<SearchResultDto[]> {
  const raw = await fetchTmdbRawJson('/search/multi', {
    query,
    language: 'zh-CN',
    include_adult: 'false',
    page: '1',
  });
  const data = tmdbSearchResponseSchema.parse(raw);

  return (data.results || [])
    .filter(
      (r): r is z.infer<typeof tmdbSearchItemSchema> & { media_type: 'movie' | 'tv' } =>
        r.media_type === 'movie' || r.media_type === 'tv'
    )
    .slice(0, 20)
    .map((r) => {
      const mediaType = r.media_type;
      const titleZh = (mediaType === 'movie' ? r.title : r.name) || '';
      const titleOriginal =
        (mediaType === 'movie' ? r.original_title : r.original_name) || titleZh;
      const dateStr = (mediaType === 'movie' ? r.release_date : r.first_air_date) || '';
      const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) || null : null;

      return {
        sourceId: String(r.id),
        mediaType,
        titleZh: titleZh || titleOriginal,
        titleOriginal,
        year,
        posterUrl: tmdbImageUrl(r.poster_path, 'w342'),
        overview: r.overview || '',
      };
    });
}

export async function fetchTmdbTitleDetails(
  mediaType: 'movie' | 'tv',
  sourceId: string
): Promise<{ title: TitleDoc; seasons: SeasonDoc[] }> {
  const rawDetail = await fetchTmdbRawJson(`/${mediaType}/${sourceId}`, {
    language: 'zh-CN',
    append_to_response: 'external_ids,translations,images',
    include_image_language: 'zh,en,null',
  });
  const detail = tmdbDetailResponseSchema.parse(rawDetail);

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
  const primaryLocalized = (mediaType === 'movie' ? detail.title : detail.name) || '';
  const transLocalized = zhTrans?.data?.title || zhTrans?.data?.name || '';
  const zhName =
    primaryLocalized && primaryLocalized !== originalName
      ? primaryLocalized
      : transLocalized && transLocalized !== originalName
        ? transLocalized
        : primaryLocalized || originalName;
  const enName = enTrans?.data?.title || enTrans?.data?.name || originalName;

  const zhOverview = detail.overview || zhTrans?.data?.overview || '';
  const enOverview = enTrans?.data?.overview || '';

  const dateStr = (mediaType === 'movie' ? detail.release_date : detail.first_air_date) || '';
  const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) || null : null;

  const runtimeMin =
    mediaType === 'movie'
      ? detail.runtime || null
      : Array.isArray(detail.episode_run_time) && detail.episode_run_time.length > 0
        ? detail.episode_run_time[0] ?? null
        : null;

  const genres: string[] = Array.isArray(detail.genres)
    ? detail.genres.slice(0, 6).map((g) => g.name)
    : [];

  const now = Date.now();
  const titleId = `tmdb_${mediaType}_${sourceId}`;

  const titleDoc: TitleDoc = {
    id: titleId,
    source: 'tmdb',
    sourceId,
    mediaType,
    names: { original: originalName, zh: zhName, en: enName },
    displayLang: null,
    year,
    runtimeMin,
    genres,
    posterPath: tmdbImageUrl(detail.poster_path, 'w500'),
    backdropPath: tmdbImageUrl(detail.backdrop_path, 'w1280'),
    overview: { zh: zhOverview, en: enOverview },
    showStatus: detail.status || null,
    externalIds: detail.external_ids?.imdb_id ? { imdb: detail.external_ids.imdb_id } : {},
    ratings: {},
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
    const resolvedSeasons = await Promise.all(
      rawSeasons.map(async (s) => {
        try {
          const rawSeason = await fetchTmdbRawJson(
            `/tv/${sourceId}/season/${s.season_number}`,
            { language: 'zh-CN' }
          );
          const sDetail = tmdbSeasonResponseSchema.parse(rawSeason);
          const episodes: EpisodeMeta[] = Array.isArray(sDetail.episodes)
            ? sDetail.episodes.map((ep) => ({
                number: ep.episode_number,
                key: makeEpisodeKey(s.season_number, ep.episode_number),
                name: ep.name || `第 ${ep.episode_number} 集`,
                airDate: ep.air_date || null,
                runtime: ep.runtime || runtimeMin || null,
                stillPath: tmdbImageUrl(ep.still_path, 'w300'),
                overview: { zh: ep.overview || '' },
              }))
            : [];

          return {
            seasonNumber: s.season_number,
            name:
              sDetail.name ||
              s.name ||
              (s.season_number === 0 ? '特别篇' : `第 ${s.season_number} 季`),
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
  title: string;
  year: number | null;
  doubanId: string;
}): Promise<{ ratings: Ratings; externalIds: { douban?: string } }> {
  const { imdbId, title, year, doubanId } = params;
  const omdbKey = getOmdbKey();
  const ratings: Ratings = { fetchedAt: Date.now() };
  const externalIds: { douban?: string } = {};

  const omdbPromise = (async () => {
    if (!omdbKey || !imdbId) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const url = `https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(omdbKey)}`;
      const omdbRes = await fetch(url, { signal: controller.signal });
      if (!omdbRes.ok) return;
      const data = (await omdbRes.json()) as {
        Response?: string;
        imdbRating?: string;
        imdbVotes?: string;
        Metascore?: string;
        Ratings?: Array<{ Source?: string; Value?: string }>;
      };
      if (data.Response === 'False') return;
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
    } catch {
      // Ignore OMDb network errors
    } finally {
      clearTimeout(timeout);
    }
  })();

  const doubanPromise = (async () => {
    const dRes = await lookupDoubanBestEffort({ imdbId, title, year, doubanId });
    if (dRes.doubanId) externalIds.douban = dRes.doubanId;
    if (dRes.doubanRating) ratings.douban = dRes.doubanRating;
  })();

  await Promise.all([omdbPromise, doubanPromise]);
  return { ratings, externalIds };
}
