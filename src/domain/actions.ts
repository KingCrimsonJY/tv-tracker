import {
  buildAiredEpisodeKeySet,
  getCountableEpisodes,
  isShowEnded,
  makeEpisodeKey,
  toLocalDateString,
} from './airing.ts';
import { createRandomId } from './id.ts';
import { computeTitleState } from './status.ts';
import type {
  ManualState,
  Playthrough,
  ProgressDoc,
  ResumePoint,
  SeasonDoc,
  TitleDoc,
} from './types.ts';

export interface MutationResult {
  manualState: ManualState;
  resume: ResumePoint | null;
  playthroughs: Playthrough[];
  activePlaythroughId: string;
  progress: ProgressDoc;
}

type ActionTitleInput = Pick<
  TitleDoc,
  | 'source'
  | 'mediaType'
  | 'showStatus'
  | 'manualState'
  | 'resume'
  | 'playthroughs'
  | 'activePlaythroughId'
> & { runtimeMin?: number | null };

interface ActionOptions {
  includeSpecials?: boolean;
  todayStr?: string;
  now?: number;
}

function syncPlaythroughCompletion(
  title: Pick<TitleDoc, 'source' | 'mediaType' | 'showStatus'> & { runtimeMin?: number | null },
  seasons: SeasonDoc[],
  manualState: ManualState,
  resume: ResumePoint | null,
  playthroughs: Playthrough[],
  activePlaythroughId: string,
  progress: ProgressDoc,
  options: ActionOptions
): Playthrough[] {
  const { includeSpecials = false, todayStr = toLocalDateString(), now = Date.now() } = options;
  const computed = computeTitleState(
    {
      source: title.source,
      mediaType: title.mediaType,
      showStatus: title.showStatus,
      runtimeMin: title.runtimeMin,
      manualState,
      resume,
      playthroughs,
      activePlaythroughId,
    },
    seasons,
    progress,
    { includeSpecials, todayStr }
  );

  return playthroughs.map((p) => {
    if (p.id !== activePlaythroughId) return p;
    if (computed.status === 'completed' || (computed.status === 'caught_up' && p.number > 1)) {
      return { ...p, completedAt: p.completedAt ?? now };
    }
    const { completedAt: _removed, ...rest } = p;
    return rest;
  });
}

export function toggleEpisodeWatched(
  title: ActionTitleInput,
  seasons: SeasonDoc[],
  progress: ProgressDoc,
  episodeKey: string,
  options: ActionOptions = {}
): MutationResult {
  const { includeSpecials = false, todayStr = toLocalDateString(), now = Date.now() } = options;
  const treatAllAsAired = title.source === 'custom' || title.source === 'url';
  const showEnded = isShowEnded(title.showStatus, title.source);

  if (progress.watched[episodeKey] !== undefined) {
    const nextWatched = { ...progress.watched };
    delete nextWatched[episodeKey];
    const nextProgress: ProgressDoc = { ...progress, watched: nextWatched };
    return {
      manualState: title.manualState,
      resume: title.resume,
      playthroughs: syncPlaythroughCompletion(
        title,
        seasons,
        title.manualState,
        title.resume,
        title.playthroughs,
        title.activePlaythroughId,
        nextProgress,
        { includeSpecials, todayStr, now }
      ),
      activePlaythroughId: title.activePlaythroughId,
      progress: nextProgress,
    };
  }

  const airedKeys = buildAiredEpisodeKeySet(seasons, { todayStr, treatAllAsAired, showEnded });
  if (!airedKeys.has(episodeKey)) {
    return {
      manualState: title.manualState,
      resume: title.resume,
      playthroughs: title.playthroughs,
      activePlaythroughId: title.activePlaythroughId,
      progress,
    };
  }

  const nextProgress: ProgressDoc = {
    ...progress,
    watched: { ...progress.watched, [episodeKey]: now },
  };
  const nextManualState: ManualState = null;
  const nextResume: ResumePoint | null =
    title.resume && title.resume.episodeKey === episodeKey ? null : title.resume;

  return {
    manualState: nextManualState,
    resume: nextResume,
    playthroughs: syncPlaythroughCompletion(
      title,
      seasons,
      nextManualState,
      nextResume,
      title.playthroughs,
      title.activePlaythroughId,
      nextProgress,
      { includeSpecials, todayStr, now }
    ),
    activePlaythroughId: title.activePlaythroughId,
    progress: nextProgress,
  };
}

