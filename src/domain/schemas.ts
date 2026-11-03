import { z } from 'zod';
import type { AppSettingsDoc } from './types.ts';

export const DEFAULT_APP_SETTINGS: AppSettingsDoc = {
  defaultTitleLang: 'zh',
  includeSpecials: false,
  homeSections: [
    { id: 'continue_watching', enabled: true, rank: 'a0' },
    { id: 'new_episodes', enabled: true, rank: 'a1' },
    { id: 'pinned_lists', enabled: true, rank: 'a2' },
    { id: 'recently_added', enabled: false, rank: 'a3' },
    { id: 'watchlist', enabled: false, rank: 'a4' },
  ],
  theme: 'dark',
};

export const mediaSourceSchema = z.enum(['tmdb', 'url', 'custom']);
export const mediaTypeSchema = z.enum(['movie', 'tv', 'other']);
export const displayLangSchema = z.enum(['zh', 'original', 'en', 'custom']);
export const manualStateSchema = z.enum(['paused', 'dropped']).nullable();

export const localizedNamesSchema = z.object({
  original: z.string(),
  zh: z.string().optional(),
  en: z.string().optional(),
  custom: z.string().optional(),
});

export const localizedOverviewSchema = z.object({
  zh: z.string().optional(),
  en: z.string().optional(),
});

export const externalIdsSchema = z.object({
  imdb: z.string().optional(),
  douban: z.string().optional(),
});

export const ratingsSchema = z.object({
  imdb: z.string().optional(),
  imdbVotes: z.string().optional(),
  rottenTomatoes: z.string().optional(),
  metacritic: z.string().optional(),
  douban: z.string().optional(),
  fetchedAt: z.number().optional(),
});

export const playthroughSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().min(1),
  startedAt: z.number(),
  completedAt: z.number().optional(),
});

export const resumePointSchema = z.object({
  episodeKey: z.string().nullable(),
  seconds: z.number().min(0),
  updatedAt: z.number(),
});

export const titleDocSchema = z.object({
  id: z.string().min(1),
  source: mediaSourceSchema,
  sourceId: z.string().nullable(),
  mediaType: mediaTypeSchema,
  names: localizedNamesSchema,
  displayLang: displayLangSchema.nullable(),
  year: z.number().nullable(),
  runtimeMin: z.number().nullable(),
  genres: z.array(z.string()),
  posterPath: z.string().nullable(),
  backdropPath: z.string().nullable(),
  overview: localizedOverviewSchema,
  showStatus: z.string().nullable(),
  externalIds: externalIdsSchema,
  ratings: ratingsSchema,
  manualState: manualStateSchema,
  playthroughs: z.array(playthroughSchema).min(1),
  activePlaythroughId: z.string().min(1),
  resume: resumePointSchema.nullable(),
  metaFetchedAt: z.number().nullable(),
  addedAt: z.number(),
  updatedAt: z.number(),
  lastActivityAt: z.number(),
});

export const episodeMetaSchema = z.object({
  number: z.number().int(),
  key: z.string().min(1),
  name: z.string(),
  airDate: z.string().nullable(),
  runtime: z.number().nullable(),
  stillPath: z.string().nullable(),
  overview: localizedOverviewSchema,
});

export const seasonDocSchema = z.object({
  seasonNumber: z.number().int(),
  name: z.string(),
  episodes: z.array(episodeMetaSchema),
});

export const progressDataSchema = z.object({
  watched: z.record(z.string(), z.number()),
  movieWatchedAt: z.number().optional(),
});

export const progressDocSchema = z.object({
  playthroughId: z.string().min(1),
  watched: z.record(z.string(), z.number()),
  movieWatchedAt: z.number().optional(),
});

export const listKindSchema = z.enum(['ordered', 'collection']);
export const collectionSortSchema = z.enum(['added', 'name', 'year', 'rating', 'manual']);

export const watchListDocSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  kind: listKindSchema,
  description: z.string().optional(),
  pinned: z.boolean(),
  rank: z.string().min(1),
  collectionSort: collectionSortSchema,
  createdAt: z.number(),
});

export const listEntryDocSchema = z.object({
  id: z.string().min(1),
  titleId: z.string().min(1),
  rank: z.string().min(1),
  note: z.string().optional(),
  addedAt: z.number(),
});

export const homeSectionIdSchema = z.enum([
  'continue_watching',
  'new_episodes',
  'pinned_lists',
  'recently_added',
  'watchlist',
]);

export const homeSectionConfigSchema = z.object({
  id: homeSectionIdSchema,
  enabled: z.boolean(),
  rank: z.string().min(1),
});

