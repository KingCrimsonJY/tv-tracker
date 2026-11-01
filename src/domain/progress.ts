import type {
  DisplayLang,
  EpisodeMeta,
  LocalizedNames,
  ManualState,
  Playthrough,
  ProgressDoc,
  ResumePoint,
  SeasonDoc,
  SeasonStatusCode,
  TitleDoc,
  TitleStatusCode,
  TitleStatusLabel,
} from './types.ts';

export const STATUS_LABELS: Record<TitleStatusCode, TitleStatusLabel> = {
  unwatched: '未看',
  watching: '观看中',
  caught_up: '已追平',
  completed: '已看完',
  unaired: '未开播',
  paused: '暂停',
  dropped: '弃剧',
};

export interface CountableEpisode extends EpisodeMeta {
  seasonNumber: number;
}

export interface ComputedSeasonState {
  seasonNumber: number;
  state: SeasonStatusCode;
  totalEpisodes: number;
  airedCount: number;
  watchedCount: number;
  isCompleteSoFar: boolean;
}

export interface ComputedTitleState {
  status: TitleStatusCode;
  label: TitleStatusLabel;
  hasNewEpisodes: boolean;
  countableCount: number;
  watchedCount: number;
  progressRatio: number; // 0..1
  nextUp: CountableEpisode | null;
  isRewatching: boolean;
  playthroughNumber: number;
  completedPlaythroughCount: number;
}

/**
 * Formats season and episode numbers into `s{season}e{episode}` key (e.g. `s2e5`).
 */
export function makeEpisodeKey(seasonNumber: number, episodeNumber: number): string {
  return `s${seasonNumber}e${episodeNumber}`;
}

/**
 * Parses `s{season}e{episode}` key into season and episode numbers.
 */
export function parseEpisodeKey(key: string): { seasonNumber: number; episodeNumber: number } | null {
  const match = /^s(\d+)e(\d+)$/i.exec(key.trim());
  if (!match) return null;
  return {
    seasonNumber: Number(match[1]),
    episodeNumber: Number(match[2]),
  };
}

/**
 * Formats `s2e5` into `S2·E5` for display.
 */
export function formatEpisodeBadge(key: string): string {
  const parsed = parseEpisodeKey(key);
  if (!parsed) return key.toUpperCase();
  return `S${parsed.seasonNumber}·E${parsed.episodeNumber}`;
}

/**
 * Returns local YYYY-MM-DD date string from a Date or timestamp.
 */
