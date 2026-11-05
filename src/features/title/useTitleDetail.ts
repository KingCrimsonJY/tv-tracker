import { useEffect, useMemo, useRef, useState } from 'react';
import { useTracker } from '../../context/TrackerContext';
import {
  buildAiredEpisodeKeySet,
  computeSeasonState,
  computeTitleState,
  formatSeconds,
  isShowEnded,
  resolveDisplayTitle,
} from '../../domain/progress';
import { zh } from '../../i18n/zh';

export function useTitleDetail(titleId: string | undefined) {
  const tracker = useTracker();
  const {
    titles,
    seasonsByTitle,
    settings,
    getActiveProgress,
    fetchAndCacheTitleRatings,
    refreshTitleMetadata,
    markUpTo,
    setTitleManualState,
  } = tracker;

  const title = titleId ? titles[titleId] : undefined;
  const seasons = useMemo(
    () => (titleId ? seasonsByTitle[titleId] || [] : []),
    [seasonsByTitle, titleId]
  );

  const regularSeasons = useMemo(
    () =>
      seasons
        .filter((s) => s.seasonNumber >= 1)
        .sort((a, b) => a.seasonNumber - b.seasonNumber),
    [seasons]
  );
  const specialsSeason = useMemo(
    () => seasons.find((s) => s.seasonNumber === 0),
    [seasons]
  );

  const airedKeySet = useMemo(() => {
    if (!title) return new Set<string>();
    const treatAllAsAired = title.source === 'custom' || title.source === 'url';
    const showEnded = isShowEnded(title.showStatus, title.source);
    return buildAiredEpisodeKeySet(seasons, { treatAllAsAired, showEnded });
  }, [title, seasons]);

  const progress = useMemo(
    () => (title ? getActiveProgress(title) : undefined),
    [title, getActiveProgress]
  );

  const state = useMemo(() => {
    if (!title) return null;
    return computeTitleState(title, seasons, progress, {
      includeSpecials: settings.includeSpecials,
    });
  }, [title, seasons, progress, settings.includeSpecials]);

  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(1);
  const [overviewExpanded, setOverviewExpanded] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeEpisodeKey, setResumeEpisodeKey] = useState<string>('');
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [addToListModalOpen, setAddToListModalOpen] = useState(false);

  // Metadata refresh on detail open (24h for ongoing, 30 days for ended/movies) + OMDb ratings (7 days)
  const refreshedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (title && refreshedIdRef.current !== title.id) {
      refreshedIdRef.current = title.id;
      if (title.source === 'tmdb') {
        void fetchAndCacheTitleRatings(title.id);
        const now = Date.now();
        const ended = isShowEnded(title.showStatus, title.source);
        const ttl =
          title.mediaType === 'tv' && !ended
            ? 24 * 3600 * 1000
            : 30 * 24 * 3600 * 1000;
        if (!title.metaFetchedAt || now - title.metaFetchedAt > ttl) {
          void refreshTitleMetadata(title.id);
        }
      }
    }
  }, [title, fetchAndCacheTitleRatings, refreshTitleMetadata]);

  useEffect(() => {
    if (!state) return;
    if (title?.resume?.episodeKey) {
      const m = /^s(\d+)e\d+$/i.exec(title.resume.episodeKey);
      if (m) {
        const sNum = Number(m[1]);
        if (sNum >= 1) {
          setSelectedSeasonNum(sNum);
          return;
        }
      }
    }
    if (state.nextUp && state.nextUp.seasonNumber >= 1) {
      setSelectedSeasonNum(state.nextUp.seasonNumber);
    } else if (regularSeasons.length > 0) {
      setSelectedSeasonNum(regularSeasons[0].seasonNumber);
    }
  }, [title?.id, title?.resume?.episodeKey, state, regularSeasons]);

  const currentSeason = useMemo(
    () =>
      regularSeasons.find((s) => s.seasonNumber === selectedSeasonNum) ||
      regularSeasons[0],
    [regularSeasons, selectedSeasonNum]
  );

  const currentSeasonState = useMemo(() => {
    if (!currentSeason || !title) return null;
    return computeSeasonState(currentSeason, progress, {
      treatAllAsAired: title.source === 'custom' || title.source === 'url',
      showEnded: isShowEnded(title.showStatus, title.source),
      allSeasons: seasons,
    });
  }, [currentSeason, title, progress, seasons]);

  const specialsSeasonState = useMemo(() => {
    if (!specialsSeason || !title) return null;
    return computeSeasonState(specialsSeason, progress, {
      treatAllAsAired: title.source === 'custom' || title.source === 'url',
      showEnded: isShowEnded(title.showStatus, title.source),
      allSeasons: seasons,
    });
  }, [specialsSeason, title, progress, seasons]);

  const displayNames = useMemo(() => {
    if (!title) return { primary: '', secondary: undefined as string | undefined };
    const resolved = resolveDisplayTitle(
      title.names,
      title.displayLang,
      settings.defaultTitleLang
    );
    return {
      primary: resolved.primary,
      secondary: resolved.secondary ?? undefined,
    };
  }, [title, settings.defaultTitleLang]);

  const overviewText = useMemo(() => {
    if (!title) return zh.detail.overview.empty;
    const effectiveLang = title.displayLang ?? settings.defaultTitleLang;
    return (
      (effectiveLang === 'en'
        ? title.overview.en || title.overview.zh
        : title.overview.zh || title.overview.en) || zh.detail.overview.empty
    );
  }, [title, settings.defaultTitleLang]);

  const metaParts = useMemo(() => {
    if (!title) return [];
    const parts: string[] = [];
    if (title.year) parts.push(String(title.year));
    parts.push(zh.mediaType[title.mediaType]);
    const isSingleSeasonCustomOrUrl =
      (title.source === 'custom' || title.source === 'url') &&
      regularSeasons.length === 1;
    if (title.mediaType === 'movie' && title.runtimeMin) {
      parts.push(zh.detail.seasons.runtimeMinutes(title.runtimeMin));
    } else if (isSingleSeasonCustomOrUrl) {
      parts.push(zh.detail.seasons.episodeCountMeta(regularSeasons[0].episodes.length));
    } else if (regularSeasons.length > 0) {
      parts.push(zh.detail.seasons.seasonCountMeta(regularSeasons.length));
    }
    if (title.genres.length > 0) {
      parts.push(title.genres.slice(0, 2).join(' / '));
    }
    return parts;
  }, [title, regularSeasons]);

  const openResumeModal = (epKey?: string) => {
    if (!title || !state) return;
    const defaultKey =
      epKey ||
      title.resume?.episodeKey ||
      state.nextUp?.key ||
      regularSeasons[0]?.episodes[0]?.key ||
      '';
    setResumeEpisodeKey(defaultKey);
    setMenuOpen(false);
    setResumeOpen(true);
  };

  const handlePrimaryAction = async () => {
    if (!title || !state) return;
    if (state.status === 'unaired') return;

    if (state.status === 'completed' || state.status === 'caught_up') {
      await tracker.startTitleRewatch(title.id);
      return;
    }

    if (state.status === 'paused' || state.status === 'dropped') {
      await setTitleManualState(title.id, null);
      return;
    }

    const isEpisodic = title.mediaType === 'tv' || regularSeasons.length > 0;
    if (!isEpisodic) {
      await tracker.markWholeTitle(title.id, true);
      return;
    }

    if (title.resume?.episodeKey && airedKeySet.has(title.resume.episodeKey)) {
      await tracker.toggleEpisode(title.id, title.resume.episodeKey);
      return;
    }

    if (state.nextUp) {
      await tracker.toggleEpisode(title.id, state.nextUp.key);
    }
  };

  const getPrimaryActionLabel = (): string => {
    if (!title || !state) return '';
    if (state.status === 'unaired') return zh.detail.primaryAction.unaired;
    if (state.status === 'completed') return zh.detail.primaryAction.completedStartRewatch;
    if (state.status === 'caught_up') return zh.detail.primaryAction.caughtUpStartRewatch;
    if (state.status === 'paused' || state.status === 'dropped') {
      return zh.detail.menu.clearManualState;
    }

    const isEpisodic = title.mediaType === 'tv' || regularSeasons.length > 0;
    if (!isEpisodic) {
      if (title.resume && title.resume.seconds > 0) {
        return `${zh.detail.primaryAction.continueMovie(
          formatSeconds(title.resume.seconds)
        )} · ${zh.detail.primaryAction.markMovieWatched}`;
      }
      return zh.detail.primaryAction.markMovieWatched;
    }

    if (title.resume?.episodeKey) {
      const m = /^s(\d+)e(\d+)$/i.exec(title.resume.episodeKey);
      if (m) {
        return zh.detail.primaryAction.continueEpisode(
          Number(m[1]),
          Number(m[2]),
          formatSeconds(title.resume.seconds)
        );
      }
    }

    if (state.nextUp) {
      return zh.detail.primaryAction.markEpisodeWatched(
        state.nextUp.seasonNumber,
        state.nextUp.number
      );
    }

    return zh.detail.primaryAction.startWatching;
  };

  const hasMovieResume = Boolean(
    title &&
      title.mediaType === 'movie' &&
      state?.status !== 'completed' &&
      title.resume &&
      title.resume.seconds > 0
  );

  const movieResumePct =
    hasMovieResume && title?.runtimeMin && title.runtimeMin > 0 && title.resume
      ? Math.max(
          2,
          Math.min(100, Math.round((title.resume.seconds / (title.runtimeMin * 60)) * 100))
        )
      : 50;

  return {
    tracker,
    title,
    seasons,
    regularSeasons,
    specialsSeason,
    airedKeySet,
    progress,
    state,
    selectedSeasonNum,
    setSelectedSeasonNum,
    currentSeason,
    currentSeasonState,
    specialsSeasonState,
    primary: displayNames.primary,
    secondary: displayNames.secondary,
    overviewText,
    overviewExpanded,
    setOverviewExpanded,
    metaParts,
    menuOpen,
    setMenuOpen,
    resumeOpen,
    setResumeOpen,
    resumeEpisodeKey,
    setResumeEpisodeKey,
    openResumeModal,
    langModalOpen,
    setLangModalOpen,
    editModalOpen,
    setEditModalOpen,
    addToListModalOpen,
    setAddToListModalOpen,
    handlePrimaryAction,
    primaryActionLabel: getPrimaryActionLabel(),
    hasMovieResume,
    movieResumePct,
    markEpisodeUpTo: markUpTo,
  };
}