export function setSeasonWatched(
  title: ActionTitleInput,
  seasons: SeasonDoc[],
  progress: ProgressDoc,
  seasonNumber: number,
  markWatched: boolean,
  options: ActionOptions = {}
): MutationResult {
  const { includeSpecials = false, todayStr = toLocalDateString(), now = Date.now() } = options;
  const treatAllAsAired = title.source === 'custom' || title.source === 'url';
  const showEnded = isShowEnded(title.showStatus, title.source);
  const targetSeason = seasons.find((s) => s.seasonNumber === seasonNumber);

  if (!targetSeason) {
    return {
      manualState: title.manualState,
      resume: title.resume,
      playthroughs: title.playthroughs,
      activePlaythroughId: title.activePlaythroughId,
      progress,
    };
  }

  const airedKeys = buildAiredEpisodeKeySet(seasons, { todayStr, treatAllAsAired, showEnded });
  const nextWatched = { ...progress.watched };
  const checkedKeys = new Set<string>();

  if (markWatched) {
    for (const ep of targetSeason.episodes) {
      const key = ep.key || makeEpisodeKey(targetSeason.seasonNumber, ep.number);
      if (airedKeys.has(key)) {
        if (nextWatched[key] === undefined) nextWatched[key] = now;
        checkedKeys.add(key);
      }
    }
  } else {
    for (const ep of targetSeason.episodes) {
      const key = ep.key || makeEpisodeKey(targetSeason.seasonNumber, ep.number);
      delete nextWatched[key];
    }
  }

  const nextProgress: ProgressDoc = { ...progress, watched: nextWatched };
  const nextManualState: ManualState =
    markWatched && checkedKeys.size > 0 ? null : title.manualState;
  const nextResume: ResumePoint | null =
    markWatched && title.resume?.episodeKey && checkedKeys.has(title.resume.episodeKey)
      ? null
      : title.resume;

  return {
    manualState: nextManualState,
    resume: nextResume,
    playthroughs: syncPlaythroughCompletion(
      title,
      seasons,
      nextManualState,
      nextResume,
      title.playthroughs,
      title.activePlaythroughId,
      nextProgress,
      { includeSpecials, todayStr, now }
    ),
    activePlaythroughId: title.activePlaythroughId,
    progress: nextProgress,
  };
}

export function markUpToEpisode(
  title: ActionTitleInput,
  seasons: SeasonDoc[],
  progress: ProgressDoc,
  targetEpisodeKey: string,
  options: ActionOptions = {}
): MutationResult {
  const { includeSpecials = false, todayStr = toLocalDateString(), now = Date.now() } = options;
  const treatAllAsAired = title.source === 'custom' || title.source === 'url';
  const showEnded = isShowEnded(title.showStatus, title.source);

  const countable = getCountableEpisodes(seasons, {
    includeSpecials,
    todayStr,
    treatAllAsAired,
    showEnded,
  });

  const targetIdx = countable.findIndex((ep) => ep.key === targetEpisodeKey);
  if (targetIdx === -1) {
    return {
      manualState: title.manualState,
      resume: title.resume,
      playthroughs: title.playthroughs,
      activePlaythroughId: title.activePlaythroughId,
      progress,
    };
  }

  const nextWatched = { ...progress.watched };
  const newlyCheckedKeys = new Set<string>();
  for (let i = 0; i <= targetIdx; i++) {
    const key = countable[i].key;
    if (nextWatched[key] === undefined) nextWatched[key] = now;
    newlyCheckedKeys.add(key);
  }

  const nextProgress: ProgressDoc = { ...progress, watched: nextWatched };
  const nextManualState: ManualState = null;
  const nextResume: ResumePoint | null =
    title.resume?.episodeKey && newlyCheckedKeys.has(title.resume.episodeKey)
      ? null
      : title.resume;

  return {
    manualState: nextManualState,
    resume: nextResume,
    playthroughs: syncPlaythroughCompletion(
      title,
      seasons,
      nextManualState,
      nextResume,
      title.playthroughs,
      title.activePlaythroughId,
      nextProgress,
      { includeSpecials, todayStr, now }
    ),
    activePlaythroughId: title.activePlaythroughId,
    progress: nextProgress,
  };
}

