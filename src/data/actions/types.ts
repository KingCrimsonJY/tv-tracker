import type { Overlay } from '../syncEngine.ts';
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

export type ToastVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger';

export interface TrackerActionDeps {
  /** The current view: confirmed server state plus this device's pending edits. */
  getState: () => AppStateSnapshot;
  /** Show an edit immediately and send it; see `SyncEngine.optimistic`. */
  optimistic: <T extends StateMutationResult>(overlay: Overlay, request: () => Promise<T>) => Promise<T>;
  /** Apply the reply to a write that had no optimistic edit. */
  applyServerMutation: (mutation: StateMutationResult) => void;
  showToast: (message: string, variant?: ToastVariant) => void;
}

export function getActiveProgressFromState(state: AppStateSnapshot, title: TitleDoc): ProgressDoc {
  return (
    state.progressByTitle[title.id]?.[title.activePlaythroughId] ?? {
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
  for (const key of new Set([...Object.keys(prevProgress.watched), ...Object.keys(nextProgress.watched)])) {
    const after = nextProgress.watched[key];
    if (prevProgress.watched[key] === after) continue;
    if (after !== undefined) setMap[key] = after;
    else unsetList.push(key);
  }
  const movieChanged = prevProgress.movieWatchedAt !== nextProgress.movieWatchedAt;
  const hasSet = Object.keys(setMap).length > 0;
  const hasUnset = unsetList.length > 0;
  return {
    ...(hasSet ? { set: setMap } : {}),
    ...(hasUnset ? { unset: unsetList } : {}),
    ...(movieChanged ? { movieWatchedAt: nextProgress.movieWatchedAt ?? null } : {}),
    hasChanges: hasSet || hasUnset || movieChanged,
  };
}
