import { createRandomId } from '../../domain/id.ts';
import {
  deletePlaythrough,
  markUpToEpisode,
  markWholeTitleWatched,
  type MutationResult,
  setResumePoint,
  setSeasonWatched,
  startRewatch,
  toggleEpisodeWatched,
  undoLatestPlaythrough,
} from '../../domain/progress.ts';
import { applyProgressMutation } from '../../domain/progressMutation.ts';
import type { ProgressDoc, TitleAtomicProgressMutation, TitleDoc } from '../../domain/types.ts';
import { postTitleActionApi } from '../api.ts';
import type { Overlay } from '../syncEngine.ts';
import type { Commit } from './commit.ts';
import { computeProgressDiff, getActiveProgressFromState, type TrackerActionDeps } from './types.ts';

type TitlePatch = Partial<Omit<TitleDoc, 'id'>>;

/** The optimistic twin of POST /api/titles/:id/actions. */
function titleActionOverlay(titleId: string, titlePatch: TitlePatch, progress?: TitleAtomicProgressMutation): Overlay {
  return (state) => {
    const title = state.titles[titleId];
    if (!title) return state;
    const docs = { ...(state.progressByTitle[titleId] ?? {}) };
    if (progress?.deletePlaythroughId) delete docs[progress.deletePlaythroughId];
    if (progress?.playthroughId) {
      docs[progress.playthroughId] = applyProgressMutation(
        docs[progress.playthroughId],
        progress.playthroughId,
        progress,
      );
    }
    return {
      ...state,
      titles: { ...state.titles, [titleId]: { ...title, ...titlePatch, id: titleId } },
      progressByTitle: progress ? { ...state.progressByTitle, [titleId]: docs } : state.progressByTitle,
    };
  };
}

