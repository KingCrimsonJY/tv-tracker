import { z } from 'zod';
import {
  normalizeLocalizedEpisodeName,
  normalizeLocalizedSeasonName,
} from './airing.ts';
import type {
  AppSettingsDoc,
  EpisodeMeta,
  HomeSectionConfig,
  ListEntryDoc,
  LocalizedPosters,
  LocalizedText,
  Playthrough,
  ProgressDoc,
  RatingsBlock,
  ResumePoint,
  SeasonDoc,
  TitleAtomicActionInput,
  TitleDoc,
  TitleNames,
  WatchListDoc,
} from './types.ts';

export const mediaTypeSchema = z.enum(['movie', 'tv', 'other']);
export const titleSourceSchema = z.enum(['tmdb', 'url', 'custom']);
export const displayLangSchema = z.enum(['zh', 'original', 'en', 'custom']).nullable();
export const uiLangSettingSchema = z.enum(['system', 'zh-CN', 'en']);
export const defaultTitleLangSchema = z.enum(['auto', 'zh', 'original', 'en']).nullable();
export const showStatusSchema = z
  .enum([
    'Returning Series',
    'Ended',
    'Canceled',
    'In Production',
    'Planned',
    'Released',
  ])
  .nullable();
export const manualStateSchema = z.enum(['paused', 'dropped']).nullable();

export const localizedTextSchema: z.ZodType<LocalizedText> = z.object({
  zh: z.string().optional(),
  en: z.string().optional(),
});

export const localizedPostersSchema: z.ZodType<LocalizedPosters> = z.object({
  zh: z.string().nullable().optional(),
  en: z.string().nullable().optional(),
  textless: z.string().nullable().optional(),
});

export const localizedSeasonNameSchema: z.ZodType<LocalizedText | null> = z
  .union([localizedTextSchema, z.string(), z.null(), z.undefined()])
  .transform((val) => normalizeLocalizedSeasonName(val));

export const localizedEpisodeNameSchema: z.ZodType<LocalizedText | null> = z
  .union([localizedTextSchema, z.string(), z.null(), z.undefined()])
  .transform((val) => normalizeLocalizedEpisodeName(val));

export const playthroughSchema: z.ZodType<Playthrough> = z.object({
  id: z.string().min(1),
  number: z.number().int().min(1),
  startedAt: z.number().nonnegative(),
  completedAt: z.number().nonnegative().optional(),
});

export const resumePointSchema: z.ZodType<ResumePoint> = z.object({
  episodeKey: z.string().min(1).nullable(),
  seconds: z.number().min(0),
  updatedAt: z.number().nonnegative(),
});

export const ratingsBlockSchema: z.ZodType<RatingsBlock> = z.object({
  tmdb: z.string().optional(),
  tmdbVotes: z.number().nonnegative().optional(),
  imdb: z.string().optional(),
  imdbVotes: z.string().optional(),
  rottenTomatoes: z.string().optional(),
  metacritic: z.string().optional(),
  fetchedAt: z.number().nonnegative().optional(),
});

export const titleNamesSchema: z.ZodType<TitleNames> = z.object({
  original: z.string().min(1),
  zh: z.string().optional(),
  en: z.string().optional(),
  custom: z.string().optional(),
});

export const externalIdsSchema = z.object({
  imdb: z.string().optional(),
  tvdb: z.string().optional(),
});

export const overviewSchema = localizedTextSchema;

const baseTitleFields = {
  source: titleSourceSchema,
  sourceId: z.string().nullable(),
  mediaType: mediaTypeSchema,
  names: titleNamesSchema,
  displayLang: displayLangSchema,
  year: z.number().int().min(1800).max(2200).nullable(),
  releaseDate: z.string().nullable().optional(),
  runtimeMin: z.number().min(0).max(100000).nullable(),
  genres: z.array(z.string()),
  genreIds: z.array(z.number().int()).optional(),
  uploader: z.string().nullable().optional(),
  liveStatus: z.enum(['live', 'upcoming', 'ended', 'offline']).optional(),
  posterPath: z.string().nullable(),
  posters: localizedPostersSchema.optional(),
  backdropPath: z.string().nullable(),
  overview: overviewSchema,
  showStatus: showStatusSchema,
  externalIds: externalIdsSchema,
  ratings: ratingsBlockSchema,
  manualState: manualStateSchema,
  playthroughs: z.array(playthroughSchema).min(1),
  activePlaythroughId: z.string().min(1),
  resume: resumePointSchema.nullable(),
  metaFetchedAt: z.number().nonnegative(),
  addedAt: z.number().nonnegative(),
  updatedAt: z.number().nonnegative(),
  lastActivityAt: z.number().nonnegative(),
};

export const titleDocWithoutIdSchema: z.ZodType<Omit<TitleDoc, 'id'>> = z
  .object(baseTitleFields)
  .refine(
    (doc) => doc.playthroughs.some((p) => p.id === doc.activePlaythroughId),
    {
      message: 'activePlaythroughId must exist in playthroughs',
      path: ['activePlaythroughId'],
    }
  );

