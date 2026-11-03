import {
  buildAiredEpisodeKeySet,
  type CountableEpisode,
  getCountableEpisodes,
  isShowEnded,
  makeEpisodeKey,
  toLocalDateString,
} from './airing.ts';
import { computeResumeRatio } from './time.ts';
import type {
  ProgressDoc,
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
 * Returns the progress bar ratio (0..1) for a title when displayed in Continue Watching or cards.
 */
export function getTitleContinueProgressRatio(
  title: Pick<TitleDoc, 'mediaType' | 'runtimeMin' | 'resume'>,
  seasons: SeasonDoc[],
  fallbackProgressRatio: number
): number {
  const resume = title.resume;
  if (resume && resume.seconds > 0) {
    if (resume.episodeKey) {
      let epRuntime: number | null | undefined = null;
      for (const s of seasons) {
        for (const ep of s.episodes) {
          const key = ep.key || makeEpisodeKey(s.seasonNumber, ep.number);
          if (key === resume.episodeKey) {
            epRuntime = ep.runtime;
            break;
          }
        }
        if (epRuntime !== null && epRuntime !== undefined) break;
      }
      const effectiveRuntime = epRuntime || title.runtimeMin;
      if (effectiveRuntime && effectiveRuntime > 0) {
        return computeResumeRatio(resume.seconds, effectiveRuntime);
      }
    } else if (title.runtimeMin && title.runtimeMin > 0) {
      return computeResumeRatio(resume.seconds, title.runtimeMin);
    }
  }
  return fallbackProgressRatio;
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
    showEnded?: boolean;
    allSeasons?: SeasonDoc[];
  } = {}
): ComputedSeasonState {
  const {
    todayStr = toLocalDateString(),
    treatAllAsAired = false,
    showEnded = false,
    allSeasons,
  } = options;
  const watchedMap = progress?.watched ?? {};
  const totalEpisodes = season.episodes.length;

  const airedKeys = buildAiredEpisodeKeySet(allSeasons ?? [season], {
    todayStr,
    treatAllAsAired,
    showEnded,
  });

  const airedEpisodes = season.episodes.filter((ep) => {
    const key = ep.key || makeEpisodeKey(season.seasonNumber, ep.number);
    return airedKeys.has(key);
  });
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
  > & { runtimeMin?: number | null },
  seasons: SeasonDoc[],
  progress: ProgressDoc | undefined | null,
  options: {
    includeSpecials?: boolean;
    todayStr?: string;
  } = {}
): ComputedTitleState {
  const { includeSpecials = false, todayStr = toLocalDateString() } = options;
  const treatAllAsAired = title.source === 'custom' || title.source === 'url';
  const showEnded = isShowEnded(title.showStatus, title.source);
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

  if (!hasSeasons) {
    const isWatched = Boolean(progress?.movieWatchedAt);
    const resumeSeconds = title.resume?.seconds ?? 0;
    const hasResume = resumeSeconds > 0;
    const movieResumeRatio = hasResume
      ? computeResumeRatio(resumeSeconds, title.runtimeMin)
      : 0;
    const progressRatio = isWatched ? 1 : movieResumeRatio;

    if (title.manualState === 'dropped' || title.manualState === 'paused') {
      const status = title.manualState;
      return {
        status,
        label: STATUS_LABELS[status],
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
        progressRatio: movieResumeRatio,
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

  const countable = getCountableEpisodes(seasons, {
    includeSpecials,
    todayStr,
    treatAllAsAired,
    showEnded,
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

  let resumeEpisodeFraction = 0;
  const resumePoint = title.resume;
  if (resumePoint && resumePoint.seconds > 0 && resumePoint.episodeKey) {
    const resumedEp = countable.find((ep) => ep.key === resumePoint.episodeKey);
    if (resumedEp && watchedMap[resumedEp.key] === undefined) {
      const epRuntime = resumedEp.runtime ?? title.runtimeMin;
      resumeEpisodeFraction = computeResumeRatio(resumePoint.seconds, epRuntime);
    }
  }

  const progressRatio =
    countableCount > 0
      ? Math.min(1, (watchedCount + resumeEpisodeFraction) / countableCount)
      : 0;
  const nextUp = unwatchedEpisodes[0] ?? null;

  if (title.manualState === 'dropped' || title.manualState === 'paused') {
    const status = title.manualState;
    return {
      status,
      label: STATUS_LABELS[status],
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

  const allAiredKeys = buildAiredEpisodeKeySet(seasons, {
    todayStr,
    treatAllAsAired,
    showEnded,
  });
  if (countableCount === 0 && allAiredKeys.size === 0) {
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

  const hasResume = Boolean(resumePoint && (resumePoint.seconds > 0 || resumePoint.episodeKey));
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

  if (countableCount > 0 && watchedCount === countableCount) {
    const status: TitleStatusCode = showEnded ? 'completed' : 'caught_up';
    return {
      status,
      label: STATUS_LABELS[status],
      hasNewEpisodes: false,
      countableCount,
      watchedCount,
      progressRatio: 1,
      nextUp: null,
      isRewatching: false,
      playthroughNumber: activePlaythrough.number,
      completedPlaythroughCount:
        showEnded || activePlaythrough.number > 1
          ? Math.max(activePlaythrough.number > 1 ? 2 : 1, completedPlaythroughCount)
          : completedPlaythroughCount,
    };
  }

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
