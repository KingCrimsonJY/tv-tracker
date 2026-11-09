import { createRandomId } from '../../domain/id.ts';
import {
  deletePlaythrough,
  markUpToEpisode,
  markWholeTitleWatched,
  setResumePoint,
  setSeasonWatched,
  startRewatch,
  toggleEpisodeWatched,
  undoLatestPlaythrough,
} from '../../domain/progress.ts';
import type { ProgressDoc, TitleDoc } from '../../domain/types.ts';
import { createAtomicProgressOp } from './atomicProgressOp.ts';
import {
  computeProgressDiff,
  getActiveProgressFromState,
  type InFlightProgressOp,
  type TrackerActionDeps,
} from './types.ts';

export function createProgressActions(
  deps: TrackerActionDeps & {
    inFlightOps: Map<string, InFlightProgressOp>;
    triggerRefetch: () => Promise<void>;
  },
) {
  const { getState } = deps;

  const executeAtomicProgressAndTitleOp = createAtomicProgressOp(deps);

  async function commitComputedMutation(
    prevTitle: TitleDoc,
    prevProgress: ProgressDoc,
    res: {
      manualState: TitleDoc['manualState'];
      resume: TitleDoc['resume'];
      playthroughs: TitleDoc['playthroughs'];
      activePlaythroughId: string;
      progress: ProgressDoc;
    },
    now: number,
  ): Promise<void> {
    const diff = computeProgressDiff(prevProgress, res.progress);
    const prevWatchedValues: Record<string, number | undefined> = {};
    for (const key of Object.keys(diff.set || {})) prevWatchedValues[key] = prevProgress.watched[key];
    for (const key of diff.unset || []) prevWatchedValues[key] = prevProgress.watched[key];

    const titlePatch: Partial<Omit<TitleDoc, 'id'>> = { updatedAt: now, lastActivityAt: now };
    const prevTitleFields: Partial<Omit<TitleDoc, 'id'>> = {
      updatedAt: prevTitle.updatedAt,
      lastActivityAt: prevTitle.lastActivityAt,
    };

    if (prevTitle.manualState !== res.manualState) {
      titlePatch.manualState = res.manualState;
      prevTitleFields.manualState = prevTitle.manualState;
    }
    if (JSON.stringify(prevTitle.resume) !== JSON.stringify(res.resume)) {
      titlePatch.resume = res.resume;
      prevTitleFields.resume = prevTitle.resume;
    }
    if (JSON.stringify(prevTitle.playthroughs) !== JSON.stringify(res.playthroughs)) {
      titlePatch.playthroughs = res.playthroughs;
    }
    if (prevTitle.activePlaythroughId !== res.activePlaythroughId) {
      titlePatch.activePlaythroughId = res.activePlaythroughId;
      prevTitleFields.activePlaythroughId = prevTitle.activePlaythroughId;
    }

    await executeAtomicProgressAndTitleOp({
      titleId: prevTitle.id,
      playthroughId: diff.hasChanges ? res.progress.playthroughId : undefined,
      set: diff.set,
      unset: diff.unset,
      movieWatchedAt: diff.movieWatchedAt,
      titlePatch,
      prevWatchedValues,
      prevMovieWatchedAt: prevProgress.movieWatchedAt,
      hadMovieWatchedAtChange: diff.movieWatchedAt !== undefined,
      prevTitleFields,
      expectedActivePlaythroughId: prevTitle.activePlaythroughId,
      now,
    });
  }

  async function toggleEpisode(titleId: string, episodeKey: string): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const prevProgress = getActiveProgressFromState(state, prevTitle);
    const now = Date.now();
    const res = toggleEpisodeWatched(prevTitle, state.seasonsByTitle[titleId] || [], prevProgress, episodeKey, {
      includeSpecials: state.settings.includeSpecials,
      now,
    });
    await commitComputedMutation(prevTitle, prevProgress, res, now);
  }

  /** Idempotent quick action: a repeated tap or a stale shortcut never unmarks a watched episode. */
  async function markEpisodeWatched(titleId: string, episodeKey: string): Promise<void> {
    const state = getState();
    const title = state.titles[titleId];
    if (!title || getActiveProgressFromState(state, title).watched[episodeKey] !== undefined) return;
    await toggleEpisode(titleId, episodeKey);
  }

  async function toggleSeason(titleId: string, seasonNumber: number, markWatched: boolean): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const prevProgress = getActiveProgressFromState(state, prevTitle);
    const now = Date.now();
    const res = setSeasonWatched(
      prevTitle,
      state.seasonsByTitle[titleId] || [],
      prevProgress,
      seasonNumber,
      markWatched,
      { includeSpecials: state.settings.includeSpecials, now },
    );
    await commitComputedMutation(prevTitle, prevProgress, res, now);
  }

  async function markUpTo(titleId: string, episodeKey: string): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const prevProgress = getActiveProgressFromState(state, prevTitle);
    const now = Date.now();
    const res = markUpToEpisode(prevTitle, state.seasonsByTitle[titleId] || [], prevProgress, episodeKey, {
      includeSpecials: state.settings.includeSpecials,
      now,
    });
    await commitComputedMutation(prevTitle, prevProgress, res, now);
  }

  async function markWholeTitle(titleId: string, markWatched: boolean): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const prevProgress = getActiveProgressFromState(state, prevTitle);
    const now = Date.now();
    const res = markWholeTitleWatched(prevTitle, state.seasonsByTitle[titleId] || [], prevProgress, markWatched, {
      includeSpecials: state.settings.includeSpecials,
      now,
    });
    await commitComputedMutation(prevTitle, prevProgress, res, now);
  }

  async function saveResume(
    titleId: string,
    resume: { episodeKey: string | null; seconds: number } | null,
  ): Promise<void> {
    const prevTitle = getState().titles[titleId];
    if (!prevTitle) return;
    const now = Date.now();
    const res = setResumePoint(prevTitle, resume, now);
    await executeAtomicProgressAndTitleOp({
      titleId,
      titlePatch: {
        manualState: res.manualState,
        resume: res.resume,
        updatedAt: now,
        lastActivityAt: now,
      },
      prevWatchedValues: {},
      prevMovieWatchedAt: undefined,
      hadMovieWatchedAtChange: false,
      prevTitleFields: {
        manualState: prevTitle.manualState,
        resume: prevTitle.resume,
        updatedAt: prevTitle.updatedAt,
        lastActivityAt: prevTitle.lastActivityAt,
      },
      expectedActivePlaythroughId: prevTitle.activePlaythroughId,
      now,
    });
  }

  async function startTitleRewatch(titleId: string): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const now = Date.now();
    const res = startRewatch(
      prevTitle,
      state.seasonsByTitle[titleId] || [],
      getActiveProgressFromState(state, prevTitle),
      {
        includeSpecials: state.settings.includeSpecials,
        now,
        newPlaythroughId: createRandomId('p'),
      },
    );

    await executeAtomicProgressAndTitleOp({
      titleId,
      playthroughId: res.progress.playthroughId,
      replaceWatched: {},
      titlePatch: {
        manualState: res.manualState,
        resume: res.resume,
        playthroughs: res.playthroughs,
        activePlaythroughId: res.activePlaythroughId,
        updatedAt: now,
        lastActivityAt: now,
      },
      prevWatchedValues: {},
      prevMovieWatchedAt: undefined,
      hadMovieWatchedAtChange: false,
      prevTitleFields: {
        manualState: prevTitle.manualState,
        resume: prevTitle.resume,
        playthroughs: prevTitle.playthroughs,
        activePlaythroughId: prevTitle.activePlaythroughId,
        updatedAt: prevTitle.updatedAt,
        lastActivityAt: prevTitle.lastActivityAt,
      },
      createdPlaythroughId: res.progress.playthroughId,
      expectedActivePlaythroughId: prevTitle.activePlaythroughId,
      now,
    });
  }

  async function applyUndoOrDeleteResult(
    titleId: string,
    prevTitle: TitleDoc,
    prevProgressMap: Record<string, ProgressDoc>,
    res: ReturnType<typeof undoLatestPlaythrough>,
    now: number,
  ): Promise<void> {
    if (res.removedPlaythroughId) {
      await executeAtomicProgressAndTitleOp({
        titleId,
        deletePlaythroughId: res.removedPlaythroughId,
        titlePatch: {
          manualState: res.manualState,
          resume: res.resume,
          playthroughs: res.playthroughs,
          activePlaythroughId: res.activePlaythroughId,
          updatedAt: now,
          lastActivityAt: now,
        },
        prevWatchedValues: {},
        prevMovieWatchedAt: undefined,
        hadMovieWatchedAtChange: false,
        prevTitleFields: {
          manualState: prevTitle.manualState,
          resume: prevTitle.resume,
          playthroughs: prevTitle.playthroughs,
          activePlaythroughId: prevTitle.activePlaythroughId,
          updatedAt: prevTitle.updatedAt,
          lastActivityAt: prevTitle.lastActivityAt,
        },
        deletedPlaythroughDoc: prevProgressMap[res.removedPlaythroughId],
        expectedActivePlaythroughId: prevTitle.activePlaythroughId,
        now,
      });
      return;
    }

    if (res.clearedPlaythroughId) {
      const prevProg = prevProgressMap[res.clearedPlaythroughId] || {
        playthroughId: res.clearedPlaythroughId,
        watched: {},
      };
      const prevWatchedValues: Record<string, number | undefined> = {};
      for (const [k, v] of Object.entries(prevProg.watched)) {
        prevWatchedValues[k] = v;
      }
      await executeAtomicProgressAndTitleOp({
        titleId,
        playthroughId: res.clearedPlaythroughId,
        replaceWatched: {},
        movieWatchedAt: null,
        titlePatch: {
          manualState: res.manualState,
          resume: res.resume,
          playthroughs: res.playthroughs,
          activePlaythroughId: res.activePlaythroughId,
          updatedAt: now,
          lastActivityAt: now,
        },
        prevWatchedValues,
        prevMovieWatchedAt: prevProg.movieWatchedAt,
        hadMovieWatchedAtChange: prevProg.movieWatchedAt !== undefined,
        prevTitleFields: {
          manualState: prevTitle.manualState,
          resume: prevTitle.resume,
          playthroughs: prevTitle.playthroughs,
          activePlaythroughId: prevTitle.activePlaythroughId,
          updatedAt: prevTitle.updatedAt,
          lastActivityAt: prevTitle.lastActivityAt,
        },
        expectedActivePlaythroughId: prevTitle.activePlaythroughId,
        now,
      });
    }
  }

  async function cancelTitleRewatch(titleId: string): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const prevProgressMap = state.progressByTitle[titleId] || {};
    const now = Date.now();
    const res = undoLatestPlaythrough(prevTitle, prevProgressMap);
    await applyUndoOrDeleteResult(titleId, prevTitle, prevProgressMap, res, now);
  }

  async function deleteTitlePlaythrough(titleId: string, playthroughId: string): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const prevProgressMap = state.progressByTitle[titleId] || {};
    const now = Date.now();
    const res = deletePlaythrough(prevTitle, playthroughId, prevProgressMap);
    await applyUndoOrDeleteResult(titleId, prevTitle, prevProgressMap, res, now);
  }

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
