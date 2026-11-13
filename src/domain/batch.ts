import { generateNKeysBetween } from 'fractional-indexing';
import { markWholeTitleWatched } from './actions.ts';
import { computeTitleState } from './status.ts';
import type { ListEntryDoc, ProgressDoc, SeasonDoc, TitleDoc } from './types.ts';

/**
 * Library batch management. These functions are the single definition of what a batch does to one title:
 * the server runs them inside one transaction and the client runs them to show the result at once.
 */

/** `active` clears a paused/dropped mark; the other values name the state a title is moved into. */
export const BATCH_STATUSES = ['watched', 'unwatched', 'paused', 'dropped', 'active'] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const BATCH_MAX_TITLES = 1000;

export type BatchAction =
  | { type: 'status'; status: BatchStatus; todayStr: string; now: number }
  | { type: 'addToList'; listId: string; now: number }
  | { type: 'delete' };

export interface BatchStatusChange {
  title: TitleDoc;
  /** Present only when watched marks changed. */
  progress?: ProgressDoc;
}

/**
 * What `status` turns one title into, or null when the title is already there (or cannot get there: a title
 * that has not been released cannot be marked watched, as on its own page).
 */
export function planBatchStatus(
  title: TitleDoc,
  seasons: SeasonDoc[],
  progress: ProgressDoc | undefined,
  status: BatchStatus,
  options: { includeSpecials: boolean; todayStr: string; now: number },
): BatchStatusChange | null {
  const { now } = options;
  const touched = { updatedAt: now, lastActivityAt: now };

  if (status === 'paused' || status === 'dropped' || status === 'active') {
    const manualState = status === 'active' ? null : status;
    return title.manualState === manualState ? null : { title: { ...title, manualState, ...touched } };
  }

  const current = progress ?? { playthroughId: title.activePlaythroughId, watched: {} };
  if (status === 'watched') {
    const state = computeTitleState(title, seasons, current, options);
    if (state.status === 'unreleased' || state.status === 'unaired') return null;
  }
  const next = markWholeTitleWatched(title, seasons, current, status === 'watched', options);
  const progressChanged =
    next.progress.movieWatchedAt !== current.movieWatchedAt ||
    Object.keys(next.progress.watched).length !== Object.keys(current.watched).length ||
    Object.keys(next.progress.watched).some((key) => current.watched[key] === undefined);
  const titleChanged =
    next.manualState !== title.manualState ||
    JSON.stringify(next.resume) !== JSON.stringify(title.resume) ||
    JSON.stringify(next.playthroughs) !== JSON.stringify(title.playthroughs);
  if (!progressChanged && !titleChanged) return null;
  return {
    title: {
      ...title,
      manualState: next.manualState,
      resume: next.resume,
      playthroughs: next.playthroughs,
      ...touched,
    },
    ...(progressChanged ? { progress: next.progress } : {}),
  };
}

/**
 * Entries that append `titleIds` to a list in the given order, skipping titles already in it.
 * `existing` is the list's current entries in any order.
 */
export function planBatchListEntries(
  existing: readonly ListEntryDoc[],
  titleIds: readonly string[],
  now: number,
  newId: () => string,
): ListEntryDoc[] {
  const present = new Set(existing.map((entry) => entry.titleId));
  const additions = [...new Set(titleIds)].filter((titleId) => !present.has(titleId));
  if (additions.length === 0) return [];
  const lastRank = existing.reduce<string | null>(
    (last, entry) => (last === null || entry.rank > last ? entry.rank : last),
    null,
  );
  const ranks = generateNKeysBetween(lastRank, null, additions.length);
  return additions.map((titleId, index) => ({ id: newId(), titleId, rank: ranks[index], addedAt: now }));
}
