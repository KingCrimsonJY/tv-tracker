import { toLocalDateString } from '../../domain/airing.ts';
import { type BatchStatus, planBatchListEntries, planBatchStatus } from '../../domain/batch.ts';
import { createRandomId } from '../../domain/id.ts';
import type { ProgressDoc, TitleDoc } from '../../domain/types.ts';
import { batchTitlesApi } from '../api.ts';
import { composeOverlays, patchTitles, putProgress, removeTitles, updateEntries } from '../overlays.ts';
import type { Commit } from './commit.ts';
import type { TrackerActionDeps } from './types.ts';

/** How many titles the batch changed and whether the server stored it (false after a rollback). */
export interface BatchOutcome {
  changed: number;
  stored: boolean;
}

const NOTHING_TO_DO: BatchOutcome = { changed: 0, stored: true };

/**
 * Library batch management. The result is planned with the same functions the server uses and shown at
 * once; the request is one atomic write, answered and broadcast as one mutation.
 */
export function createBatchActions({ getState }: TrackerActionDeps, { commit }: Commit) {
  const existing = (titleIds: readonly string[]) => {
    const titles = getState().titles;
    return [...new Set(titleIds)].filter((id) => titles[id]);
  };

  async function batchSetStatus(titleIds: readonly string[], status: BatchStatus): Promise<BatchOutcome> {
    const state = getState();
    const now = Date.now();
    const todayStr = toLocalDateString();
    const titles: Record<string, TitleDoc> = {};
    const progress: Record<string, ProgressDoc> = {};
    for (const id of existing(titleIds)) {
      const title = state.titles[id];
      const change = planBatchStatus(
        title,
        state.seasonsByTitle[id] ?? [],
        state.progressByTitle[id]?.[title.activePlaythroughId],
        status,
        { includeSpecials: state.settings.includeSpecials, todayStr, now },
      );
      if (!change) continue;
      titles[id] = change.title;
      if (change.progress) progress[id] = change.progress;
    }
    const ids = Object.keys(titles);
    if (ids.length === 0) return NOTHING_TO_DO;
    const stored = await commit(composeOverlays(patchTitles(titles), putProgress(progress)), () =>
      batchTitlesApi(ids, { type: 'status', status, todayStr, now }),
    );
    return { changed: ids.length, stored };
  }

  async function batchAddToList(titleIds: readonly string[], listId: string): Promise<BatchOutcome> {
    const state = getState();
    if (!state.lists[listId]) return NOTHING_TO_DO;
    const now = Date.now();
    // Placeholder entries: the server assigns the real ids, which replace these when its mutation arrives.
    const planned = planBatchListEntries(state.entriesByList[listId] ?? [], existing(titleIds), now, () =>
      createRandomId('entry'),
    );
    if (planned.length === 0) return NOTHING_TO_DO;
    const ids = planned.map((entry) => entry.titleId);
    const stored = await commit(
      updateEntries(listId, (entries) => {
        const present = new Set(entries.map((entry) => entry.titleId));
        const missing = planned.filter((entry) => !present.has(entry.titleId));
        return missing.length ? [...entries, ...missing] : entries;
      }),
      () => batchTitlesApi(ids, { type: 'addToList', listId, now }),
    );
    return { changed: ids.length, stored };
  }

  async function batchRemoveTitles(titleIds: readonly string[]): Promise<BatchOutcome> {
    const ids = existing(titleIds);
    if (ids.length === 0) return NOTHING_TO_DO;
    const stored = await commit(removeTitles(ids), () => batchTitlesApi(ids, { type: 'delete' }));
    return { changed: ids.length, stored };
  }

  return { batchSetStatus, batchAddToList, batchRemoveTitles };
}