export const appSettingsDocSchema = z.object({
  defaultTitleLang: z.enum(['zh', 'original', 'en']),
  includeSpecials: z.boolean(),
  homeSections: z.array(homeSectionConfigSchema),
  theme: z.enum(['dark', 'light', 'system']),
});

// Route request schemas
export const authSetupRequestSchema = z.object({
  password: z.string().min(10, '密码长度至少为 10 个字符').max(256),
  setupCode: z.string().min(1, '请输入设置码'),
});

export const authPasswordRequestSchema = z.object({
  password: z.string().min(1, '密码不能为空').max(256),
});

export const putTitleRequestSchema = z.union([
  z.object({
    title: titleDocSchema,
    seasons: z.array(seasonDocSchema).optional(),
    progress: z.union([progressDocSchema, z.record(z.string(), progressDocSchema)]).optional(),
  }),
  titleDocSchema.extend({
    seasons: z.array(seasonDocSchema).optional(),
    progress: z.union([progressDocSchema, z.record(z.string(), progressDocSchema)]).optional(),
  }),
]);

export const patchTitleRequestSchema = titleDocSchema
  .omit({ id: true })
  .partial()
  .refine((val) => Object.keys(val).length > 0, { message: '至少需要更新一个字段' });

export const putSeasonsRequestSchema = z.union([
  z.object({
    seasons: z.array(seasonDocSchema),
  }),
  z.array(seasonDocSchema),
]);

export const putProgressRequestSchema = z.object({
  playthroughId: z.string().optional(),
  watched: z.record(z.string(), z.number()),
  movieWatchedAt: z.number().optional(),
});

export const patchProgressRequestSchema = z.object({
  set: z.record(z.string(), z.number()).optional(),
  unset: z.array(z.string()).optional(),
  movieWatchedAt: z.number().nullable().optional(),
});

export const titleAtomicActionRequestSchema = z
  .object({
    progress: z
      .object({
        playthroughId: z.string().min(1).optional(),
        set: z.record(z.string(), z.number()).optional(),
        unset: z.array(z.string()).optional(),
        movieWatchedAt: z.number().nullable().optional(),
        replaceWatched: z.record(z.string(), z.number()).optional(),
        deletePlaythroughId: z.string().min(1).optional(),
      })
      .refine((p) => Boolean(p.playthroughId || p.deletePlaythroughId), {
        message: 'progress 需指定 playthroughId 或 deletePlaythroughId',
      })
      .optional(),
    title: titleDocSchema
      .omit({ id: true })
      .partial()
      .refine((val) => Object.keys(val).length > 0, { message: 'title 至少需要更新一个字段' })
      .optional(),
  })
  .refine((val) => Boolean(val.progress || val.title), {
    message: '至少需要提供 progress 或 title 更新',
  });

export const putListRequestSchema = watchListDocSchema.omit({ id: true }).extend({
  id: z.string().optional(),
});

export const patchListRequestSchema = watchListDocSchema
  .omit({ id: true })
  .partial()
  .refine((val) => Object.keys(val).length > 0, { message: '至少需要更新一个字段' });

export const putListEntryRequestSchema = listEntryDocSchema.omit({ id: true }).extend({
  id: z.string().optional(),
});

export const patchListEntryRequestSchema = listEntryDocSchema
  .omit({ id: true })
  .partial()
  .refine((val) => Object.keys(val).length > 0, { message: '至少需要更新一个字段' });

export const patchSettingsRequestSchema = appSettingsDocSchema
  .partial()
  .refine((val) => Object.keys(val).length > 0, { message: '至少需要更新一个字段' });

// Export / Import schemas (supports v2 and v1)
const baseExportDataFields = {
  exportedAt: z.string().optional(),
  settings: appSettingsDocSchema,
  titles: z.record(z.string(), titleDocSchema),
  seasonsByTitle: z.record(z.string(), z.array(seasonDocSchema)),
  progressByTitle: z.record(z.string(), z.record(z.string(), progressDocSchema)),
  lists: z.record(z.string(), watchListDocSchema),
  entriesByList: z.record(z.string(), z.array(listEntryDocSchema)),
};

export const exportV2Schema = z.object({
  ...baseExportDataFields,
  format: z.literal('zhenji-export'),
  version: z.literal(2),
  exportedAt: z.string(),
});

export const exportV1Schema = z.object({
  version: z.literal(1).optional(),
  ...baseExportDataFields,
});

export const importPayloadSchema = z.union([exportV2Schema, exportV1Schema]);