export const titleDocSchema: z.ZodType<TitleDoc> = z
  .object({
    id: z.string().min(1),
    ...baseTitleFields,
  })
  .refine(
    (doc) => doc.playthroughs.some((p) => p.id === doc.activePlaythroughId),
    {
      message: 'activePlaythroughId must exist in playthroughs',
      path: ['activePlaythroughId'],
    }
  );

export const patchTitleRequestSchema = z
  .object({
    source: titleSourceSchema.optional(),
    sourceId: z.string().nullable().optional(),
    mediaType: mediaTypeSchema.optional(),
    names: titleNamesSchema.optional(),
    displayLang: displayLangSchema.optional(),
    year: z.number().int().min(1800).max(2200).nullable().optional(),
    releaseDate: z.string().nullable().optional(),
    runtimeMin: z.number().min(0).max(100000).nullable().optional(),
    genres: z.array(z.string()).optional(),
    genreIds: z.array(z.number().int()).optional(),
    uploader: z.string().nullable().optional(),
    liveStatus: z.enum(['live', 'upcoming', 'ended', 'offline']).optional(),
    posterPath: z.string().nullable().optional(),
    posters: localizedPostersSchema.optional(),
    backdropPath: z.string().nullable().optional(),
    overview: overviewSchema.optional(),
    showStatus: showStatusSchema.optional(),
    externalIds: externalIdsSchema.optional(),
    ratings: ratingsBlockSchema.optional(),
    manualState: manualStateSchema.optional(),
    playthroughs: z.array(playthroughSchema).min(1).optional(),
    activePlaythroughId: z.string().min(1).optional(),
    resume: resumePointSchema.nullable().optional(),
    metaFetchedAt: z.number().nonnegative().optional(),
    addedAt: z.number().nonnegative().optional(),
    updatedAt: z.number().nonnegative().optional(),
    lastActivityAt: z.number().nonnegative().optional(),
  })
  .strict();

export const episodeMetaSchema: z.ZodType<EpisodeMeta> = z.object({
  number: z.number().int().min(1),
  key: z.string().regex(/^s\d+e\d+$/i),
  name: localizedEpisodeNameSchema,
  airDate: z.string().nullable(),
  runtime: z.number().min(0).nullable(),
  stillPath: z.string().nullable(),
  overview: overviewSchema,
  sourceVideoId: z.string().min(1).optional(),
});

export const seasonDocSchema: z.ZodType<SeasonDoc> = z.object({
  seasonNumber: z.number().int().min(0),
  name: localizedSeasonNameSchema,
  posterPath: z.string().nullable().optional(),
  airDate: z.string().nullable().optional(),
  episodes: z.array(episodeMetaSchema),
});

export const progressDataSchema = z.object({
  watched: z.record(z.string(), z.number().nonnegative()),
  movieWatchedAt: z.number().nonnegative().optional(),
});

export const progressDocSchema: z.ZodType<ProgressDoc> = z.object({
  playthroughId: z.string().min(1),
  watched: z.record(z.string(), z.number().nonnegative()),
  movieWatchedAt: z.number().nonnegative().optional(),
});

export const putProgressRequestSchema = z.object({
  playthroughId: z.string().min(1).optional(),
  watched: z.record(z.string(), z.number().nonnegative()).default({}),
  movieWatchedAt: z.number().nonnegative().optional(),
});

export const patchProgressRequestSchema = z
  .object({
    set: z.record(z.string(), z.number().nonnegative()).optional(),
    unset: z.array(z.string()).optional(),
    movieWatchedAt: z.number().nonnegative().nullable().optional(),
  })
  .strict();

export const titleAtomicProgressMutationSchema = z
  .object({
    playthroughId: z.string().min(1).optional(),
    set: z.record(z.string(), z.number().nonnegative()).optional(),
    unset: z.array(z.string()).optional(),
    movieWatchedAt: z.number().nonnegative().nullable().optional(),
    replaceWatched: z.record(z.string(), z.number().nonnegative()).optional(),
    deletePlaythroughId: z.string().min(1).optional(),
  })
  .strict();

export const titleAtomicActionRequestSchema: z.ZodType<TitleAtomicActionInput> = z
  .object({
    progress: titleAtomicProgressMutationSchema.optional(),
    title: patchTitleRequestSchema.optional(),
  })
  .strict()
  .refine((val) => val.progress !== undefined || val.title !== undefined, {
    message: 'At least one of progress or title must be provided',
  });

export const putTitleRequestSchema = z.union([
  z.object({
    title: titleDocSchema,
    seasons: z.array(seasonDocSchema).optional(),
    progress: z
      .union([progressDocSchema, z.record(z.string(), progressDocSchema)])
      .optional(),
  }),
  z
    .object({
      id: z.string().min(1).optional(),
      ...baseTitleFields,
      seasons: z.array(seasonDocSchema).optional(),
      progress: z
        .union([progressDocSchema, z.record(z.string(), progressDocSchema)])
        .optional(),
    })
    .refine(
      (doc) => doc.playthroughs.some((p) => p.id === doc.activePlaythroughId),
      {
        message: 'activePlaythroughId must exist in playthroughs',
        path: ['activePlaythroughId'],
      }
    ),
]);

