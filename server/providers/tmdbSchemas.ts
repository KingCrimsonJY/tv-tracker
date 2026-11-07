import { z } from 'zod';

export const tmdbSearchItemSchema = z.object({
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

export const tmdbSearchResponseSchema = z.object({
  results: z.array(tmdbSearchItemSchema).optional(),
});

export const tmdbTranslationItemSchema = z.object({
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

export const tmdbImageItemSchema = z.object({
  file_path: z.string(),
  iso_639_1: z.string().nullable().optional(),
  iso_3166_1: z.string().nullable().optional(),
  vote_average: z.number().optional(),
  vote_count: z.number().optional(),
});

export const tmdbDetailResponseSchema = z.object({
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

export const tmdbSeasonResponseSchema = z.object({
  air_date: z.string().nullable().optional(),
  poster_path: z.string().nullable().optional(),
  name: z.string().optional(),
  episodes: z
    .array(
      z.object({
        id: z.number().int().positive().optional(),
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

export const tmdbGenreListResponseSchema = z.object({
  genres: z.array(z.object({ id: z.number(), name: z.string() })).optional(),
});