export function markWholeTitleWatched(
  title: ActionTitleInput,
  seasons: SeasonDoc[],
  progress: ProgressDoc,
  markWatched: boolean = true,
  options: ActionOptions = {}
): MutationResult {
  const { includeSpecials = false, todayStr = toLocalDateString(), now = Date.now() } = options;
  const treatAllAsAired = title.source === 'custom' || title.source === 'url';
  const showEnded = isShowEnded(title.showStatus, title.source);
  const hasSeasons =
    title.mediaType === 'tv' ||
    (title.mediaType === 'other' && seasons.some((s) => s.episodes.length > 0));

  if (!hasSeasons) {
    const nextProgress: ProgressDoc = {
      ...progress,
      ...(markWatched ? { movieWatchedAt: now } : {}),
    };
    if (!markWatched) delete nextProgress.movieWatchedAt;
    const nextManualState: ManualState = markWatched ? null : title.manualState;
    const nextResume: ResumePoint | null = markWatched ? null : title.resume;
    return {
      manualState: nextManualState,
      resume: nextResume,
      playthroughs: syncPlaythroughCompletion(
        title,
        seasons,
        nextManualState,
        nextResume,
        title.playthroughs,
        title.activePlaythroughId,
        nextProgress,
        { includeSpecials, todayStr, now }
      ),
      activePlaythroughId: title.activePlaythroughId,
      progress: nextProgress,
    };
  }

  const countable = getCountableEpisodes(seasons, {
    includeSpecials,
    todayStr,
    treatAllAsAired,
    showEnded,
  });

  const nextWatched = markWatched ? { ...progress.watched } : {};
  if (markWatched) {
    for (const ep of countable) {
      if (nextWatched[ep.key] === undefined) nextWatched[ep.key] = now;
    }
  }

  const nextProgress: ProgressDoc = { ...progress, watched: nextWatched };
  const nextManualState: ManualState = markWatched ? null : title.manualState;
  const nextResume: ResumePoint | null = markWatched ? null : title.resume;

  return {
    manualState: nextManualState,
    resume: nextResume,
    playthroughs: syncPlaythroughCompletion(
      title,
      seasons,
      nextManualState,
      nextResume,
      title.playthroughs,
      title.activePlaythroughId,
      nextProgress,
      { includeSpecials, todayStr, now }
    ),
    activePlaythroughId: title.activePlaythroughId,
    progress: nextProgress,
  };
}

export function setResumePoint(
  title: Pick<TitleDoc, 'manualState' | 'resume'>,
  resume: { episodeKey: string | null; seconds: number } | null,
  now: number = Date.now()
): { manualState: ManualState; resume: ResumePoint | null } {
  if (!resume || resume.seconds <= 0) {
    return { manualState: title.manualState, resume: null };
  }
  return {
    manualState: null,
    resume: {
      episodeKey: resume.episodeKey,
      seconds: Math.floor(resume.seconds),
      updatedAt: now,
    },
  };
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
    throw new Error('Can only start a rewatch when status is 已看完 or 已追平');
  }

  const maxNumber = title.playthroughs.reduce((max, p) => Math.max(max, p.number), 0);
  const newPlaythrough: Playthrough = {
    id: newPlaythroughId,
    number: maxNumber + 1,
    startedAt: now,
  };

  return {
    manualState: null,
    resume: null,
    playthroughs: [...title.playthroughs, newPlaythrough],
    activePlaythroughId: newPlaythrough.id,
    progress: { playthroughId: newPlaythrough.id, watched: {} },
  };
}

export function cancelRewatch(
  title: Pick<TitleDoc, 'playthroughs' | 'activePlaythroughId' | 'manualState' | 'resume'>,
  progressByPlaythrough: Record<string, ProgressDoc> = {}
): MutationResult & { removedPlaythroughId: string } {
  if (title.playthroughs.length <= 1) {
    throw new Error('Cannot cancel the initial playthrough');
  }
  const removedPlaythroughId = title.activePlaythroughId;
  const remaining = title.playthroughs.filter((p) => p.id !== removedPlaythroughId);
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
    removedPlaythroughId,
  };
}
