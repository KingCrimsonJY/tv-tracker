import type { StateUpdater } from '../store.ts';
import type {
  AppStateSnapshot,
  LinkImportEpisodeSeed,
  MediaType,
  ProgressDoc,
  StateMutationResult,
  TitleDoc,
} from '../../domain/types.ts';

export interface CustomTitleInput {
  source: 'url' | 'custom';
  sourceUrl?: string | null;
  sourceId?: string | null;
  name: string;
  originalName?: string;
  mediaType: MediaType;
  year?: number | null;
  runtimeMin?: number | null;
  posterPath?: string | null;
  posterUrl?: string | null;
  overview?: string;
  uploader?: string | null;
  episodeCount?: number | null;
  episodes?: LinkImportEpisodeSeed[];
  targetListId?: string;
}

export interface UpdateTitleDetailsInput {
  name?: string;
  originalName?: string;
  mediaType?: MediaType;
  year?: number | null;
  runtimeMin?: number | null;
  posterPath?: string | null;
  overview?: string;
  /** Which language slot `overview` replaces; defaults to Chinese. */
  overviewLang?: 'zh' | 'en';
  uploader?: string | null;
  episodeCount?: number | null;
}

export interface InFlightProgressOp {
  id: string;
  titleId: string;
  playthroughId?: string;
  set?: Record<string, number>;
  unset?: string[];
  movieWatchedAt?: number | null;
  replaceWatched?: Record<string, number>;
  deletePlaythroughId?: string;
  titlePatch?: Partial<Omit<TitleDoc, 'id'>>;
}

export type ToastVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger';

export interface TrackerActionDeps {
  getState: () => AppStateSnapshot;
  setState: (updater: StateUpdater) => unknown;
  applyServerMutation: (mutation: StateMutationResult) => void;
  showToast: (message: string, variant?: ToastVariant) => void;
  refetchState?: () => Promise<void>;
  inFlightOps?: Map<string, InFlightProgressOp>;
}

export function getActiveProgressFromState(state: AppStateSnapshot, title: TitleDoc): ProgressDoc {
  const pMap = state.progressByTitle[title.id] || {};
  return (
    pMap[title.activePlaythroughId] || {
      playthroughId: title.activePlaythroughId,
      watched: {},
    }
  );
}

export function computeProgressDiff(
  prevProgress: ProgressDoc,
  nextProgress: ProgressDoc,
): {
  set?: Record<string, number>;
  unset?: string[];
  movieWatchedAt?: number | null;
  hasChanges: boolean;
} {
  const setMap: Record<string, number> = {};
  const unsetList: string[] = [];

  const allKeys = new Set([...Object.keys(prevProgress.watched), ...Object.keys(nextProgress.watched)]);

  for (const key of allKeys) {
    const beforeVal = prevProgress.watched[key];
    const afterVal = nextProgress.watched[key];
    if (beforeVal !== afterVal) {
      if (afterVal !== undefined) {
        setMap[key] = afterVal;
      } else {
        unsetList.push(key);
      }
    }
  }

  let movieWatchedAt: number | null | undefined = undefined;
  if (prevProgress.movieWatchedAt !== nextProgress.movieWatchedAt) {
    movieWatchedAt = nextProgress.movieWatchedAt ?? null;
  }

  const hasSet = Object.keys(setMap).length > 0;
  const hasUnset = unsetList.length > 0;
  const hasMovieChange = movieWatchedAt !== undefined;

  return {
    ...(hasSet ? { set: setMap } : {}),
    ...(hasUnset ? { unset: unsetList } : {}),
    ...(hasMovieChange ? { movieWatchedAt } : {}),
    hasChanges: hasSet || hasUnset || hasMovieChange,
  };
}

export function applyInFlightOpsToState(
  state: AppStateSnapshot,
  inFlightOps: Map<string, InFlightProgressOp>,
): AppStateSnapshot {
  if (inFlightOps.size === 0) return state;

  let nextTitles = state.titles;
  let nextProgressByTitle = state.progressByTitle;
  let mutated = false;

  for (const op of inFlightOps.values()) {
    const existingTitle = nextTitles[op.titleId];
    if (!existingTitle) continue;

    if (!mutated) {
      nextTitles = { ...nextTitles };
      nextProgressByTitle = { ...nextProgressByTitle };
      mutated = true;
    }

    if (op.titlePatch) {
      nextTitles[op.titleId] = {
        ...existingTitle,
        ...op.titlePatch,
        id: op.titleId,
      };
    }

    const titleProgMap = { ...(nextProgressByTitle[op.titleId] || {}) };
    if (op.deletePlaythroughId) {
      delete titleProgMap[op.deletePlaythroughId];
    }

    if (op.playthroughId) {
      const ptId = op.playthroughId;
      const existingProg = titleProgMap[ptId] || { playthroughId: ptId, watched: {} };
      const watched = op.replaceWatched !== undefined ? { ...op.replaceWatched } : { ...existingProg.watched };

      if (op.set) {
        for (const [k, v] of Object.entries(op.set)) {
          watched[k] = v;
        }
      }
      if (op.unset) {
        for (const k of op.unset) {
          delete watched[k];
        }
      }

      let movieWatchedAt = existingProg.movieWatchedAt;
      if (op.movieWatchedAt === null) {
        movieWatchedAt = undefined;
      } else if (typeof op.movieWatchedAt === 'number') {
        movieWatchedAt = op.movieWatchedAt;
      }

      titleProgMap[ptId] = {
        ...existingProg,
        playthroughId: ptId,
        watched,
        ...(movieWatchedAt !== undefined ? { movieWatchedAt } : {}),
      };
    }

    nextProgressByTitle[op.titleId] = titleProgMap;
  }

  if (!mutated) return state;
  return {
    ...state,
    titles: nextTitles,
    progressByTitle: nextProgressByTitle,
  };
}
