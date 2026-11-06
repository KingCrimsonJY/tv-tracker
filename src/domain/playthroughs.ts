import { toLocalDateString } from './airing.ts';
import type { ActionOptions, ActionTitleInput, MutationResult } from './actions.ts';
import { createRandomId } from './id.ts';
import { computeTitleState } from './status.ts';
import type { Playthrough, ProgressDoc, SeasonDoc, TitleDoc } from './types.ts';

export function renumberPlaythroughsByStartDate(playthroughs: Playthrough[]): Playthrough[] {
  return [...playthroughs]
    .sort((a, b) => a.startedAt - b.startedAt || a.number - b.number)
    .map((p, idx) => ({
      ...p,
      number: idx + 1,
    }));
}

export function startRewatch(
  title: ActionTitleInput,
  seasons: SeasonDoc[],
  currentProgress: ProgressDoc,
  options: ActionOptions & { newPlaythroughId?: string } = {}
): MutationResult {
  const {
    includeSpecials = false,
    todayStr = toLocalDateString(),
    now = Date.now(),
    newPlaythroughId = createRandomId('p'),
  } = options;

  const computed = computeTitleState(title, seasons, currentProgress, {
    includeSpecials,
    todayStr,
  });
  if (computed.status !== 'completed' && computed.status !== 'caught_up') {
    throw new Error('Can only start a rewatch when status is completed or caught_up');
  }

  const ordered = renumberPlaythroughsByStartDate(title.playthroughs);
  const newPlaythrough: Playthrough = {
    id: newPlaythroughId,
    number: ordered.length + 1,
    startedAt: now,
  };
  const nextPlaythroughs = renumberPlaythroughsByStartDate([...ordered, newPlaythrough]);

  return {
    manualState: null,
    resume: null,
    playthroughs: nextPlaythroughs,
    activePlaythroughId: newPlaythrough.id,
    progress: { playthroughId: newPlaythrough.id, watched: {} },
  };
}

export interface UndoPlaythroughResult extends MutationResult {
  removedPlaythroughId?: string;
  clearedPlaythroughId?: string;
}

export function undoLatestPlaythrough(
  title: Pick<TitleDoc, 'playthroughs' | 'activePlaythroughId' | 'manualState' | 'resume'>,
  progressByPlaythrough: Record<string, ProgressDoc> = {}
): UndoPlaythroughResult {
  const ordered = renumberPlaythroughsByStartDate(title.playthroughs);

  if (ordered.length <= 1) {
    const only = ordered[0] ?? {
      id: title.activePlaythroughId || 'p1',
      number: 1,
      startedAt: 0,
    };
    const { completedAt: _removed, ...restOnly } = only;
    const resetPlaythrough: Playthrough = {
      ...restOnly,
      number: 1,
    };
    const emptyProgress: ProgressDoc = {
      playthroughId: resetPlaythrough.id,
      watched: {},
    };
    return {
      manualState: null,
      resume: null,
      playthroughs: [resetPlaythrough],
      activePlaythroughId: resetPlaythrough.id,
      progress: emptyProgress,
      removedPlaythroughId: undefined,
      clearedPlaythroughId: resetPlaythrough.id,
    };
  }

  const latest = ordered[ordered.length - 1];
  const remaining = renumberPlaythroughsByStartDate(
    ordered.filter((p) => p.id !== latest.id)
  );
  const restored = remaining[remaining.length - 1];
  const restoredProgress = progressByPlaythrough?.[restored.id] ?? {
    playthroughId: restored.id,
    watched: {},
  };

  return {
    manualState: title.manualState,
    resume: null,
    playthroughs: remaining,
    activePlaythroughId: restored.id,
    progress: restoredProgress,
    removedPlaythroughId: latest.id,
    clearedPlaythroughId: undefined,
  };
}

export const cancelRewatch = undoLatestPlaythrough;

export function deletePlaythrough(
  title: Pick<TitleDoc, 'playthroughs' | 'activePlaythroughId' | 'manualState' | 'resume'>,
  playthroughId: string,
  progressByPlaythrough: Record<string, ProgressDoc> = {}
): UndoPlaythroughResult {
  const ordered = renumberPlaythroughsByStartDate(title.playthroughs);
  const exists = ordered.some((p) => p.id === playthroughId);
  if (!exists) {
    const activeProg = progressByPlaythrough?.[title.activePlaythroughId] ?? {
      playthroughId: title.activePlaythroughId,
      watched: {},
    };
    return {
      manualState: title.manualState,
      resume: title.resume,
      playthroughs: ordered,
      activePlaythroughId: title.activePlaythroughId,
      progress: activeProg,
    };
  }

  if (ordered.length <= 1) {
    return undoLatestPlaythrough(title, progressByPlaythrough);
  }

  const remaining = renumberPlaythroughsByStartDate(
    ordered.filter((p) => p.id !== playthroughId)
  );
  const isDeletingActiveOrLatest =
    playthroughId === title.activePlaythroughId ||
    playthroughId === ordered[ordered.length - 1].id;

  const nextActiveId = isDeletingActiveOrLatest
    ? remaining[remaining.length - 1].id
    : remaining.some((p) => p.id === title.activePlaythroughId)
      ? title.activePlaythroughId
      : remaining[remaining.length - 1].id;

  const nextProgress = progressByPlaythrough?.[nextActiveId] ?? {
    playthroughId: nextActiveId,
    watched: {},
  };

  return {
    manualState: title.manualState,
    resume: isDeletingActiveOrLatest ? null : title.resume,
    playthroughs: remaining,
    activePlaythroughId: nextActiveId,
    progress: nextProgress,
    removedPlaythroughId: playthroughId,
    clearedPlaythroughId: undefined,
  };
}
