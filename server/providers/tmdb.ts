import type { z } from 'zod';
import {
  makeEpisodeKey,
  normalizeLocalizedEpisodeName,
  normalizeLocalizedSeasonName,
} from '../../src/domain/progress.ts';
import { extractGenreIdsFromNames } from '../../src/domain/genres.ts';
import type { EpisodeMeta, Ratings, SeasonDoc, TitleDoc, TmdbSearchItem } from '../../src/domain/types.ts';
import { en } from '../../src/i18n/messages/en.ts';
import { zhCN } from '../../src/i18n/messages/zh-CN.ts';

import {
  tmdbSearchItemSchema,
  tmdbSearchResponseSchema,
  tmdbGenreListResponseSchema,
  tmdbDetailResponseSchema,
  tmdbSeasonResponseSchema,
} from './tmdbSchemas.ts';
import { fetchTmdbRawJson, tmdbImagePath, getOmdbKey, isTmdbConfigured, type TmdbFetchOptions } from './tmdbClient.ts';
import { selectBestTmdbImages } from './tmdbImages.ts';
export {
  tmdbImagePath,
  getTmdbToken,
  isTmdbConfigured,
  TmdbRequestError,
  type TmdbFetchOptions,
} from './tmdbClient.ts';
export { selectBestTmdbImages } from './tmdbImages.ts';

let cachedGenres: {
  fetchedAt: number;
  zh: Record<number, string>;
  en: Record<number, string>;
} | null = null;