export const putSeasonsRequestSchema = z.union([
  z.array(seasonDocSchema),
  z.object({
    seasons: z.array(seasonDocSchema),
  }),
]);

export const listKindSchema = z.enum(['ordered', 'collection']);
export const collectionSortSchema = z.enum(['added', 'name', 'year', 'rating', 'manual']);

const baseListFields = {
  name: z.string().min(1),
  description: z.string().optional(),
  kind: listKindSchema,
  pinned: z.boolean(),
  rank: z.string().min(1),
  collectionSort: collectionSortSchema,
  createdAt: z.number().nonnegative(),
};

export const watchListDocSchema: z.ZodType<WatchListDoc> = z.object({
  id: z.string().min(1),
  ...baseListFields,
});

export const putListRequestSchema = z.object({
  id: z.string().min(1).optional(),
  ...baseListFields,
});

export const patchListRequestSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    kind: listKindSchema.optional(),
    pinned: z.boolean().optional(),
    rank: z.string().min(1).optional(),
    collectionSort: collectionSortSchema.optional(),
    createdAt: z.number().nonnegative().optional(),
  })
  .strict();

const baseListEntryFields = {
  titleId: z.string().min(1),
  rank: z.string().min(1),
  note: z.string().optional(),
  addedAt: z.number().nonnegative(),
};

export const listEntryDocSchema: z.ZodType<ListEntryDoc> = z.object({
  id: z.string().min(1),
  ...baseListEntryFields,
});

export const putListEntryRequestSchema = z.object({
  id: z.string().min(1).optional(),
  ...baseListEntryFields,
});

export const patchListEntryRequestSchema = z
  .object({
    titleId: z.string().min(1).optional(),
    rank: z.string().min(1).optional(),
    note: z.string().optional(),
    addedAt: z.number().nonnegative().optional(),
  })
  .strict();

export const homeSectionIdSchema = z.enum([
  'continue_watching',
  'new_episodes',
  'pinned_lists',
  'recently_added',
  'watchlist',
]);

export const homeSectionConfigSchema: z.ZodType<HomeSectionConfig> = z.object({
  id: homeSectionIdSchema,
  enabled: z.boolean(),
});

export const DEFAULT_APP_SETTINGS: AppSettingsDoc = {
  uiLang: 'system',
  defaultTitleLang: 'auto',
  includeSpecials: false,
  homeSections: [
    { id: 'continue_watching', enabled: true },
    { id: 'new_episodes', enabled: true },
    { id: 'pinned_lists', enabled: true },
    { id: 'recently_added', enabled: false },
    { id: 'watchlist', enabled: false },
  ],
  theme: 'dark',
};

export const appSettingsDocSchema: z.ZodType<AppSettingsDoc> = z.object({
  uiLang: uiLangSettingSchema.optional().default('system'),
  defaultTitleLang: defaultTitleLangSchema.default('auto'),
  includeSpecials: z.boolean().default(false),
  homeSections: z
    .array(homeSectionConfigSchema)
    .default(DEFAULT_APP_SETTINGS.homeSections),
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
});

export const patchSettingsRequestSchema = z
  .object({
    uiLang: uiLangSettingSchema.optional(),
    defaultTitleLang: defaultTitleLangSchema.optional(),
    includeSpecials: z.boolean().optional(),
    homeSections: z.array(homeSectionConfigSchema).optional(),
    theme: z.enum(['dark', 'light', 'system']).optional(),
  })
  .strict();

export const authPasswordRequestSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export const authSetupRequestSchema = z.object({
  password: z.string().min(10, 'Password must be at least 10 characters'),
  setupCode: z.string().min(1, 'Setup code is required'),
});

export const linkImportRequestSchema = z.object({
  url: z.string().min(1),
  force: z.boolean().optional(),
});

export const exportV2Schema = z.object({
  format: z.literal('zhenji-export'),
  version: z.literal(2),
  exportedAt: z.string(),
  settings: appSettingsDocSchema,
  titles: z.record(z.string(), titleDocSchema),
  seasonsByTitle: z.record(z.string(), z.array(seasonDocSchema)),
  progressByTitle: z.record(
    z.string(),
    z.record(z.string(), progressDocSchema)
  ),
  lists: z.record(z.string(), watchListDocSchema),
  entriesByList: z.record(z.string(), z.array(listEntryDocSchema)),
});

export const exportV1Schema = z.object({
  version: z.literal(1).optional(),
  exportedAt: z.string().optional(),
  settings: appSettingsDocSchema.optional().default(DEFAULT_APP_SETTINGS),
  titles: z.record(z.string(), titleDocSchema).default({}),
  seasonsByTitle: z.record(z.string(), z.array(seasonDocSchema)).default({}),
  progressByTitle: z
    .record(z.string(), z.record(z.string(), progressDocSchema))
    .default({}),
  lists: z.record(z.string(), watchListDocSchema).default({}),
  entriesByList: z.record(z.string(), z.array(listEntryDocSchema)).default({}),
});

export const importPayloadSchema = z.union([exportV2Schema, exportV1Schema]);