export function toLocalDateString(dateOrTs: Date | number = new Date()): string {
  const d = typeof dateOrTs === 'number' ? new Date(dateOrTs) : dateOrTs;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Definition: aired(ep) -> has an airDate and airDate <= today (user's local date).
 * Custom items with episodes treat every episode as aired.
 */
export function isEpisodeAired(
  ep: Pick<EpisodeMeta, 'airDate'>,
  todayStr: string = toLocalDateString(),
  treatAllAsAired: boolean = false
): boolean {
  if (treatAllAsAired) return true;
  if (!ep.airDate || typeof ep.airDate !== 'string') return false;
  const trimmed = ep.airDate.trim();
  if (!trimmed) return false;
  return trimmed <= todayStr;
}

/**
 * Returns whether a show's status counts as permanently finished (Ended or Canceled).
 * Custom items with episodes are also treated as ended.
 */
export function isShowEnded(
  showStatus: string | null | undefined,
  source: TitleDoc['source'] = 'tmdb'
): boolean {
  if (source === 'custom' || source === 'url') return true;
  if (!showStatus) return false;
  const normalized = showStatus.trim().toLowerCase();
  return normalized === 'ended' || normalized === 'canceled' || normalized === 'cancelled';
}

/**
 * Returns sorted seasons and episodes in canonical order (by seasonNumber, then episode.number).
 */
export function sortSeasons(seasons: SeasonDoc[]): SeasonDoc[] {
  return [...seasons]
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .map((s) => ({
      ...s,
      episodes: [...s.episodes].sort((a, b) => a.number - b.number),
    }));
}

/**
 * Returns all countable episodes in order:
 * aired episodes in seasons >= 1 (or season 0 if includeSpecials is true).
 */
export function getCountableEpisodes(
  seasons: SeasonDoc[],
  options: {
    includeSpecials?: boolean;
    todayStr?: string;
    treatAllAsAired?: boolean;
  } = {}
): CountableEpisode[] {
  const {
    includeSpecials = false,
    todayStr = toLocalDateString(),
    treatAllAsAired = false,
  } = options;

  const sorted = sortSeasons(seasons);
  const result: CountableEpisode[] = [];

  for (const season of sorted) {
    if (season.seasonNumber < 0) continue;
    if (season.seasonNumber === 0 && !includeSpecials) continue;

    for (const ep of season.episodes) {
      if (isEpisodeAired(ep, todayStr, treatAllAsAired)) {
        result.push({
          ...ep,
          key: ep.key || makeEpisodeKey(season.seasonNumber, ep.number),
          seasonNumber: season.seasonNumber,
        });
      }
    }
  }

  return result;
}

/**
 * Computes the state of a single season: none / partial / complete.
 * A season with unaired episodes can be complete-so-far.
 */
export function computeSeasonState(
  season: SeasonDoc,
  progress: ProgressDoc | undefined | null,
  options: {
    todayStr?: string;
    treatAllAsAired?: boolean;
  } = {}
): ComputedSeasonState {
  const { todayStr = toLocalDateString(), treatAllAsAired = false } = options;
  const watchedMap = progress?.watched ?? {};
  const totalEpisodes = season.episodes.length;

  const airedEpisodes = season.episodes.filter((ep) =>
    isEpisodeAired(ep, todayStr, treatAllAsAired)
  );
  const airedCount = airedEpisodes.length;

  let watchedCount = 0;
  for (const ep of airedEpisodes) {
    const key = ep.key || makeEpisodeKey(season.seasonNumber, ep.number);
    if (watchedMap[key] !== undefined) {
      watchedCount++;
    }
  }

  let state: SeasonStatusCode = 'none';
  if (airedCount > 0 && watchedCount === airedCount) {
    state = 'complete';
  } else if (watchedCount > 0) {
    state = 'partial';
  }

  return {
    seasonNumber: season.seasonNumber,
    state,
    totalEpisodes,
    airedCount,
    watchedCount,
    isCompleteSoFar: state === 'complete' && airedCount < totalEpisodes,
  };
}

/**
 * Computes the derived status and progress of a title (TV, Movie, or Custom).
 * Never store derived status — always compute it from episode metadata + active playthrough progress + manualState.
 */
export function computeTitleState(
  title: Pick<
    TitleDoc,
    | 'source'
    | 'mediaType'
    | 'showStatus'
    | 'manualState'
    | 'resume'
    | 'playthroughs'
    | 'activePlaythroughId'
  >,
  seasons: SeasonDoc[],
  progress: ProgressDoc | undefined | null,
  options: {
    includeSpecials?: boolean;
    todayStr?: string;
  } = {}
): ComputedTitleState {
  const { includeSpecials = false, todayStr = toLocalDateString() } = options;
  const treatAllAsAired = title.source === 'custom' || title.source === 'url';
  const hasSeasons =
    title.mediaType === 'tv' ||
    (title.mediaType === 'other' && seasons.some((s) => s.episodes.length > 0));

  const activePlaythrough =
    title.playthroughs.find((p) => p.id === title.activePlaythroughId) ??
    title.playthroughs[title.playthroughs.length - 1] ?? {
      id: 'p1',
      number: 1,
      startedAt: 0,
    };

  const completedPlaythroughCount = title.playthroughs.filter((p) =>
    Boolean(p.completedAt)
  ).length;
  const isRewatching = activePlaythrough.number > 1 && !activePlaythrough.completedAt;

  // Movie or single item without episodes
  if (!hasSeasons) {
    const isWatched = Boolean(progress?.movieWatchedAt);
    const hasResume = Boolean(title.resume && title.resume.seconds > 0);
    const progressRatio = isWatched ? 1 : hasResume ? 0.5 : 0;

    if (title.manualState === 'dropped') {
      return {
        status: 'dropped',
        label: STATUS_LABELS.dropped,
        hasNewEpisodes: false,
        countableCount: 1,
        watchedCount: isWatched ? 1 : 0,
        progressRatio,
        nextUp: null,
        isRewatching,
        playthroughNumber: activePlaythrough.number,
        completedPlaythroughCount,
      };
    }

    if (title.manualState === 'paused') {
      return {
        status: 'paused',
        label: STATUS_LABELS.paused,
        hasNewEpisodes: false,
        countableCount: 1,
        watchedCount: isWatched ? 1 : 0,
        progressRatio,
        nextUp: null,
        isRewatching,
        playthroughNumber: activePlaythrough.number,
        completedPlaythroughCount,
      };
    }

    if (isWatched) {
      return {
        status: 'completed',
        label: STATUS_LABELS.completed,
        hasNewEpisodes: false,
        countableCount: 1,
        watchedCount: 1,
        progressRatio: 1,
        nextUp: null,
        isRewatching: false,
        playthroughNumber: activePlaythrough.number,
        completedPlaythroughCount: Math.max(1, completedPlaythroughCount),
      };
    }

    if (hasResume) {
      return {
        status: 'watching',
        label: STATUS_LABELS.watching,
        hasNewEpisodes: false,
        countableCount: 1,
        watchedCount: 0,
        progressRatio: 0.5,
        nextUp: null,
        isRewatching,
        playthroughNumber: activePlaythrough.number,
        completedPlaythroughCount,
      };
    }

    return {
      status: 'unwatched',
      label: STATUS_LABELS.unwatched,
      hasNewEpisodes: false,
      countableCount: 1,
      watchedCount: 0,
      progressRatio: 0,
      nextUp: null,
      isRewatching,
      playthroughNumber: activePlaythrough.number,
      completedPlaythroughCount,
    };
  }

  // TV or custom item with episodes
  const countable = getCountableEpisodes(seasons, {
    includeSpecials,
    todayStr,
    treatAllAsAired,
  });

  const watchedMap = progress?.watched ?? {};
  const watchedEpisodes: CountableEpisode[] = [];
  const unwatchedEpisodes: CountableEpisode[] = [];

  for (const ep of countable) {
    if (watchedMap[ep.key] !== undefined) {
      watchedEpisodes.push(ep);
    } else {
      unwatchedEpisodes.push(ep);
    }
  }

  const countableCount = countable.length;
  const watchedCount = watchedEpisodes.length;
  const progressRatio = countableCount > 0 ? watchedCount / countableCount : 0;
  const nextUp = unwatchedEpisodes[0] ?? null;

  // 1. manualState is dropped -> 弃剧; paused -> 暂停
  if (title.manualState === 'dropped') {
    return {
      status: 'dropped',
      label: STATUS_LABELS.dropped,
      hasNewEpisodes: false,
      countableCount,
      watchedCount,
      progressRatio,
      nextUp,
      isRewatching,
      playthroughNumber: activePlaythrough.number,
      completedPlaythroughCount,
    };
  }

  if (title.manualState === 'paused') {
    return {
      status: 'paused',
      label: STATUS_LABELS.paused,
      hasNewEpisodes: false,
      countableCount,
      watchedCount,
      progressRatio,
      nextUp,
      isRewatching,
      playthroughNumber: activePlaythrough.number,
      completedPlaythroughCount,
    };
  }

  // 2. Show has no aired episodes yet -> 未开播
  const anyAiredAcrossAllSeasons = seasons.some((s) =>
    s.episodes.some((ep) => isEpisodeAired(ep, todayStr, treatAllAsAired))
  );
  if (countableCount === 0 && !anyAiredAcrossAllSeasons) {
    return {
      status: 'unaired',
      label: STATUS_LABELS.unaired,
      hasNewEpisodes: false,
      countableCount: 0,
      watchedCount: 0,
      progressRatio: 0,
      nextUp: null,
      isRewatching,
      playthroughNumber: activePlaythrough.number,
      completedPlaythroughCount,
    };
  }

  // 3. No countable episode watched and no resume -> 未看
  const hasResume = Boolean(title.resume && (title.resume.seconds > 0 || title.resume.episodeKey));
  if (watchedCount === 0 && !hasResume) {
    return {
      status: 'unwatched',
      label: STATUS_LABELS.unwatched,
      hasNewEpisodes: false,
      countableCount,
      watchedCount: 0,
      progressRatio: 0,
      nextUp,
      isRewatching,
      playthroughNumber: activePlaythrough.number,
      completedPlaythroughCount,
    };
  }

  // 4. All countable episodes watched
  if (countableCount > 0 && watchedCount === countableCount) {
    const ended = isShowEnded(title.showStatus, title.source);
    const status: TitleStatusCode = ended ? 'completed' : 'caught_up';
    return {
      status,
      label: STATUS_LABELS[status],
      hasNewEpisodes: false,
      countableCount,
      watchedCount,
      progressRatio: 1,
      nextUp: null,
      isRewatching: ended ? false : isRewatching,
      playthroughNumber: activePlaythrough.number,
      completedPlaythroughCount: ended
        ? Math.max(1, completedPlaythroughCount)
        : completedPlaythroughCount,
    };
  }

  // 5. Otherwise -> 观看中.
  // Additionally flag 有新集 when every unwatched countable episode aired after the most recent watch timestamp
  // (i.e. the user was caught up and new episodes arrived).
  let hasNewEpisodes = false;
  if (watchedCount > 0 && unwatchedEpisodes.length > 0 && !treatAllAsAired) {
    let maxWatchedTs = 0;
    for (const ep of watchedEpisodes) {
      const ts = watchedMap[ep.key] ?? 0;
      if (ts > maxWatchedTs) {
        maxWatchedTs = ts;
      }
    }
    if (maxWatchedTs > 0) {
      const lastWatchDateStr = toLocalDateString(maxWatchedTs);
      hasNewEpisodes = unwatchedEpisodes.every(
        (ep) => Boolean(ep.airDate && ep.airDate > lastWatchDateStr)
      );
    }
  }

  return {
    status: 'watching',
    label: STATUS_LABELS.watching,
    hasNewEpisodes,
    countableCount,
    watchedCount,
    progressRatio,
    nextUp,
    isRewatching,
    playthroughNumber: activePlaythrough.number,
    completedPlaythroughCount,
  };
}

export interface MutationResult {
  manualState: ManualState;
  resume: ResumePoint | null;
  playthroughs: Playthrough[];
  activePlaythroughId: string;
  progress: ProgressDoc;
}

/**
 * Internal helper to sync `completedAt` on the active playthrough after a progress change.
 */
function syncPlaythroughCompletion(
  title: Pick<TitleDoc, 'source' | 'mediaType' | 'showStatus'>,
  seasons: SeasonDoc[],
  manualState: ManualState,
  resume: ResumePoint | null,
  playthroughs: Playthrough[],
  activePlaythroughId: string,
  progress: ProgressDoc,
  options: { includeSpecials?: boolean; todayStr?: string; now?: number }
): Playthrough[] {
  const { includeSpecials = false, todayStr = toLocalDateString(), now = Date.now() } = options;
  const computed = computeTitleState(
    {
      source: title.source,
      mediaType: title.mediaType,
      showStatus: title.showStatus,
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
    if (computed.status === 'completed') {
      return {
        ...p,
        completedAt: p.completedAt ?? now,
      };
    } else {
      const { completedAt: _removed, ...rest } = p;
      return rest;
    }
  });
}

/**
 * Action: Toggle a single episode's watched state.
 * - Only aired episodes can be checked. Unaired episodes are ignored.
 * - Checking any episode clears `manualState` automatically.
 * - Marking an episode watched clears `resume` if `resume.episodeKey` is that episode.
 * - Updates `completedAt` on the active playthrough when status becomes `已看完` (or clears it when unchecked).
 */
export function toggleEpisodeWatched(
  title: Pick<
    TitleDoc,
    | 'source'
    | 'mediaType'
    | 'showStatus'
    | 'manualState'
    | 'resume'
    | 'playthroughs'
    | 'activePlaythroughId'
  >,
  seasons: SeasonDoc[],
  progress: ProgressDoc,
  episodeKey: string,
  options: {
    includeSpecials?: boolean;
    todayStr?: string;
    now?: number;
  } = {}
): MutationResult {
  const { includeSpecials = false, todayStr = toLocalDateString(), now = Date.now() } = options;
  const treatAllAsAired = title.source === 'custom' || title.source === 'url';

  const isCurrentlyWatched = progress.watched[episodeKey] !== undefined;

  if (isCurrentlyWatched) {
    const nextWatched = { ...progress.watched };
    delete nextWatched[episodeKey];
    const nextProgress: ProgressDoc = {
      ...progress,
      watched: nextWatched,
    };
    const nextPlaythroughs = syncPlaythroughCompletion(
      title,
      seasons,
      title.manualState,
      title.resume,
      title.playthroughs,
      title.activePlaythroughId,
      nextProgress,
      { includeSpecials, todayStr, now }
    );
    return {
      manualState: title.manualState,
      resume: title.resume,
      playthroughs: nextPlaythroughs,
      activePlaythroughId: title.activePlaythroughId,
      progress: nextProgress,
    };
  }

  // Find the episode to verify it has aired
  let foundEp: EpisodeMeta | null = null;
  for (const s of seasons) {
    for (const ep of s.episodes) {
      const key = ep.key || makeEpisodeKey(s.seasonNumber, ep.number);
      if (key === episodeKey) {
        foundEp = ep;
        break;
      }
    }
    if (foundEp) break;
  }

  if (!foundEp || !isEpisodeAired(foundEp, todayStr, treatAllAsAired)) {
    // Unaired or non-existent episodes cannot be checked
    return {
      manualState: title.manualState,
      resume: title.resume,
      playthroughs: title.playthroughs,
      activePlaythroughId: title.activePlaythroughId,
      progress,
    };
  }

  const nextWatched = {
    ...progress.watched,
    [episodeKey]: now,
  };
  const nextProgress: ProgressDoc = {
    ...progress,
    watched: nextWatched,
  };
  const nextManualState: ManualState = null;
  const nextResume: ResumePoint | null =
    title.resume && title.resume.episodeKey === episodeKey ? null : title.resume;

  const nextPlaythroughs = syncPlaythroughCompletion(
    title,
    seasons,
    nextManualState,
    nextResume,
    title.playthroughs,
    title.activePlaythroughId,
    nextProgress,
    { includeSpecials, todayStr, now }
  );

  return {
    manualState: nextManualState,
    resume: nextResume,
    playthroughs: nextPlaythroughs,
    activePlaythroughId: title.activePlaythroughId,
    progress: nextProgress,
  };
}

/**
 * Action: Mark or unmark an entire season.
 * - Mark season checks every aired episode in that season.
 * - Unmark season clears every episode in that season.
 */
export function setSeasonWatched(
  title: Pick<
    TitleDoc,
    | 'source'
    | 'mediaType'
    | 'showStatus'
    | 'manualState'
    | 'resume'
    | 'playthroughs'
    | 'activePlaythroughId'
  >,
  seasons: SeasonDoc[],
  progress: ProgressDoc,
  seasonNumber: number,
  markWatched: boolean,
  options: {
    includeSpecials?: boolean;
    todayStr?: string;
    now?: number;
  } = {}
): MutationResult {
  const { includeSpecials = false, todayStr = toLocalDateString(), now = Date.now() } = options;
  const treatAllAsAired = title.source === 'custom' || title.source === 'url';
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

  const nextWatched = { ...progress.watched };
  const checkedKeys = new Set<string>();

  if (markWatched) {
    for (const ep of targetSeason.episodes) {
      if (isEpisodeAired(ep, todayStr, treatAllAsAired)) {
        const key = ep.key || makeEpisodeKey(targetSeason.seasonNumber, ep.number);
        if (nextWatched[key] === undefined) {
          nextWatched[key] = now;
        }
        checkedKeys.add(key);
      }
    }
  } else {
    for (const ep of targetSeason.episodes) {
      const key = ep.key || makeEpisodeKey(targetSeason.seasonNumber, ep.number);
      delete nextWatched[key];
    }
  }

  const nextProgress: ProgressDoc = {
    ...progress,
    watched: nextWatched,
  };

  const nextManualState: ManualState =
    markWatched && checkedKeys.size > 0 ? null : title.manualState;
  const nextResume: ResumePoint | null =
    markWatched && title.resume?.episodeKey && checkedKeys.has(title.resume.episodeKey)
      ? null
      : title.resume;

  const nextPlaythroughs = syncPlaythroughCompletion(
    title,
    seasons,
    nextManualState,
    nextResume,
    title.playthroughs,
    title.activePlaythroughId,
    nextProgress,
    { includeSpecials, todayStr, now }
  );

  return {
    manualState: nextManualState,
    resume: nextResume,
    playthroughs: nextPlaythroughs,
    activePlaythroughId: title.activePlaythroughId,
    progress: nextProgress,
  };
}

/**
 * Action: Mark up to here.
 * Checks every countable aired episode up to and including `targetEpisodeKey`, across seasons.
 * Never unchecks later episodes.
 */
export function markUpToEpisode(
  title: Pick<
    TitleDoc,
    | 'source'
    | 'mediaType'
    | 'showStatus'
    | 'manualState'
    | 'resume'
    | 'playthroughs'
    | 'activePlaythroughId'
  >,
  seasons: SeasonDoc[],
  progress: ProgressDoc,
  targetEpisodeKey: string,
  options: {
    includeSpecials?: boolean;
    todayStr?: string;
    now?: number;
  } = {}
): MutationResult {
  const { includeSpecials = false, todayStr = toLocalDateString(), now = Date.now() } = options;
  const treatAllAsAired = title.source === 'custom' || title.source === 'url';

  const countable = getCountableEpisodes(seasons, {
    includeSpecials,
    todayStr,
    treatAllAsAired,
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
    if (nextWatched[key] === undefined) {
      nextWatched[key] = now;
    }
    newlyCheckedKeys.add(key);
  }

  const nextProgress: ProgressDoc = {
    ...progress,
    watched: nextWatched,
  };

  const nextManualState: ManualState = null;
  const nextResume: ResumePoint | null =
    title.resume?.episodeKey && newlyCheckedKeys.has(title.resume.episodeKey)
      ? null
      : title.resume;

  const nextPlaythroughs = syncPlaythroughCompletion(
    title,
    seasons,
    nextManualState,
    nextResume,
    title.playthroughs,
    title.activePlaythroughId,
    nextProgress,
    { includeSpecials, todayStr, now }
  );

  return {
    manualState: nextManualState,
    resume: nextResume,
    playthroughs: nextPlaythroughs,
    activePlaythroughId: title.activePlaythroughId,
    progress: nextProgress,
  };
}

/**
 * Action: Mark whole title watched (or toggle movie watched).
 */
export function markWholeTitleWatched(
  title: Pick<
    TitleDoc,
    | 'source'
    | 'mediaType'
    | 'showStatus'
    | 'manualState'
    | 'resume'
    | 'playthroughs'
    | 'activePlaythroughId'
  >,
  seasons: SeasonDoc[],
  progress: ProgressDoc,
  markWatched: boolean = true,
  options: {
    includeSpecials?: boolean;
    todayStr?: string;
    now?: number;
  } = {}
): MutationResult {
  const { includeSpecials = false, todayStr = toLocalDateString(), now = Date.now() } = options;
  const treatAllAsAired = title.source === 'custom' || title.source === 'url';
  const hasSeasons =
    title.mediaType === 'tv' ||
    (title.mediaType === 'other' && seasons.some((s) => s.episodes.length > 0));

  if (!hasSeasons) {
    const nextProgress: ProgressDoc = {
      ...progress,
      movieWatchedAt: markWatched ? now : undefined,
    };
    if (!markWatched) {
      delete nextProgress.movieWatchedAt;
    }
    const nextManualState: ManualState = markWatched ? null : title.manualState;
    const nextResume: ResumePoint | null = markWatched ? null : title.resume;

    const nextPlaythroughs = syncPlaythroughCompletion(
      title,
      seasons,
      nextManualState,
      nextResume,
      title.playthroughs,
      title.activePlaythroughId,
      nextProgress,
      { includeSpecials, todayStr, now }
    );

    return {
      manualState: nextManualState,
      resume: nextResume,
      playthroughs: nextPlaythroughs,
      activePlaythroughId: title.activePlaythroughId,
      progress: nextProgress,
    };
  }

  const countable = getCountableEpisodes(seasons, {
    includeSpecials,
    todayStr,
    treatAllAsAired,
  });

  const nextWatched = markWatched ? { ...progress.watched } : {};
  if (markWatched) {
    for (const ep of countable) {
      if (nextWatched[ep.key] === undefined) {
        nextWatched[ep.key] = now;
      }
    }
  }

  const nextProgress: ProgressDoc = {
    ...progress,
    watched: nextWatched,
  };
  const nextManualState: ManualState = markWatched ? null : title.manualState;
  const nextResume: ResumePoint | null = markWatched ? null : title.resume;

  const nextPlaythroughs = syncPlaythroughCompletion(
    title,
    seasons,
    nextManualState,
    nextResume,
    title.playthroughs,
    title.activePlaythroughId,
    nextProgress,
    { includeSpecials, todayStr, now }
  );

  return {
    manualState: nextManualState,
    resume: nextResume,
    playthroughs: nextPlaythroughs,
    activePlaythroughId: title.activePlaythroughId,
    progress: nextProgress,
  };
}

/**
 * Action: Set or clear resume time.
 * Setting a resume time clears `manualState` automatically.
 */
export function setResumePoint(
  title: Pick<TitleDoc, 'manualState' | 'resume'>,
  resume: { episodeKey: string | null; seconds: number } | null,
  now: number = Date.now()
): { manualState: ManualState; resume: ResumePoint | null } {
  if (!resume || resume.seconds <= 0) {
    return {
      manualState: title.manualState,
      resume: null,
    };
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

/**
 * Action: Start rewatch (二刷).
 * Available when status is 已看完 or 已追平.
 * Creates a new playthrough (`number + 1`), makes it active, and starts with empty progress.
 */
export function startRewatch(
  title: Pick<
    TitleDoc,
    | 'source'
    | 'mediaType'
    | 'showStatus'
    | 'manualState'
    | 'resume'
    | 'playthroughs'
    | 'activePlaythroughId'
  >,
  seasons: SeasonDoc[],
  currentProgress: ProgressDoc,
  options: {
    includeSpecials?: boolean;
    todayStr?: string;
    now?: number;
    newPlaythroughId?: string;
  } = {}
): MutationResult {
  const {
    includeSpecials = false,
    todayStr = toLocalDateString(),
    now = Date.now(),
    newPlaythroughId = `p_${now}`,
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
    progress: {
      playthroughId: newPlaythrough.id,
      watched: {},
    },
  };
}

/**
 * Action: Cancel an active rewatch (二刷中).
 * Deletes the active rewatch playthrough and restores the previous one.
 */
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

/**
 * Parses `h:mm:ss` or `mm:ss` into total seconds.
 * Validates against optional `runtimeMinutes` when known.
 */
export function parseTimeInput(
  input: string,
  runtimeMinutes?: number | null
): { ok: true; seconds: number } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: '请输入有效的时间格式（如 42:15 或 1:12:30）' };
  }

  const parts = trimmed.split(':');
  if (parts.length !== 2 && parts.length !== 3) {
    return { ok: false, error: '时间格式应为 mm:ss 或 h:mm:ss' };
  }

  if (parts.some((p) => !/^\d+$/.test(p))) {
    return { ok: false, error: '时间只能包含数字和冒号' };
  }

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (parts.length === 2) {
    minutes = Number(parts[0]);
    seconds = Number(parts[1]);
  } else {
    hours = Number(parts[0]);
    minutes = Number(parts[1]);
    seconds = Number(parts[2]);
    if (minutes >= 60) {
      return { ok: false, error: '分钟数应小于 60' };
    }
  }

  if (seconds >= 60) {
    return { ok: false, error: '秒数应小于 60' };
  }

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  if (totalSeconds <= 0) {
    return { ok: false, error: '观看时间需大于 0 秒' };
  }

  if (runtimeMinutes && runtimeMinutes > 0) {
    const maxSeconds = runtimeMinutes * 60;
    if (totalSeconds > maxSeconds) {
      return {
        ok: false,
        error: `超出正片时长（最长 ${runtimeMinutes} 分钟）`,
      };
    }
  }

  return { ok: true, seconds: totalSeconds };
}

/**
 * Formats seconds into `h:mm:ss` or `mm:ss`.
 */
export function formatSeconds(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Resolves the display title and subtitle (original title if different) for a title.
 */
export function resolveDisplayTitle(
  names: LocalizedNames,
  titleLang: DisplayLang | null,
  defaultLang: 'zh' | 'original' | 'en' = 'zh'
): { primary: string; secondary: string | null } {
  const effective = titleLang ?? defaultLang;
  let primary = names.original;

  if (effective === 'custom' && names.custom) {
    primary = names.custom;
  } else if (effective === 'zh') {
    primary = names.zh || names.original || names.en || '未命名';
  } else if (effective === 'en') {
    primary = names.en || names.original || names.zh || 'Untitled';
  } else {
    primary = names.original || names.zh || names.en || 'Untitled';
  }

  const secondary =
    names.original && names.original.trim() !== primary.trim() ? names.original : null;

  return { primary, secondary };
}
