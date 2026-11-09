import { getActiveCatalog, translateErrorObject } from '../../i18n/index.ts';
import { computeTitleState } from '../../domain/progress.ts';
import type { Playthrough, ProgressDoc, TitleDoc } from '../../domain/types.ts';
import { createRandomId } from '../../domain/id.ts';
import { postTitleActionApi } from '../api.ts';
import { applyInFlightOpsToState, type InFlightProgressOp, type TrackerActionDeps } from './types.ts';

function recomputePlaythroughsForTitle(
  title: TitleDoc,
  state: ReturnType<TrackerActionDeps['getState']>,
  progress: ProgressDoc,
  now: number,
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

export interface AtomicProgressOpParams {
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
  /** The active playthrough this write was computed from; the server rejects stale writes. */
  expectedActivePlaythroughId: string;
  deletedPlaythroughDoc?: ProgressDoc;
  now: number;
}

/**
 * Send one progress + title change through POST /api/titles/:id/actions with an optimistic update.
 * On failure only this operation is rolled back, then the state is refetched.
 */
export function createAtomicProgressOp(
  deps: TrackerActionDeps & { inFlightOps: Map<string, InFlightProgressOp>; triggerRefetch: () => Promise<void> },
) {
  const { setState, applyServerMutation, showToast, inFlightOps, triggerRefetch } = deps;
  return async function executeAtomicProgressAndTitleOp(params: AtomicProgressOpParams): Promise<void> {
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
      expectedActivePlaythroughId,
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
      Boolean(set || unset || movieWatchedAt !== undefined || replaceWatched !== undefined || deletePlaythroughId);

    try {
      const mut = await postTitleActionApi(titleId, {
        expectedActivePlaythroughId,
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
    } catch (error) {
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
          const revertedMovieWatchedAt = hadMovieWatchedAtChange ? prevMovieWatchedAt : currProg.movieWatchedAt;

          nextProgMap[playthroughId] = {
            ...currProg,
            playthroughId,
            watched: revertedWatched,
            ...(revertedMovieWatchedAt !== undefined ? { movieWatchedAt: revertedMovieWatchedAt } : {}),
          };
        }

        let revertedTitle: TitleDoc = { ...currentTitle, ...prevTitleFields, id: titleId };
        const activeProg = nextProgMap[revertedTitle.activePlaythroughId] || {
          playthroughId: revertedTitle.activePlaythroughId,
          watched: {},
        };
        revertedTitle = {
          ...revertedTitle,
          playthroughs:
            prevTitleFields.playthroughs ?? recomputePlaythroughsForTitle(revertedTitle, curr, activeProg, now),
        };

        return {
          ...curr,
          titles: { ...curr.titles, [titleId]: revertedTitle },
          progressByTitle: { ...curr.progressByTitle, [titleId]: nextProgMap },
        };
      });

      showToast(translateErrorObject(error, getActiveCatalog(), getActiveCatalog().app.writeRollbackToast), 'danger');
      await triggerRefetch();
    }
  };
}
