import { BATCH_MAX_TITLES, BATCH_STATUSES } from './batch.ts';
import { DEFAULT_APP_SETTINGS } from './defaultSettings.ts';
export { DEFAULT_APP_SETTINGS } from './defaultSettings.ts';
import { z } from 'zod';
import { normalizeLocalizedEpisodeName, normalizeLocalizedSeasonName } from './airing.ts';
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
  .enum(['Returning Series', 'Ended', 'Canceled', 'In Production', 'Planned', 'Released'])
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

/** Every write names a playthrough by id, so two with the same id would make one of them unreachable. */
const playthroughListSchema = z
  .array(playthroughSchema)
  .min(1)
  .refine((list) => new Set(list.map((p) => p.id)).size === list.length, {
    message: 'Playthrough ids must be unique',
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

const upstreamFields = {
  structureLocked: z.boolean().optional(),
  sourceUnavailable: z.boolean().optional(),
  ignoredStructure: z.string().nullable().optional(),
  upstreamChange: z
    .object({
      signature: z.string(),
      fetchedAt: z.number().nonnegative(),
      seasons: z.array(z.lazy(() => seasonDocSchema)).optional(),
    })
    .nullable()
    .optional(),
};

const baseTitleFields = {
  ...upstreamFields,
  episodeDetailsVersion: z.number().nonnegative().optional(),
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
  posterPath: z.string().nullable(),
  posters: localizedPostersSchema.optional(),
  backdropPath: z.string().nullable(),
  overview: overviewSchema,
  showStatus: showStatusSchema,
  externalIds: externalIdsSchema,
  ratings: ratingsBlockSchema,
  manualState: manualStateSchema,
  playthroughs: playthroughListSchema,
  activePlaythroughId: z.string().min(1),
  resume: resumePointSchema.nullable(),
  metaFetchedAt: z.number().nonnegative(),
  addedAt: z.number().nonnegative(),
  updatedAt: z.number().nonnegative(),
  lastActivityAt: z.number().nonnegative(),
};

export const titleDocSchema: z.ZodType<TitleDoc> = z
  .object({
    id: z.string().min(1),
    ...baseTitleFields,
  })
  .refine((doc) => doc.playthroughs.some((p) => p.id === doc.activePlaythroughId), {
    message: 'activePlaythroughId must exist in playthroughs',
    path: ['activePlaythroughId'],
  });

/** Title fields a client may change directly. */
const titlePatchFields = {
  structureLocked: z.boolean().optional(),
  mediaType: mediaTypeSchema.optional(),
  names: titleNamesSchema.optional(),
  displayLang: displayLangSchema.optional(),
  year: z.number().int().min(1800).max(2200).nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  runtimeMin: z.number().min(0).max(100000).nullable().optional(),
  genres: z.array(z.string()).optional(),
  genreIds: z.array(z.number().int()).optional(),
  uploader: z.string().nullable().optional(),
  posterPath: z.string().nullable().optional(),
  posters: localizedPostersSchema.optional(),
  backdropPath: z.string().nullable().optional(),
  overview: overviewSchema.optional(),
  showStatus: showStatusSchema.optional(),
  externalIds: externalIdsSchema.optional(),
  ratings: ratingsBlockSchema.optional(),
  manualState: manualStateSchema.optional(),
  resume: resumePointSchema.nullable().optional(),
  metaFetchedAt: z.number().nonnegative().optional(),
  addedAt: z.number().nonnegative().optional(),
  updatedAt: z.number().nonnegative().optional(),
  lastActivityAt: z.number().nonnegative().optional(),
};

/**
 * PATCH /api/titles/:id. It cannot change the playthroughs or the active one: that is only possible through
 * POST /api/titles/:id/actions, which checks the write against the current active playthrough and keeps
 * progress in step. The source changes only through POST /api/titles/:id/source.
 */
export const patchTitleRequestSchema = z.object(titlePatchFields).strict();

/** The title part of POST /api/titles/:id/actions: everything PATCH allows, plus the playthrough structure. */
const titleActionPatchSchema = z
  .object({
    ...titlePatchFields,
    playthroughs: playthroughListSchema.optional(),
    activePlaythroughId: z.string().min(1).optional(),
  })
  .strict();

export const episodeMetaSchema: z.ZodType<EpisodeMeta> = z.object({
  tmdbEpisodeId: z.number().int().positive().optional(),
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

const archivedWatchedSchema = z
  .array(z.object({ episode: episodeMetaSchema, watchedAt: z.number().nonnegative() }))
  .optional();

export const progressDocSchema: z.ZodType<ProgressDoc> = z.object({
  archivedWatched: archivedWatchedSchema,
  playthroughId: z.string().min(1),
  watched: z.record(z.string(), z.number().nonnegative()),
  movieWatchedAt: z.number().nonnegative().optional(),
});

/** Episode keys are always `s<season>e<episode>`; anything else cannot name an episode. */
const episodeKeySchema = z.string().regex(/^s\d+e\d+$/);
const watchedWriteSchema = z.record(episodeKeySchema, z.number().nonnegative());

export const titleAtomicProgressMutationSchema = z
  .object({
    playthroughId: z.string().min(1).optional(),
    set: watchedWriteSchema.optional(),
    unset: z.array(episodeKeySchema).optional(),
    movieWatchedAt: z.number().nonnegative().nullable().optional(),
    replaceWatched: watchedWriteSchema.optional(),
    deletePlaythroughId: z.string().min(1).optional(),
  })
  .strict();

export const titleAtomicActionRequestSchema: z.ZodType<TitleAtomicActionInput> = z
  .object({
    expectedActivePlaythroughId: z.string().min(1).optional(),
    progress: titleAtomicProgressMutationSchema.optional(),
    title: titleActionPatchSchema.optional(),
  })
  .strict()
  .refine((val) => val.progress !== undefined || val.title !== undefined, {
    message: 'At least one of progress or title must be provided',
  });

/** A real calendar day, not just the right shape: `2026-99-99` would sort after every release date. */
const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Not a calendar date');

export const batchTitlesRequestSchema = z
  .object({
    titleIds: z.array(z.string().min(1)).min(1).max(BATCH_MAX_TITLES),
    action: z.discriminatedUnion('type', [
      z
        .object({
          type: z.literal('status'),
          status: z.enum(BATCH_STATUSES),
          /** The sender's local calendar date: "aired" means the same on the server as on the device. */
          todayStr: calendarDateSchema,
          now: z.number().int().positive(),
        })
        .strict(),
      z.object({ type: z.literal('addToList'), listId: z.string().min(1), now: z.number().int().positive() }).strict(),
      z.object({ type: z.literal('delete') }).strict(),
    ]),
  })
  .strict();

/**
 * PUT /api/titles/:id creates a title together with its seasons and progress. The progress must belong to
 * what is created: a playthrough of the title, and marks for episodes in the seasons sent. Marks without an
 * episode exist only in older data and backups, which are imported, not created.
 */
export const putTitleRequestSchema = z
  .union([
    z.object({
      title: titleDocSchema,
      seasons: z.array(seasonDocSchema).optional(),
      progress: z.union([progressDocSchema, z.record(z.string(), progressDocSchema)]).optional(),
    }),
    z
      .object({
        id: z.string().min(1).optional(),
        ...baseTitleFields,
        seasons: z.array(seasonDocSchema).optional(),
        progress: z.union([progressDocSchema, z.record(z.string(), progressDocSchema)]).optional(),
      })
      .refine((doc) => doc.playthroughs.some((p) => p.id === doc.activePlaythroughId), {
        message: 'activePlaythroughId must exist in playthroughs',
        path: ['activePlaythroughId'],
      }),
  ])
  .superRefine((request, ctx) => {
    const playthroughs = new Set(('title' in request ? request.title : request).playthroughs.map((p) => p.id));
    const episodes = new Set((request.seasons ?? []).flatMap((season) => season.episodes.map((e) => e.key)));
    const progress = request.progress;
    // The same reading of the two accepted shapes as the route: one document (v1 clients) or a map.
    const docs: Array<[string, ProgressDoc]> =
      progress === undefined
        ? []
        : 'watched' in progress && typeof progress.playthroughId === 'string'
          ? [[progress.playthroughId, progress as ProgressDoc]]
          : Object.entries(progress as Record<string, ProgressDoc>);
    for (const [playthroughId, doc] of docs) {
      if (!playthroughs.has(playthroughId)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Progress for a playthrough the title does not have',
          path: ['progress', playthroughId],
        });
      }
      for (const key of Object.keys(doc.watched)) {
        if (!episodes.has(key)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Mark for an episode the title does not have',
            path: ['progress', playthroughId, 'watched', key],
          });
        }
      }
    }
  });

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

