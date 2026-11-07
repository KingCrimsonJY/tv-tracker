export type MediaType = 'movie' | 'tv' | 'other';
export type TitleSource = 'tmdb' | 'url' | 'custom';
export type DisplayLang = 'zh' | 'original' | 'en' | 'custom';
export type UiLocale = 'zh-CN' | 'en';
export type UiLangSetting = 'system' | 'zh-CN' | 'en';
export type DefaultTitleLang = 'auto' | 'zh' | 'original' | 'en' | null;
export type ShowStatus =
  | 'Returning Series'
  | 'Ended'
  | 'Canceled'
  | 'In Production'
  | 'Planned'
  | 'Released'
  | null;
export type ManualState = 'paused' | 'dropped' | null;

export type TitleStatusCode =
  | 'unwatched'
  | 'watching'
  | 'caught_up'
  | 'completed'
  | 'unaired'
  | 'unreleased'
  | 'paused'
  | 'dropped';

export type SeasonStateCode = 'none' | 'partial' | 'complete';

export type ServerErrorCode =
  | 'PASSWORD_ALREADY_SET'
  | 'PASSWORD_NOT_SET'
  | 'SETUP_CODE_INVALID'
  | 'WRONG_PASSWORD'
  | 'TOO_MANY_ATTEMPTS'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'CSRF_ORIGIN_MISMATCH'
  | 'TITLE_NOT_FOUND'
  | 'LIST_NOT_FOUND'
  | 'ENTRY_NOT_FOUND'
  | 'CONFLICT_ERROR'
  | 'REWATCH_CONFLICT'
  | 'STRUCTURE_CONFLICT'
  | 'SOURCE_UNAVAILABLE'
  | 'VALIDATION_ERROR'
  | 'PAYLOAD_TOO_LARGE'
  | 'ROUTE_NOT_FOUND'
  | 'TMDB_NOT_CONFIGURED'
  | 'TMDB_INVALID_MEDIA_TYPE'
  | 'TMDB_INVALID_ID'
  | 'TMDB_UNAVAILABLE'
  | 'INVALID_LINK_URL'
  | 'UNSAFE_URL'
  | 'UNRESOLVABLE_HOST'
  | 'YTDLP_MISSING'
  | 'YTDLP_TIMEOUT'
  | 'YTDLP_FAILED'
  | 'LINK_REGION_RESTRICTED'
  | 'LINK_AGE_RESTRICTED'
  | 'LINK_PAYMENT_REQUIRED'
  | 'LINK_LOGIN_REQUIRED'
  | 'LINK_UNAVAILABLE'
  | 'LINK_NOT_LIVE'
  | 'LINK_RATE_LIMITED'
  | 'LINK_EMPTY_PLAYLIST'
  | 'LINK_PLAYLIST_TOO_LARGE'
  | 'LINK_PARSE_FAILED'
  | 'REFRESH_LINK_ONLY_URL'
  | 'REFRESH_LINK_FAILED'
  | 'INTERNAL_ERROR';

export interface LocalizedText {
  zh?: string;
  en?: string;
}

export interface LocalizedPosters {
  zh?: string | null;
  en?: string | null;
  textless?: string | null;
}

export interface Playthrough {
  id: string; // 'p1', 'p2', ...
  number: number; // 1, 2, ...
  startedAt: number; // unix ms
  completedAt?: number; // unix ms
}

export interface ResumePoint {
  episodeKey: string | null; // null for movie
  seconds: number;
  updatedAt: number; // unix ms
}

export interface RatingsBlock {
  tmdb?: string;
  tmdbVotes?: number;
  imdb?: string;
  imdbVotes?: string;
  rottenTomatoes?: string;
  metacritic?: string;
  fetchedAt?: number; // unix ms
}

export type Ratings = RatingsBlock;

export interface TmdbSearchItem {
  id: string;
  sourceId: string;
  mediaType: 'movie' | 'tv';
  names: TitleNames;
  year: number | null;
  releaseDate?: string | null;
  posterPath: string | null;
  posters?: LocalizedPosters;
  backdropPath: string | null;
  overview: LocalizedText;
  voteAverage?: number;
}

export interface SystemInfoResponse {
  appVersion: string;
  ytdlpInstalled?: boolean;
  ytdlpVersion: string | null;
}

export interface TitleNames {
  original: string;
  zh?: string;
  en?: string;
  custom?: string;
}

export type LinkLiveStatus = 'live' | 'upcoming' | 'ended' | 'offline';

export interface UpstreamChange {
  signature: string;
  seasons: SeasonDoc[];
  fetchedAt: number;
}
export interface ArchivedWatch {
  episode: EpisodeMeta;
  watchedAt: number;
}

export interface TitleDoc {
  structureLocked?: boolean;
  sourceUnavailable?: boolean;
  upstreamChange?: UpstreamChange | null;
  ignoredStructure?: string | null;
  id: string;
  source: TitleSource;
  sourceId: string | null;
  mediaType: MediaType;
  names: TitleNames;
  displayLang: DisplayLang | null;
  year: number | null;
  releaseDate?: string | null;
  runtimeMin: number | null;
  genres: string[];
  genreIds?: number[];
  uploader?: string | null;
  liveStatus?: LinkLiveStatus;
  posterPath: string | null;
  posters?: LocalizedPosters;
  backdropPath: string | null;
  overview: LocalizedText;
  showStatus: ShowStatus;
  externalIds: { imdb?: string; tvdb?: string };
  ratings: RatingsBlock;
  manualState: ManualState;
  playthroughs: Playthrough[];
  activePlaythroughId: string;
  resume: ResumePoint | null;
  metaFetchedAt: number;
  addedAt: number;
  updatedAt: number;
  lastActivityAt: number;
}

