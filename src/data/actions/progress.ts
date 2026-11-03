import { createRandomId } from '../../domain/id.ts';
import {
  cancelRewatch,
  computeTitleState,
  markUpToEpisode,
  markWholeTitleWatched,
  setResumePoint,
  setSeasonWatched,
  startRewatch,
  toggleEpisodeWatched,
} from '../../domain/progress.ts';
import type { Playthrough, ProgressDoc, TitleDoc } from '../../domain/types.ts';
import { zh } from '../../i18n/zh.ts';
import { postTitleActionApi } from '../api.ts';
import {
  applyInFlightOpsToState,
  computeProgressDiff,
  getActiveProgressFromState,
  type InFlightProgressOp,
  type TrackerActionDeps,
} from './types.ts';

function recomputePlaythroughsForTitle(
  title: TitleDoc,
  state: ReturnType<TrackerActionDeps['getState']>,
  progress: ProgressDoc,
  now: number
): Playthrough[] {
  const seasons = state.seasonsByTitle[title.id] || [];
  const computed = computeTitleState(title, seasons, progress, {
    includeSpecials: state.settings.includeSpecials,
  });
  return title.playthroughs.map((p) => {
    if (p.id !== title.activePlaythroughId) return p;
    if (computed.status === 'completed' || (computed.status === 'caught_up' && p.number > 1)) {
      return { ...p, completedAt: p.completedAt ?? now };
    }
    const { completedAt: _removed, ...rest } = p;
    return rest;
  });
}