/** An entry stays the entry of its title: changing it would be a way to list a title twice. */
export const patchListEntryRequestSchema = z
  .object({
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

export const appSettingsDocSchema: z.ZodType<AppSettingsDoc> = z.object({
  uiLang: uiLangSettingSchema.optional().default('system'),
  defaultTitleLang: defaultTitleLangSchema.default('auto'),
  includeSpecials: z.boolean().default(false),
  homeSections: z.array(homeSectionConfigSchema).default(DEFAULT_APP_SETTINGS.homeSections),
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
  progressByTitle: z.record(z.string(), z.record(z.string(), progressDocSchema)),
  lists: z.record(z.string(), watchListDocSchema),
  entriesByList: z.record(z.string(), z.array(listEntryDocSchema)),
});

export const exportV1Schema = z.object({
  version: z.literal(1).optional(),
  exportedAt: z.string().optional(),
  settings: appSettingsDocSchema.optional().default(DEFAULT_APP_SETTINGS),
  // Required: importing replaces the whole library, so a payload that is not a backup (for example `{}`)
  // must be rejected rather than read as an empty one.
  titles: z.record(z.string(), titleDocSchema),
  seasonsByTitle: z.record(z.string(), z.array(seasonDocSchema)).default({}),
  progressByTitle: z.record(z.string(), z.record(z.string(), progressDocSchema)).default({}),
  lists: z.record(z.string(), watchListDocSchema).default({}),
  entriesByList: z.record(z.string(), z.array(listEntryDocSchema)).default({}),
});

/** Entry ids are unique across the whole library, so a file that reuses one is answered as invalid input. */
export const importPayloadSchema = z.union([exportV2Schema, exportV1Schema]).superRefine((payload, ctx) => {
  const seen = new Set<string>();
  for (const [listId, entries] of Object.entries(payload.entriesByList)) {
    entries.forEach((entry, index) => {
      if (seen.has(entry.id)) {
        ctx.addIssue({
          code: 'custom',
          message: 'List entry id is used twice',
          path: ['entriesByList', listId, index, 'id'],
        });
      }
      seen.add(entry.id);
    });
  }
});