export interface EpisodeMeta {
  tmdbEpisodeId?: number;
  number: number;
  key: string; // e.g. 's2e5'
  name: LocalizedText | null;
  airDate: string | null; // 'YYYY-MM-DD'
  runtime: number | null;
  stillPath: string | null;
  overview: LocalizedText;
  sourceVideoId?: string;
}

export interface SeasonDoc {
  seasonNumber: number; // 0 = specials, 1..N
  name: LocalizedText | null;
  posterPath?: string | null;
  airDate?: string | null;
  episodes: EpisodeMeta[];
}

export interface ProgressDoc {
  archivedWatched?: ArchivedWatch[];
  playthroughId: string;
  watched: Record<string, number>; // episodeKey -> watchedAt (unix ms)
  movieWatchedAt?: number; // unix ms (for movies)
}

export type ListKind = 'ordered' | 'collection';
export type CollectionSort = 'added' | 'name' | 'year' | 'rating' | 'manual';

export interface WatchListDoc {
  id: string;
  name: string;
  description?: string;
  kind: ListKind;
  pinned: boolean;
  rank: string; // fractional-indexing key
  collectionSort: CollectionSort;
  createdAt: number;
}

export interface ListEntryDoc {
  id: string;
  titleId: string;
  rank: string; // fractional-indexing key
  note?: string;
  addedAt: number;
}

export type HomeSectionId =
  | 'continue_watching'
  | 'new_episodes'
  | 'pinned_lists'
  | 'recently_added'
  | 'watchlist';

export interface HomeSectionConfig {
  id: HomeSectionId;
  enabled: boolean;
}

export interface AppSettingsDoc {
  uiLang?: UiLangSetting;
  defaultTitleLang: DefaultTitleLang;
  includeSpecials: boolean;
  homeSections: HomeSectionConfig[];
  theme: 'dark' | 'light' | 'system';
}

export interface LinkImportEpisodeSeed {
  airDate?: string | null;
  name: string | null;
  sourceVideoId?: string;
  runtime?: number | null;
}

export interface LinkImportResult {
  kind: 'video' | 'playlist' | 'tmdb-suggestion';
  title: string;
  posterUrl: string | null;
  overview: string;
  uploader?: string | null;
  liveStatus?: LinkLiveStatus;
  sourceUrl: string;
  year: number | null;
  runtimeMin: number | null;
  episodes: LinkImportEpisodeSeed[];
  fallbackUsed: 'yt-dlp' | 'bilibili' | 'og' | 'manual';
  mediaType?: MediaType;
  warning?: string;
}

export interface AppStateSnapshot {
  version: number;
  epoch?: string;
  titles: Record<string, TitleDoc>;
  seasonsByTitle: Record<string, SeasonDoc[]>;
  progressByTitle: Record<string, Record<string, ProgressDoc>>;
  lists: Record<string, WatchListDoc>;
  entriesByList: Record<string, ListEntryDoc[]>;
  settings: AppSettingsDoc;
}

export interface StateUpserts {
  titles?: Record<string, TitleDoc>;
  seasonsByTitle?: Record<string, SeasonDoc[]>;
  progressByTitle?: Record<string, Record<string, ProgressDoc>>;
  lists?: Record<string, WatchListDoc>;
  entriesByList?: Record<string, ListEntryDoc[]>;
  settings?: AppSettingsDoc;
}

export interface StateDeletes {
  titles?: string[];
  lists?: string[];
  entries?: Array<{ listId: string; entryId: string }>;
  progress?: Array<{ titleId: string; playthroughId: string }>;
}

export interface StateMutationResult {
  replace?: boolean;
  version: number;
  epoch?: string;
  upserts: StateUpserts;
  deletes: StateDeletes;
}

export interface TitleAtomicProgressMutation {
  playthroughId?: string;
  set?: Record<string, number>;
  unset?: string[];
  movieWatchedAt?: number | null;
  replaceWatched?: Record<string, number>;
  deletePlaythroughId?: string;
}

export interface TitleAtomicActionInput {
  expectedActivePlaythroughId?: string;
  progress?: TitleAtomicProgressMutation;
  title?: Partial<Omit<TitleDoc, 'id'>>;
}

export interface PlaylistRefreshResult extends StateMutationResult {
  warning?: string;
  addedCount: number;
}

export interface ZhenjiExportV2 {
  format: 'zhenji-export';
  version: 2;
  exportedAt: string;
  settings: AppSettingsDoc;
  titles: Record<string, TitleDoc>;
  seasonsByTitle: Record<string, SeasonDoc[]>;
  progressByTitle: Record<string, Record<string, ProgressDoc>>;
  lists: Record<string, WatchListDoc>;
  entriesByList: Record<string, ListEntryDoc[]>;
}

export type MetadataRefreshStatus = 'updated' | 'partial' | 'failed' | 'skipped';
export type MetadataRefreshCounts = Record<MetadataRefreshStatus, number>;
export interface MetadataRefreshResult extends StateMutationResult {
  status: MetadataRefreshStatus;
}
export interface TmdbDetails {
  title: TitleDoc;
  seasons: SeasonDoc[];
  failedSeasons?: number[];
}
