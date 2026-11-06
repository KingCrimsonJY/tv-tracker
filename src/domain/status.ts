import {
  buildAiredEpisodeKeySet,
  type CountableEpisode,
  getCountableEpisodes,
  isShowEnded,
  toLocalDateString,
} from './airing.ts';
import { computeResumeRatio } from './time.ts';
import type {
  ProgressDoc,
  SeasonDoc,
  SeasonStateCode,
  TitleDoc,
  TitleStatusCode,
} from './types.ts';

export interface ComputedTitleState {
  status: TitleStatusCode;
  isEpisodic: boolean;
  hasNewEpisodes: boolean;
  nextUp: CountableEpisode | null;
  watchedCount: number;
  countableCount: number;
  progressRatio: number; // 0..1
  isRewatching: boolean;
  activePlaythroughNumber: number;
  playthroughNumber: number;
  completedPlaythroughCount: number;
}

export interface ComputedSeasonState {
  seasonNumber: number;
  state: SeasonStateCode;
  watchedCount: number;
  airedCount: number;
  totalCount: number;
  isCompleteSoFar: boolean;
}

export function isEpisodic(
  title: Pick<TitleDoc, 'mediaType'>,
  seasons: SeasonDoc[]
): boolean {
  return (
    title.mediaType === 'tv' ||
    seasons.some((s) => s.seasonNumber >= 1 && s.episodes.length > 0)
  );
}

export function computeSeasonState(
  season: SeasonDoc,
  progress: ProgressDoc | undefined,
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

  const airedKeys = buildAiredEpisodeKeySet(allSeasons ?? [season], {
    todayStr,
    treatAllAsAired,
    showEnded,
  });

  let airedCount = 0;
  let watchedCount = 0;
  const totalCount = season.episodes.length;

  for (const ep of season.episodes) {
    const aired = airedKeys.has(ep.key);
    if (aired) {
      airedCount++;
      if (watchedMap[ep.key] !== undefined) {
        watchedCount++;
      }
    }
  }

  let state: SeasonStateCode = 'none';
  if (airedCount > 0 && watchedCount >= airedCount) {
    state = 'complete';
  } else if (watchedCount > 0) {
    state = 'partial';
  }

  return {
    seasonNumber: season.seasonNumber,
    state,
    watchedCount,
    airedCount,
    totalCount,
    isCompleteSoFar: state === 'complete' && airedCount < totalCount,
  };
}

export function getTitleContinueProgressRatio(
  title: Pick<TitleDoc, 'mediaType' | 'resume'> & { runtimeMin?: number | null },
  seasons: SeasonDoc[],
  overallProgressRatio: number
): number {
  const resume = title.resume;
  if (!resume || resume.seconds <= 0) {
    return overallProgressRatio;
  }

  if (!isEpisodic(title, seasons) || !resume.episodeKey) {
    if (title.runtimeMin && title.runtimeMin > 0) {
      return computeResumeRatio(resume.seconds, title.runtimeMin);
    }
    return overallProgressRatio;
  }

  let epRuntime: number | null = null;
  for (const s of seasons) {
    const found = s.episodes.find((ep) => ep.key === resume.episodeKey);
    if (found) {
      epRuntime = found.runtime;
      break;
    }
  }

  const effectiveRuntime =
    epRuntime && epRuntime > 0
      ? epRuntime
      : title.runtimeMin && title.runtimeMin > 0
        ? title.runtimeMin
        : null;

  if (effectiveRuntime && effectiveRuntime > 0) {
    return computeResumeRatio(resume.seconds, effectiveRuntime);
  }

  return overallProgressRatio;
}