export function createProgressActions({ getState }: TrackerActionDeps, { commit }: Commit) {
  /**
   * Every progress or playthrough write names the active playthrough it was computed from; the server
   * rejects it if another device has started or removed a viewing in the meantime.
   */
  async function write(title: TitleDoc, titlePatch: TitlePatch, progress?: TitleAtomicProgressMutation): Promise<void> {
    await commit(titleActionOverlay(title.id, titlePatch, progress), () =>
      postTitleActionApi(title.id, {
        expectedActivePlaythroughId: title.activePlaythroughId,
        ...(progress ? { progress } : {}),
        title: titlePatch,
      }),
    );
  }

  /** The title fields a domain action may change, limited to those that actually changed. */
  function titlePatchFor(prev: TitleDoc, next: MutationResult, now: number): TitlePatch {
    return {
      updatedAt: now,
      lastActivityAt: now,
      ...(prev.manualState !== next.manualState ? { manualState: next.manualState } : {}),
      ...(JSON.stringify(prev.resume) !== JSON.stringify(next.resume) ? { resume: next.resume } : {}),
      ...(JSON.stringify(prev.playthroughs) !== JSON.stringify(next.playthroughs)
        ? { playthroughs: next.playthroughs }
        : {}),
      ...(prev.activePlaythroughId !== next.activePlaythroughId
        ? { activePlaythroughId: next.activePlaythroughId }
        : {}),
    };
  }

  /** Run a domain action against the active playthrough and send only what it changed. */
  async function applyToActiveProgress(
    titleId: string,
    action: (
      title: TitleDoc,
      progress: ProgressDoc,
      context: {
        seasons: ReturnType<typeof getState>['seasonsByTitle'][string];
        includeSpecials: boolean;
        now: number;
      },
    ) => MutationResult,
  ): Promise<void> {
    const state = getState();
    const title = state.titles[titleId];
    if (!title) return;
    const before = getActiveProgressFromState(state, title);
    const now = Date.now();
    const result = action(title, before, {
      seasons: state.seasonsByTitle[titleId] ?? [],
      includeSpecials: state.settings.includeSpecials,
      now,
    });
    const { hasChanges, ...diff } = computeProgressDiff(before, result.progress);
    await write(
      title,
      titlePatchFor(title, result, now),
      hasChanges ? { playthroughId: result.progress.playthroughId, ...diff } : undefined,
    );
  }

  const toggleEpisode = (titleId: string, episodeKey: string) =>
    applyToActiveProgress(titleId, (title, progress, { seasons, includeSpecials, now }) =>
      toggleEpisodeWatched(title, seasons, progress, episodeKey, { includeSpecials, now }),
    );

  /** Idempotent quick action: a repeated tap or a stale shortcut never unmarks a watched episode. */
  async function markEpisodeWatched(titleId: string, episodeKey: string): Promise<void> {
    const state = getState();
    const title = state.titles[titleId];
    if (!title || getActiveProgressFromState(state, title).watched[episodeKey] !== undefined) return;
    await toggleEpisode(titleId, episodeKey);
  }

  const toggleSeason = (titleId: string, seasonNumber: number, markWatched: boolean) =>
    applyToActiveProgress(titleId, (title, progress, { seasons, includeSpecials, now }) =>
      setSeasonWatched(title, seasons, progress, seasonNumber, markWatched, { includeSpecials, now }),
    );

  const markUpTo = (titleId: string, episodeKey: string) =>
    applyToActiveProgress(titleId, (title, progress, { seasons, includeSpecials, now }) =>
      markUpToEpisode(title, seasons, progress, episodeKey, { includeSpecials, now }),
    );

  const markWholeTitle = (titleId: string, markWatched: boolean) =>
    applyToActiveProgress(titleId, (title, progress, { seasons, includeSpecials, now }) =>
      markWholeTitleWatched(title, seasons, progress, markWatched, { includeSpecials, now }),
    );

  async function saveResume(
    titleId: string,
    resume: { episodeKey: string | null; seconds: number } | null,
  ): Promise<void> {
    const title = getState().titles[titleId];
    if (!title) return;
    const now = Date.now();
    const next = setResumePoint(title, resume, now);
    await write(title, { manualState: next.manualState, resume: next.resume, updatedAt: now, lastActivityAt: now });
  }

  /** Starting, undoing or deleting a viewing replaces the whole playthrough list. */
  const playthroughPatch = (next: MutationResult, now: number): TitlePatch => ({
    manualState: next.manualState,
    resume: next.resume,
    playthroughs: next.playthroughs,
    activePlaythroughId: next.activePlaythroughId,
    updatedAt: now,
    lastActivityAt: now,
  });

  async function startTitleRewatch(titleId: string): Promise<void> {
    const state = getState();
    const title = state.titles[titleId];
    if (!title) return;
    const now = Date.now();
    const next = startRewatch(title, state.seasonsByTitle[titleId] ?? [], getActiveProgressFromState(state, title), {
      includeSpecials: state.settings.includeSpecials,
      now,
      newPlaythroughId: createRandomId('p'),
    });
    await write(title, playthroughPatch(next, now), { playthroughId: next.progress.playthroughId, replaceWatched: {} });
  }

  async function removeViewing(
    titleId: string,
    plan: (title: TitleDoc, progress: Record<string, ProgressDoc>) => ReturnType<typeof undoLatestPlaythrough>,
  ): Promise<void> {
    const state = getState();
    const title = state.titles[titleId];
    if (!title) return;
    const now = Date.now();
    const next = plan(title, state.progressByTitle[titleId] ?? {});
    if (next.removedPlaythroughId) {
      await write(title, playthroughPatch(next, now), { deletePlaythroughId: next.removedPlaythroughId });
    } else if (next.clearedPlaythroughId) {
      // The only viewing cannot be removed; it is emptied instead.
      await write(title, playthroughPatch(next, now), {
        playthroughId: next.clearedPlaythroughId,
        replaceWatched: {},
        movieWatchedAt: null,
      });
    }
  }

  const cancelTitleRewatch = (titleId: string) => removeViewing(titleId, undoLatestPlaythrough);
  const deleteTitlePlaythrough = (titleId: string, playthroughId: string) =>
    removeViewing(titleId, (title, progress) => deletePlaythrough(title, playthroughId, progress));

  return {
    toggleEpisode,
    markEpisodeWatched,
    toggleSeason,
    markUpTo,
    markWholeTitle,
    saveResume,
    startTitleRewatch,
    cancelTitleRewatch,
    deleteTitlePlaythrough,
  };
}
