export type MediaSource = 'tmdb' | 'url' | 'custom';
export type MediaType = 'movie' | 'tv' | 'other';
export type DisplayLang = 'zh' | 'original' | 'en' | 'custom';
export type ManualState = 'paused' | 'dropped' | null;

export type TitleStatusCode =
  | 'unwatched'
  | 'watching'
  | 'caught_up'
  | 'completed'
  | 'unaired'
  | 'paused'
  | 'dropped';

export type TitleStatusLabel =
  | '未看'
  | '观看中'
  | '已追平'
  | '已看完'
  | '未开播'
  | '暂停'
  | '弃剧';

export type SeasonStatusCode = 'none' | 'partial' | 'complete';

export interface LocalizedNames {
  original: string;
  zh?: string;
  en?: string;
  custom?: string;
}

export interface LocalizedOverview {
  zh?: string;
  en?: string;
}

export interface ExternalIds {
  imdb?: string;
  douban?: string;
}

export interface Ratings {
  imdb?: string;
  imdbVotes?: string;
  rottenTomatoes?: string;
  metacritic?: string;
  douban?: string;
  fetchedAt?: number;
}

export interface Playthrough {
  id: string;
  number: number;
  startedAt: number;
  completedAt?: number;
}

export interface ResumePoint {
  episodeKey: string | null; // null = movie
  seconds: number;
  updatedAt: number;
}

export interface TitleDoc {
  id: string;
  source: MediaSource;
  sourceId: string | null;
  mediaType: MediaType;
  names: LocalizedNames;
  displayLang: DisplayLang | null;
  year: number | null;
  runtimeMin: number | null;
  genres: string[];
  posterPath: string | null;
  backdropPath: string | null;
  overview: LocalizedOverview;
  showStatus: string | null;
  externalIds: ExternalIds;
  ratings: Ratings;
  manualState: ManualState;
  playthroughs: Playthrough[];
  activePlaythroughId: string;
  resume: ResumePoint | null;
  metaFetchedAt: number | null;
  addedAt: number;
  updatedAt: number;
  lastActivityAt: number;
}

export interface EpisodeMeta {
  number: number;
  key: string; // s{season}e{episode}, e.g. s2e5
  name: string;
  airDate: string | null; // YYYY-MM-DD
  runtime: number | null;
  stillPath: string | null;
  overview: LocalizedOverview;
}

export interface SeasonDoc {
  seasonNumber: number;
  name: string;
  episodes: EpisodeMeta[];
}

export interface ProgressDoc {
  playthroughId: string;
  watched: Record<string, number>; // { [episodeKey]: timestampMs }
  movieWatchedAt?: number;
}

export type ListKind = 'ordered' | 'collection';
export type CollectionSort = 'added' | 'name' | 'year' | 'rating' | 'manual';

export interface WatchListDoc {
  id: string;
  name: string;
  kind: ListKind;
  description?: string;
  pinned: boolean;
  rank: string;
  collectionSort: CollectionSort;
  createdAt: number;
}

export interface ListEntryDoc {
  id: string;
  titleId: string;
  rank: string;
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
  rank: string;
}

export interface AppSettingsDoc {
  defaultTitleLang: 'zh' | 'original' | 'en';
  includeSpecials: boolean;
  homeSections: HomeSectionConfig[];
  theme: 'dark' | 'light' | 'system';
}