export async function fetchTmdbGenres(
  options: TmdbFetchOptions = {},
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

export async function searchTmdb(
  query: string,
  lang: 'zh-CN' | 'en-US' = 'zh-CN',
  options: TmdbFetchOptions = {},
): Promise<TmdbSearchItem[]> {
  const raw = await fetchTmdbRawJson(
    '/search/multi',
    { query, language: lang, include_adult: 'false', page: '1' },
    options.fetchFn || fetch,
  );
  const isEn = lang === 'en-US';
  return (tmdbSearchResponseSchema.parse(raw).results || [])
    .filter(
      (r): r is z.infer<typeof tmdbSearchItemSchema> & { media_type: 'movie' | 'tv' } =>
        r.media_type === 'movie' || r.media_type === 'tv',
    )
    .slice(0, 20)
    .map((r) => {
      const isMovie = r.media_type === 'movie';
      const original = (isMovie ? r.original_title : r.original_name) || (isMovie ? r.title : r.name) || '';
      const localized = (isMovie ? r.title : r.name) || original;
      const releaseDate = (isMovie ? r.release_date : r.first_air_date) || null;
      const sourceId = String(r.id);
      return {
        id: `tmdb_${r.media_type}_${sourceId}`,
        sourceId,
        mediaType: r.media_type,
        // Search returns one language: it fills the slot the client asked for.
        names: isEn ? { zh: localized, en: localized, original } : { zh: localized, original },
        year: releaseDate ? parseInt(releaseDate.slice(0, 4), 10) || null : null,
        releaseDate,
        posterPath: tmdbImagePath(r.poster_path),
        backdropPath: null,
        overview: isEn ? { en: r.overview || '' } : { zh: r.overview || '' },
      };
    });
}

export async function fetchTmdbTitleDetails(
  mediaType: 'movie' | 'tv',
  sourceId: string,
  options: TmdbFetchOptions = {},
): Promise<import('../../src/domain/types.ts').TmdbDetails> {
  const fetchFn = options.fetchFn || fetch;
  const [rawDetailZh, rawDetailEn] = await Promise.all([
    fetchTmdbRawJson(
      `/${mediaType}/${sourceId}`,
      {
        language: 'zh-CN',
        append_to_response: 'external_ids,translations,images',
        include_image_language: 'zh,en,null',
      },
      fetchFn,
    ),
    fetchTmdbRawJson(
      `/${mediaType}/${sourceId}`,
      {
        language: 'en-US',
      },
      fetchFn,
    ).catch(() => null),
  ]);

  const detail = tmdbDetailResponseSchema.parse(rawDetailZh);
  const detailEn = rawDetailEn ? tmdbDetailResponseSchema.safeParse(rawDetailEn).data : undefined;

  const translations = detail.translations?.translations || [];
  const enTrans =
    translations.find((t) => t.iso_639_1 === 'en' && t.iso_3166_1 === 'US') ||
    translations.find((t) => t.iso_639_1 === 'en');
  // Simplified Chinese first, then the other Chinese editions in order of how close they read to it.
  const zhTrans = ['CN', 'SG', 'HK', 'TW']
    .map((region) =>
      translations.find(
        (t) => t.iso_639_1 === 'zh' && t.iso_3166_1 === region && Boolean(t.data?.title || t.data?.name),
      ),
    )
    .find(Boolean);

  const originalName =
    (mediaType === 'movie' ? detail.original_title : detail.original_name) || detail.title || detail.name || 'Untitled';
  const primaryZh = (mediaType === 'movie' ? detail.title : detail.name) || '';
  const transZh = zhTrans?.data?.title || zhTrans?.data?.name || '';
  // Without a zh-CN title TMDB answers with the original one. For a foreign work another Chinese edition is
  // then the better name; for a work whose original language is Chinese, the original already is the name.
  const originalIsChinese = /^(?:zh|cn)$/i.test(detail.original_language ?? '');
  const zhName =
    primaryZh && (primaryZh !== originalName || originalIsChinese)
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
        ? (detail.episode_run_time[0] ?? null)
        : Array.isArray(detailEn?.episode_run_time) && detailEn.episode_run_time.length > 0
          ? (detailEn.episode_run_time[0] ?? null)
          : null;

  const rawGenres = Array.isArray(detail.genres) ? detail.genres.slice(0, 6) : [];
  const genres: string[] = rawGenres.map((g) => g.name);
  const directGenreIds = rawGenres.map((g) => g.id).filter((id): id is number => typeof id === 'number');
  const genreIds = directGenreIds.length > 0 ? directGenreIds : extractGenreIdsFromNames(genres);

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
  const failedSeasons: number[] = [];

  if (mediaType === 'tv' && Array.isArray(detail.seasons)) {
    const rawSeasons = detail.seasons.filter((s) => s.season_number >= 0);
    const enSeasonsList = detailEn?.seasons || [];
    const resolvedSeasons = await Promise.all(
      rawSeasons.map(async (s) => {
        try {
          const [rawSeasonZh, rawSeasonEn] = await Promise.all([
            fetchTmdbRawJson(`/tv/${sourceId}/season/${s.season_number}`, { language: 'zh-CN' }, fetchFn),
            fetchTmdbRawJson(`/tv/${sourceId}/season/${s.season_number}`, { language: 'en-US' }, fetchFn).catch(
              () => null,
            ),
          ]);
          const sDetailZh = tmdbSeasonResponseSchema.parse(rawSeasonZh);
          const sDetailEn = rawSeasonEn ? tmdbSeasonResponseSchema.safeParse(rawSeasonEn).data : undefined;

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
                  tmdbEpisodeId: epZh.id,
                  number: epZh.episode_number,
                  key: makeEpisodeKey(s.season_number, epZh.episode_number),
                  name: normalizedEpName,
                  airDate: epZh.air_date || epEn?.air_date || null,
                  runtime: epZh.runtime || epEn?.runtime || runtimeMin || null,
                  stillPath: tmdbImagePath(epZh.still_path || epEn?.still_path),
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
            airDate: sDetailZh.air_date || sDetailEn?.air_date || null,
            posterPath: tmdbImagePath(sDetailZh.poster_path || sDetailEn?.poster_path),
            episodes,
          } satisfies SeasonDoc;
        } catch (err) {
          failedSeasons.push(s.season_number);
          console.warn(`Failed to fetch season ${s.season_number}:`, err);
          return null;
        }
      }),
    );
    for (const s of resolvedSeasons) {
      if (s) seasons.push(s);
    }
  }

  return { title: titleDoc, seasons, failedSeasons };
}

export async function fetchCombinedRatings(params: { imdbId: string }): Promise<{ ratings: Ratings }> {
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