export function createProgressActions(
  deps: TrackerActionDeps & {
    inFlightOps: Map<string, InFlightProgressOp>;
    triggerRefetch: () => Promise<void>;
  }
) {
  const { getState, setState, applyServerMutation, showToast, inFlightOps, triggerRefetch } = deps;

  async function executeAtomicProgressAndTitleOp(params: {
    titleId: string;
    playthroughId?: string;
    set?: Record<string, number>;
    unset?: string[];
    movieWatchedAt?: number | null;
    replaceWatched?: Record<string, number>;
    deletePlaythroughId?: string;
    titlePatch: Partial<Omit<TitleDoc, 'id'>>;
    prevWatchedValues: Record<string, number | undefined>;
    prevMovieWatchedAt: number | undefined;
    hadMovieWatchedAtChange: boolean;
    prevTitleFields: Partial<Omit<TitleDoc, 'id'>>;
    createdPlaythroughId?: string;
    deletedPlaythroughDoc?: ProgressDoc;
    now: number;
  }): Promise<void> {
    const {
      titleId,
      playthroughId,
      set,
      unset,
      movieWatchedAt,
      replaceWatched,
      deletePlaythroughId,
      titlePatch,
      prevWatchedValues,
      prevMovieWatchedAt,
      hadMovieWatchedAtChange,
      prevTitleFields,
      createdPlaythroughId,
      deletedPlaythroughDoc,
      now,
    } = params;

    const opId = createRandomId('op');
    const op: InFlightProgressOp = {
      id: opId,
      titleId,
      playthroughId,
      set,
      unset,
      movieWatchedAt,
      replaceWatched,
      deletePlaythroughId,
      titlePatch,
    };
    inFlightOps.set(opId, op);
    setState((curr) => applyInFlightOpsToState(curr, new Map([[opId, op]])));

    const hasProgressPayload =
      Boolean(playthroughId || deletePlaythroughId) &&
      Boolean(
        set ||
          unset ||
          movieWatchedAt !== undefined ||
          replaceWatched !== undefined ||
          deletePlaythroughId
      );

    try {
      const mut = await postTitleActionApi(titleId, {
        ...(hasProgressPayload
          ? {
              progress: {
                ...(playthroughId ? { playthroughId } : {}),
                ...(set ? { set } : {}),
                ...(unset ? { unset } : {}),
                ...(movieWatchedAt !== undefined ? { movieWatchedAt } : {}),
                ...(replaceWatched !== undefined ? { replaceWatched } : {}),
                ...(deletePlaythroughId ? { deletePlaythroughId } : {}),
              },
            }
          : {}),
        title: titlePatch,
      });

      inFlightOps.delete(opId);
      applyServerMutation(mut);
      if (inFlightOps.size > 0) {
        setState((curr) => applyInFlightOpsToState(curr, inFlightOps));
      }
    } catch {
      inFlightOps.delete(opId);

      setState((curr) => {
        const currentTitle = curr.titles[titleId];
        if (!currentTitle) return curr;

        const nextProgMap = { ...(curr.progressByTitle[titleId] || {}) };
        if (createdPlaythroughId) delete nextProgMap[createdPlaythroughId];
        if (deletePlaythroughId && deletedPlaythroughDoc) {
          nextProgMap[deletePlaythroughId] = deletedPlaythroughDoc;
        }

        if (playthroughId && !createdPlaythroughId) {
          const currProg = nextProgMap[playthroughId] || { playthroughId, watched: {} };
          const revertedWatched = { ...currProg.watched };
          for (const [epKey, prevVal] of Object.entries(prevWatchedValues)) {
            if (prevVal === undefined) delete revertedWatched[epKey];
            else revertedWatched[epKey] = prevVal;
          }
          const revertedMovieWatchedAt = hadMovieWatchedAtChange
            ? prevMovieWatchedAt
            : currProg.movieWatchedAt;

          nextProgMap[playthroughId] = {
            playthroughId,
            watched: revertedWatched,
            ...(revertedMovieWatchedAt !== undefined
              ? { movieWatchedAt: revertedMovieWatchedAt }
              : {}),
          };
        }

        let revertedTitle: TitleDoc = { ...currentTitle, ...prevTitleFields, id: titleId };
        const activeProg = nextProgMap[revertedTitle.activePlaythroughId] || {
          playthroughId: revertedTitle.activePlaythroughId,
          watched: {},
        };
        revertedTitle = {
          ...revertedTitle,
          playthroughs: recomputePlaythroughsForTitle(revertedTitle, curr, activeProg, now),
        };

        return {
          ...curr,
          titles: { ...curr.titles, [titleId]: revertedTitle },
          progressByTitle: { ...curr.progressByTitle, [titleId]: nextProgMap },
        };
      });

      showToast(zh.app.writeRollbackToast);
      await triggerRefetch();
    }
  }

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
    now: number
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
      now,
    });
  }

  async function toggleEpisode(titleId: string, episodeKey: string): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const prevProgress = getActiveProgressFromState(state, prevTitle);
    const now = Date.now();
    const res = toggleEpisodeWatched(
      prevTitle,
      state.seasonsByTitle[titleId] || [],
      prevProgress,
      episodeKey,
      { includeSpecials: state.settings.includeSpecials, now }
    );
    await commitComputedMutation(prevTitle, prevProgress, res, now);
  }

  async function toggleSeason(
    titleId: string,
    seasonNumber: number,
    markWatched: boolean
  ): Promise<void> {
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
      { includeSpecials: state.settings.includeSpecials, now }
    );
    await commitComputedMutation(prevTitle, prevProgress, res, now);
  }

  async function markUpTo(titleId: string, episodeKey: string): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const prevProgress = getActiveProgressFromState(state, prevTitle);
    const now = Date.now();
    const res = markUpToEpisode(
      prevTitle,
      state.seasonsByTitle[titleId] || [],
      prevProgress,
      episodeKey,
      { includeSpecials: state.settings.includeSpecials, now }
    );
    await commitComputedMutation(prevTitle, prevProgress, res, now);
  }

  async function markWholeTitle(titleId: string, markWatched: boolean): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const prevProgress = getActiveProgressFromState(state, prevTitle);
    const now = Date.now();
    const res = markWholeTitleWatched(
      prevTitle,
      state.seasonsByTitle[titleId] || [],
      prevProgress,
      markWatched,
      { includeSpecials: state.settings.includeSpecials, now }
    );
    await commitComputedMutation(prevTitle, prevProgress, res, now);
  }

  async function saveResume(
    titleId: string,
    resume: { episodeKey: string | null; seconds: number } | null
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
      }
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
      now,
    });
  }

  async function cancelTitleRewatch(titleId: string): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle || prevTitle.playthroughs.length <= 1) return;
    const prevProgressMap = state.progressByTitle[titleId] || {};
    const now = Date.now();
    const res = cancelRewatch(prevTitle, prevProgressMap);
    if (!res.removedPlaythroughId) return;

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
      now,
    });
  }

  return {
    toggleEpisode,
    toggleSeason,
    markUpTo,
    markWholeTitle,
    saveResume,
    startTitleRewatch,
    cancelTitleRewatch,
  };
}