export function computeTitleState(
  title: Pick<
    TitleDoc,
    | 'mediaType'
    | 'source'
    | 'showStatus'
    | 'manualState'
    | 'resume'
    | 'playthroughs'
    | 'activePlaythroughId'
  > & { runtimeMin?: number | null; releaseDate?: string | null },
  seasons: SeasonDoc[],
  progress: ProgressDoc | undefined,
  options: { includeSpecials?: boolean; todayStr?: string } = {}
): ComputedTitleState {
  const { includeSpecials = false, todayStr = toLocalDateString() } = options;

  const activePlaythrough =
    title.playthroughs.find((p) => p.id === title.activePlaythroughId) ??
    title.playthroughs[title.playthroughs.length - 1] ?? {
      id: 'p1',
      number: 1,
      startedAt: 0,
    };

  const completedPlaythroughCount = title.playthroughs.filter(
    (p) => p.completedAt !== undefined && p.completedAt !== null
  ).length;

  const episodic = isEpisodic(title, seasons);

  if (!episodic) {
    const isWatched = Boolean(
      progress?.movieWatchedAt ||
        (progress?.watched && Object.keys(progress.watched).length > 0)
    );
    const hasResume = Boolean(title.resume && title.resume.seconds > 0);
    const isUnreleasedMovie =
      title.mediaType === 'movie' &&
      Boolean(
        title.releaseDate &&
          title.releaseDate.trim() !== '' &&
          title.releaseDate.trim() > todayStr
      );

    let status: TitleStatusCode;
    if (title.manualState === 'dropped') {
      status = 'dropped';
    } else if (title.manualState === 'paused') {
      status = 'paused';
    } else if (isWatched) {
      status = 'completed';
    } else if (hasResume) {
      status = 'watching';
    } else if (isUnreleasedMovie) {
      status = 'unreleased';
    } else {
      status = 'unwatched';
    }

    const movieResumeRatio =
      hasResume && title.resume
        ? title.runtimeMin && title.runtimeMin > 0
          ? computeResumeRatio(title.resume.seconds, title.runtimeMin)
          : 0.5
        : 0;

    return {
      status,
      isEpisodic: false,
      hasNewEpisodes: false,
      nextUp: null,
      watchedCount: isWatched ? 1 : 0,
      countableCount: 1,
      progressRatio: isWatched ? 1 : movieResumeRatio,
      isRewatching:
        activePlaythrough.number > 1 && status !== 'completed' && !activePlaythrough.completedAt,
      activePlaythroughNumber: activePlaythrough.number,
      playthroughNumber: activePlaythrough.number,
      completedPlaythroughCount:
        status === 'completed' && !activePlaythrough.completedAt
          ? completedPlaythroughCount + 1
          : completedPlaythroughCount,
    };
  }

  const treatAllAsAired = title.source === 'custom' || title.source === 'url';
  const showEnded = isShowEnded(title.showStatus, title.source);
  const { countable, hasAnyAiredEpisode } = getCountableEpisodes(seasons, {
    includeSpecials,
    todayStr,
    treatAllAsAired,
    showEnded,
  });

  const watchedMap = progress?.watched ?? {};
  let watchedCount = 0;
  let nextUp: CountableEpisode | null = null;
  let maxWatchedAt = 0;
  const unwatchedCountable: CountableEpisode[] = [];

  for (const ep of countable) {
    const ts = watchedMap[ep.key];
    if (ts !== undefined) {
      watchedCount++;
      if (ts > maxWatchedAt) {
        maxWatchedAt = ts;
      }
    } else {
      unwatchedCountable.push(ep);
      if (!nextUp) {
        nextUp = ep;
      }
    }
  }

  const countableCount = countable.length;
  const hasResume = Boolean(title.resume && title.resume.seconds > 0);
  const progressRatio =
    countableCount > 0 ? Math.min(1, watchedCount / countableCount) : 0;

  if (title.manualState === 'dropped') {
    return {
      status: 'dropped',
      isEpisodic: true,
      hasNewEpisodes: false,
      nextUp,
      watchedCount,
      countableCount,
      progressRatio,
      isRewatching: false,
      activePlaythroughNumber: activePlaythrough.number,
      playthroughNumber: activePlaythrough.number,
      completedPlaythroughCount,
    };
  }
  if (title.manualState === 'paused') {
    return {
      status: 'paused',
      isEpisodic: true,
      hasNewEpisodes: false,
      nextUp,
      watchedCount,
      countableCount,
      progressRatio,
      isRewatching: false,
      activePlaythroughNumber: activePlaythrough.number,
      playthroughNumber: activePlaythrough.number,
      completedPlaythroughCount,
    };
  }

  if (!hasAnyAiredEpisode && countableCount === 0) {
    return {
      status: 'unaired',
      isEpisodic: true,
      hasNewEpisodes: false,
      nextUp: null,
      watchedCount: 0,
      countableCount: 0,
      progressRatio: 0,
      isRewatching: false,
      activePlaythroughNumber: activePlaythrough.number,
      playthroughNumber: activePlaythrough.number,
      completedPlaythroughCount,
    };
  }

  if (watchedCount === 0 && !hasResume) {
    return {
      status: 'unwatched',
      isEpisodic: true,
      hasNewEpisodes: false,
      nextUp,
      watchedCount: 0,
      countableCount,
      progressRatio: 0,
      isRewatching: activePlaythrough.number > 1,
      activePlaythroughNumber: activePlaythrough.number,
      playthroughNumber: activePlaythrough.number,
      completedPlaythroughCount,
    };
  }

  if (countableCount > 0 && watchedCount >= countableCount) {
    const ended = isShowEnded(title.showStatus, title.source);
    const status: TitleStatusCode = ended ? 'completed' : 'caught_up';
    return {
      status,
      isEpisodic: true,
      hasNewEpisodes: false,
      nextUp: null,
      watchedCount,
      countableCount,
      progressRatio: 1,
      isRewatching: false,
      activePlaythroughNumber: activePlaythrough.number,
      playthroughNumber: activePlaythrough.number,
      completedPlaythroughCount:
        status === 'completed' && !activePlaythrough.completedAt
          ? completedPlaythroughCount + 1
          : completedPlaythroughCount,
    };
  }

  let hasNewEpisodes = false;
  if (watchedCount > 0 && unwatchedCountable.length > 0 && maxWatchedAt > 0) {
    const lastWatchedDateStr = toLocalDateString(new Date(maxWatchedAt));
    hasNewEpisodes = unwatchedCountable.every(
      (ep) => ep.airDate !== null && ep.airDate > lastWatchedDateStr
    );
  }

  return {
    status: 'watching',
    isEpisodic: true,
    hasNewEpisodes,
    nextUp,
    watchedCount,
    countableCount,
    progressRatio,
    isRewatching: activePlaythrough.number > 1,
    activePlaythroughNumber: activePlaythrough.number,
    playthroughNumber: activePlaythrough.number,
    completedPlaythroughCount,
  };
}
