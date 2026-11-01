import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit3,
  ExternalLink,
  FolderPlus,
  Languages,
  MoreHorizontal,
  PauseCircle,
  Play,
  RefreshCw,
  RotateCcw,
  Trash2,
  Undo2,
} from 'lucide-react';
import { Button, Drawer, Modal, ProgressBar, Tabs } from '@heroui/react';
import { MediaImage } from '../components/MediaImage';
import { useTracker } from '../context/TrackerContext';
import {
  buildAiredEpisodeKeySet,
  computeResumeRatio,
  computeSeasonState,
  computeTitleState,
  formatEpisodeBadge,
  formatSeconds,
  isShowEnded,
  makeEpisodeKey,
  parseEpisodeKey,
  parseTimeInput,
  resolveDisplayTitle,
  sortSeasons,
} from '../domain/progress';
import type { DisplayLang, MediaType } from '../domain/types';
import { zh } from '../i18n/zh';

export const TitleDetailPage: React.FC = () => {
  const { titleId } = useParams<{ titleId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    loadingData,
    titles,
    seasonsByTitle,
    lists,
    entriesByList,
    settings,
    getActiveProgress,
    toggleEpisode,
    toggleSeason,
    markUpTo,
    markWholeTitle,
    saveResume,
    startTitleRewatch,
    cancelTitleRewatch,
    setTitleManualState,
    updateTitleLanguage,
    updateTitleDetails,
    fetchAndCacheTitleRatings,
    refreshTitleMetadata,
    removeTitle,
    addTitleToList,
    removeEntryFromList,
  } = useTracker();

  const title = titleId ? titles[titleId] : undefined;
  const rawSeasons = useMemo(
    () => (titleId ? seasonsByTitle[titleId] || [] : []),
    [titleId, seasonsByTitle]
  );
  const seasons = useMemo(() => sortSeasons(rawSeasons), [rawSeasons]);
  const sortedSeasons = seasons;
  const regularSeasons = useMemo(
    () => seasons.filter((s) => s.seasonNumber >= 1),
    [seasons]
  );
  const specialsSeason = useMemo(
    () => seasons.find((s) => s.seasonNumber === 0) || null,
    [seasons]
  );

  const treatAllAsAired = title?.source === 'custom' || title?.source === 'url';
  const showEnded = title ? isShowEnded(title.showStatus, title.source) : false;

  // Item 1: Build aired episode key set that treats episodes with no airDate as aired if the show is Ended/Canceled or any later episode has aired
  const airedKeySet = useMemo(
    () =>
      buildAiredEpisodeKeySet(seasons, {
        treatAllAsAired,
        showEnded,
      }),
    [seasons, treatAllAsAired, showEnded]
  );

  const progress = title ? getActiveProgress(title) : undefined;
  const state = useMemo(
    () =>
      title
        ? computeTitleState(title, sortedSeasons, progress, {
            includeSpecials: settings.includeSpecials,
          })
        : null,
    [title, sortedSeasons, progress, settings.includeSpecials]
  );

  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(1);
  const [overviewExpanded, setOverviewExpanded] = useState(false);

  // Secondary actions sheet / modal
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [addToListOpen, setAddToListOpen] = useState(false);

  // Resume time modal state
  const [resumeModalOpen, setResumeModalOpen] = useState(false);
  const [resumeEpisodeKey, setResumeEpisodeKey] = useState<string | null>(null);
  const [resumeInputStr, setResumeInputStr] = useState('');
  const [resumeError, setResumeError] = useState<string | null>(null);

  // Title language modal state
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState<DisplayLang | null>(null);
  const [customTitleInput, setCustomTitleInput] = useState('');

  // Edit title & Douban modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editOrigName, setEditOrigName] = useState('');
  const [editMediaType, setEditMediaType] = useState<MediaType>('movie');
  const [editYear, setEditYear] = useState('');
  const [editRuntime, setEditRuntime] = useState('');
  const [editEpisodeCount, setEditEpisodeCount] = useState('');
  const [editPosterUrl, setEditPosterUrl] = useState('');
  const [editOverview, setEditOverview] = useState('');
  const [editDoubanScore, setEditDoubanScore] = useState('');
  const [editDoubanUrl, setEditDoubanUrl] = useState('');

  // Active row action menu episode key
  const [activeRowMenuKey, setActiveRowMenuKey] = useState<string | null>(null);

  // Set initial active season based on ?episode= param or nextUp or resume
  useEffect(() => {
    if (!title || regularSeasons.length === 0) return;
    const epParam = searchParams.get('episode');
    if (epParam) {
      const parsed = parseEpisodeKey(epParam);
      if (parsed && parsed.seasonNumber >= 1) {
        setSelectedSeasonNum(parsed.seasonNumber);
        setTimeout(() => {
          const el = document.getElementById(`ep-row-${epParam}`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
        return;
      }
    }
    if (title.resume?.episodeKey) {
      const parsed = parseEpisodeKey(title.resume.episodeKey);
      if (parsed && parsed.seasonNumber >= 1) {
        setSelectedSeasonNum(parsed.seasonNumber);
        return;
      }
    }
    if (state?.nextUp && state.nextUp.seasonNumber >= 1) {
      setSelectedSeasonNum(state.nextUp.seasonNumber);
      return;
    }
    setSelectedSeasonNum(regularSeasons[0].seasonNumber);
  }, [title?.id, regularSeasons.length, searchParams]);

  // Auto-refresh metadata if stale (24h for ongoing TV, 30 days otherwise) + 7-day ratings cache
  useEffect(() => {
    if (!title) return;
    fetchAndCacheTitleRatings(title.id);

    if (title.source !== 'tmdb') return;
    const now = Date.now();
    const fetchedAt = title.metaFetchedAt || 0;
    const ended = isShowEnded(title.showStatus, title.source) || title.mediaType === 'movie';
    const maxAgeMs = ended ? 30 * 24 * 3600 * 1000 : 24 * 3600 * 1000;
    if (now - fetchedAt > maxAgeMs) {
      refreshTitleMetadata(title.id);
    }
  }, [title?.id]);

  // Item 5: Show a skeleton, not "未找到", while loading
  if (loadingData && !title) {
    return (
      <div className="pb-16" aria-label="正在加载作品详情">
        <div className="w-full h-[46vh] sm:h-[50vh] min-h-[300px] max-h-[520px] bg-[var(--surface)] animate-pulse" />
        <div className="px-4 sm:px-6 lg:px-10 -mt-28 sm:-mt-36 space-y-8 relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 sm:gap-7">
            <div className="hidden sm:block w-36 md:w-44 aspect-[2/3] rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] animate-pulse" />
            <div className="flex-1 space-y-3 w-full">
              <div className="h-4 w-24 rounded bg-[var(--surface-secondary)] animate-pulse" />
              <div className="h-9 w-64 rounded-lg bg-[var(--surface-secondary)] animate-pulse" />
              <div className="h-4 w-48 rounded bg-[var(--surface-secondary)] animate-pulse" />
              <div className="h-12 w-48 rounded-xl bg-[var(--surface-secondary)] animate-pulse" />
            </div>
          </div>
          <div className="space-y-2 max-w-3xl">
            <div className="h-4 w-full rounded bg-[var(--surface)] animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-[var(--surface)] animate-pulse" />
          </div>
          <div className="space-y-2.5 pt-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!title || !state) {
    return (
      <div className="px-6 py-16 text-center space-y-4">
        <p className="text-base text-[var(--muted)]">未找到该影视作品</p>
        <Button variant="secondary" onPress={() => navigate('/library')}>
          返回片库
        </Button>
      </div>
    );
  }

  const { primary, secondary } = resolveDisplayTitle(
    title.names,
    title.displayLang,
    settings.defaultTitleLang
  );

  const overviewText =
    title.overview.zh || title.overview.en || zh.detail.overview.empty;

  // Build single meta line: year · type · runtime or season count · up to 2 genres
  const metaParts: string[] = [];
  if (title.year) metaParts.push(String(title.year));
  metaParts.push(zh.detail.mediaTypes[title.mediaType]);
  if (title.mediaType === 'tv' && regularSeasons.length > 0) {
    metaParts.push(zh.detail.seasonsCount(regularSeasons.length));
  } else if (title.runtimeMin) {
    metaParts.push(`${title.runtimeMin} ${zh.detail.minutesUnit}`);
  }
  if (title.genres.length > 0) {
    metaParts.push(title.genres.slice(0, 2).join(' / '));
  }

  // Context-aware single primary button
  const getPrimaryActionConfig = () => {
    if (state.status === 'completed' || state.status === 'caught_up') {
      return {
        label: zh.detail.primaryAction.completedStartRewatch,
        icon: RotateCcw,
        disabled: false,
        onPress: () => startTitleRewatch(title.id),
      };
    }

    if (state.status === 'unaired') {
      return {
        label: zh.detail.primaryAction.unaired,
        icon: Clock,
        disabled: true,
        onPress: () => {},
      };
    }

    if (title.resume && title.resume.seconds > 0) {
      const timeStr = formatSeconds(title.resume.seconds);
      if (title.resume.episodeKey) {
        const epBadge = formatEpisodeBadge(title.resume.episodeKey);
        return {
          label: zh.detail.primaryAction.continueAt(epBadge, timeStr),
          icon: Check,
          disabled: false,
          onPress: () => toggleEpisode(title.id, title.resume!.episodeKey!),
        };
      }
      return {
        label: zh.detail.primaryAction.continueMovieAt(timeStr),
        icon: Check,
        disabled: false,
        onPress: () => markWholeTitle(title.id, true),
      };
    }

    if (title.mediaType === 'movie' || regularSeasons.length === 0) {
      return {
        label: zh.detail.primaryAction.startWatching,
        icon: Check,
        disabled: false,
        onPress: () => markWholeTitle(title.id, true),
      };
    }

    if (state.status === 'unwatched' && state.nextUp) {
      return {
        label: `${zh.detail.primaryAction.startWatching} (${formatEpisodeBadge(state.nextUp.key)})`,
        icon: Play,
        disabled: false,
        onPress: () => toggleEpisode(title.id, state.nextUp!.key),
      };
    }

    if (state.nextUp) {
      return {
        label: zh.detail.primaryAction.markEpisodeWatched(
          formatEpisodeBadge(state.nextUp.key)
        ),
        icon: Check,
        disabled: false,
        onPress: () => toggleEpisode(title.id, state.nextUp!.key),
      };
    }

    return {
      label: zh.detail.primaryAction.caughtUp,
      icon: CheckCircle2,
      disabled: true,
      onPress: () => {},
    };
  };

  const primaryAction = getPrimaryActionConfig();
  const PrimaryIcon = primaryAction.icon;

  const openResumeModal = (defaultEpKey?: string | null) => {
    const targetKey =
      defaultEpKey !== undefined
        ? defaultEpKey
        : title.mediaType === 'tv'
          ? title.resume?.episodeKey || state.nextUp?.key || regularSeasons[0]?.episodes[0]?.key || null
          : null;
    setResumeEpisodeKey(targetKey);
    if (title.resume && title.resume.episodeKey === targetKey && title.resume.seconds > 0) {
      setResumeInputStr(formatSeconds(title.resume.seconds));
    } else {
      setResumeInputStr('25:00');
    }
    setResumeError(null);
    setMoreMenuOpen(false);
    setActiveRowMenuKey(null);
    setResumeModalOpen(true);
  };

  const handleSaveResumeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let runtimeLimit = title.runtimeMin;
    if (resumeEpisodeKey) {
      for (const s of sortedSeasons) {
        const found = s.episodes.find((ep) => ep.key === resumeEpisodeKey);
        if (found && found.runtime) {
          runtimeLimit = found.runtime;
          break;
        }
      }
    }
    const parsed = parseTimeInput(resumeInputStr, runtimeLimit);
    if (!parsed.ok) {
      setResumeError(parsed.error);
      return;
    }
    await saveResume(title.id, {
      episodeKey: resumeEpisodeKey,
      seconds: parsed.seconds,
    });
    setResumeModalOpen(false);
  };

  const currentSeason =
    regularSeasons.find((s) => s.seasonNumber === selectedSeasonNum) ||
    regularSeasons[0] ||
    null;

  const currentSeasonState = currentSeason
    ? computeSeasonState(currentSeason, progress, {
        treatAllAsAired,
        showEnded,
        allSeasons: seasons,
      })
    : null;

  // Movie resume progress bar ratio (Item 15)
  const hasMovieResume =
    (title.mediaType === 'movie' || regularSeasons.length === 0) &&
    title.resume &&
    !title.resume.episodeKey &&
    title.resume.seconds > 0 &&
    state.status === 'watching';
  const movieResumePct = hasMovieResume
    ? Math.max(2, Math.min(100, Math.round(computeResumeRatio(title.resume!.seconds, title.runtimeMin) * 100)))
    : 0;

  const renderEpisodeRow = (
    seasonNumber: number,
    ep: {
      number: number;
      key: string;
      name: string;
      airDate: string | null;
      runtime: number | null;
      stillPath: string | null;
    }
  ) => {
    const epKey = ep.key || makeEpisodeKey(seasonNumber, ep.number);
    const aired = airedKeySet.has(epKey);
    const isWatched = Boolean(progress?.watched[epKey]);
    const isNextUp = state.nextUp?.key === epKey;
    const hasResumeOnThis = title.resume?.episodeKey === epKey && title.resume.seconds > 0;
    const epResumePct = hasResumeOnThis
      ? Math.max(
          2,
          Math.min(
            100,
            Math.round(computeResumeRatio(title.resume!.seconds, ep.runtime ?? title.runtimeMin) * 100)
          )
        )
      : 0;
    const isRowMenuOpen = activeRowMenuKey === epKey;

    return (
      <div
        key={epKey}
        id={`ep-row-${epKey}`}
        className={`relative flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 rounded-xl border transition-colors ${
          isNextUp
            ? 'bg-[var(--accent-subtle)] border-[var(--accent)]/40'
            : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-secondary)]'
        } ${!aired ? 'opacity-50' : ''}`}
      >
        {/* Check Circle (>= 44px tap target) */}
        <button
          type="button"
          disabled={!aired}
          onClick={() => toggleEpisode(title.id, epKey)}
          aria-label={
            aired
              ? `${isWatched ? '取消已看' : '标记已看'} E${ep.number} ${ep.name}`
              : `E${ep.number} ${ep.name} 尚未播出`
          }
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
            !aired
              ? 'cursor-not-allowed'
              : 'cursor-pointer hover:bg-[var(--surface-tertiary)]'
          }`}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${
              isWatched
                ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-foreground)]'
                : 'border-[var(--muted)] bg-transparent text-transparent'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          </span>
        </button>

        {/* Still thumbnail on tablet and up */}
        {ep.stillPath && (
          <div className="hidden sm:block w-28 shrink-0 rounded-lg overflow-hidden border border-[var(--border)]">
            <MediaImage
              src={ep.stillPath}
              alt={ep.name}
              aspect="still"
              mediaType="tv"
            />
          </div>
        )}

        {/* Episode Title & Meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--foreground)] truncate">
              E{ep.number} · {ep.name}
            </span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)] tabular-nums">
            {!aired ? (
              <span>{zh.detail.seasons.unairedLabel(ep.airDate)}</span>
            ) : (
              <>
                {ep.airDate && <span>{ep.airDate}</span>}
                {ep.airDate && ep.runtime && <span aria-hidden="true">·</span>}
                {ep.runtime && (
                  <span>
                    {ep.runtime} {zh.detail.minutesUnit}
                  </span>
                )}
              </>
            )}

            {hasResumeOnThis && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[var(--accent-text)] font-medium">
                  已看到 {formatSeconds(title.resume!.seconds)}
                </span>
              </>
            )}
          </div>

          {/* Item 15: Resumed episode progress bar using resume seconds ÷ (runtime × 60) */}
          {hasResumeOnThis && (
            <div className="mt-2 max-w-xs">
              <ProgressBar
                aria-label={`E${ep.number} 观看进度`}
                value={epResumePct}
                size="sm"
                className="w-full"
              >
                <ProgressBar.Track className="h-1 bg-[var(--surface-tertiary)] rounded-full overflow-hidden">
                  <ProgressBar.Fill className="h-full bg-[var(--accent)] rounded-full" />
                </ProgressBar.Track>
              </ProgressBar>
            </div>
          )}
        </div>

        {/* Row Secondary Menu (`标记到此集`, `记录时间`) */}
        {aired && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setActiveRowMenuKey(isRowMenuOpen ? null : epKey)}
              aria-label={`E${ep.number} 更多操作`}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-tertiary)] transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isRowMenuOpen && (
              <div className="absolute right-0 top-11 z-20 w-40 rounded-xl bg-[var(--overlay)] border border-[var(--border)] shadow-xl py-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    markUpTo(title.id, epKey);
                    setActiveRowMenuKey(null);
                  }}
                  className="w-full px-3.5 py-2.5 text-left text-[var(--foreground)] hover:bg-[var(--surface-secondary)] flex items-center gap-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  <span>{zh.detail.seasons.markUpToHere}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openResumeModal(epKey)}
                  className="w-full px-3.5 py-2.5 text-left text-[var(--foreground)] hover:bg-[var(--surface-secondary)] flex items-center gap-2"
                >
                  <Clock className="w-3.5 h-3.5 text-[var(--muted)]" />
                  <span>{zh.detail.seasons.recordEpisodeTime}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="pb-16">
      {/* Full-bleed Backdrop Hero (~55vh on phone) */}
      <div className="relative w-full h-[46vh] sm:h-[50vh] min-h-[300px] max-h-[520px] overflow-hidden">
        <MediaImage
          src={title.backdropPath || title.posterPath}
          alt={primary}
          aspect="backdrop"
          mediaType={title.mediaType}
          priority
          className="w-full h-full"
        />

        {/* Gradient Scrim fading into page background var(--background) */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--backdrop-scrim)] to-[var(--scrim-soft)]" />

        {/* Back Navigation Button */}
        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={zh.detail.back}
            className="min-w-[44px] min-h-[44px] px-3.5 rounded-full bg-[var(--scrim-chip)] hover:bg-[var(--scrim-strong)] backdrop-blur-md border border-[var(--border)] text-[var(--on-scrim)] flex items-center gap-1.5 text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{zh.detail.back}</span>
          </button>
        </div>
      </div>

      {/* Main Content Container overlapping the Hero */}
      <div className="relative z-10 px-4 sm:px-6 lg:px-10 -mt-28 sm:-mt-36 space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 sm:gap-7">
          {/* Overlapping 2:3 Poster on tablet/desktop */}
          <div className="hidden sm:block w-36 md:w-44 shrink-0 rounded-2xl overflow-hidden border border-[var(--border)] shadow-2xl bg-[var(--surface)]">
            <MediaImage
              src={title.posterPath}
              alt={primary}
              aspect="poster"
              mediaType={title.mediaType}
              priority
            />
          </div>

          {/* Title, Original Title, Single Meta Line & Action Bar */}
          <div className="flex-1 min-w-0 space-y-3 w-full">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--accent-text)]">
                <span>{state.label}</span>
                {state.hasNewEpisodes && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{zh.detail.newEpisodeBadge}</span>
                  </>
                )}
                {state.isRewatching && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{zh.detail.rewatchingBadge}</span>
                  </>
                )}
              </div>

              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--foreground)]">
                {primary}
              </h1>

              {secondary && (
                <p className="text-sm sm:text-base text-[var(--muted)] font-normal">
                  {secondary}
                </p>
              )}
            </div>

            {/* One meta line: year · type · runtime or season count · up to 2 genres */}
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[var(--foreground-secondary)] tabular-nums">
              {metaParts.map((part, idx) => (
                <React.Fragment key={part}>
                  {idx > 0 && (
                    <span aria-hidden="true" className="text-[var(--muted)]">
                      ·
                    </span>
                  )}
                  <span>{part}</span>
                </React.Fragment>
              ))}
            </div>

            {/* Ratings row: compact chips (豆瓣 / IMDb / 烂番茄 / Metacritic), tap opens source, plus 在豆瓣搜索 */}
            <div className="flex flex-wrap items-center gap-2.5 pt-0.5 text-xs text-[var(--muted)] tabular-nums">
              {title.ratings.douban && (
                <a
                  href={
                    title.externalIds?.douban
                      ? title.externalIds.douban.startsWith('http')
                        ? title.externalIds.douban
                        : `https://movie.douban.com/subject/${title.externalIds.douban}/`
                      : `https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(
                          title.names.zh || title.names.original
                        )}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground-secondary)] transition-colors"
                >
                  <span>{zh.detail.ratings.douban}</span>
                  <strong className="text-[var(--foreground)] font-semibold">
                    {title.ratings.douban}
                  </strong>
                </a>
              )}

              {title.ratings.imdb && (
                <a
                  href={
                    title.externalIds?.imdb
                      ? `https://www.imdb.com/title/${title.externalIds.imdb}/`
                      : `https://www.imdb.com/find/?q=${encodeURIComponent(title.names.original)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground-secondary)] transition-colors"
                >
                  <span>{zh.detail.ratings.imdb}</span>
                  <strong className="text-[var(--foreground)] font-semibold">
                    {title.ratings.imdb}
                  </strong>
                </a>
              )}

              {title.ratings.rottenTomatoes && (
                <a
                  href={`https://www.rottentomatoes.com/search?search=${encodeURIComponent(
                    title.names.en || title.names.original
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground-secondary)] transition-colors"
                >
                  <span>{zh.detail.ratings.rottenTomatoes}</span>
                  <strong className="text-[var(--foreground)] font-semibold">
                    {title.ratings.rottenTomatoes}
                  </strong>
                </a>
              )}

              {title.ratings.metacritic && (
                <a
                  href={`https://www.metacritic.com/search/${encodeURIComponent(
                    title.names.en || title.names.original
                  )}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground-secondary)] transition-colors"
                >
                  <span>{zh.detail.ratings.metacritic}</span>
                  <strong className="text-[var(--foreground)] font-semibold">
                    {title.ratings.metacritic}
                  </strong>
                </a>
              )}

              <a
                href={`https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(
                  title.names.zh || title.names.original
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <span>{zh.detail.ratings.searchOnDouban}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* Movie resume progress bar (Item 15) */}
            {hasMovieResume && (
              <div className="max-w-xs space-y-1 pt-1">
                <div className="flex items-center justify-between text-xs text-[var(--muted)] tabular-nums">
                  <span>观看进度 · {formatSeconds(title.resume!.seconds)}</span>
                  <span>{movieResumePct}%</span>
                </div>
                <ProgressBar
                  aria-label={`${primary} 观看进度`}
                  value={movieResumePct}
                  size="sm"
                  className="w-full"
                >
                  <ProgressBar.Track className="h-1.5 bg-[var(--surface-tertiary)] rounded-full overflow-hidden">
                    <ProgressBar.Fill className="h-full bg-[var(--accent)] rounded-full" />
                  </ProgressBar.Track>
                </ProgressBar>
              </div>
            )}

            {/* Action Bar: Exactly ONE Primary Button + "..." Secondary Menu */}
            <div className="pt-2 flex items-center gap-3">
              <Button
                variant="primary"
                size="lg"
                isDisabled={primaryAction.disabled}
                onPress={primaryAction.onPress}
                className="min-h-[48px] px-6 rounded-xl font-semibold gap-2 flex-1 sm:flex-initial"
              >
                <PrimaryIcon className="w-4 h-4" />
                <span>{primaryAction.label}</span>
              </Button>

              <button
                type="button"
                onClick={() => setMoreMenuOpen(true)}
                aria-label={zh.detail.moreMenu.label}
                className="min-w-[48px] min-h-[48px] rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground)] flex items-center justify-center transition-colors"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Overview (clamped to 3 lines with expand) */}
        <section aria-label="剧情简介" className="max-w-3xl space-y-1.5">
          <p
            className={`text-sm sm:text-base text-[var(--foreground-secondary)] leading-relaxed ${
              overviewExpanded ? '' : 'line-clamp-3'
            }`}
          >
            {overviewText}
          </p>
          {overviewText.length > 110 && (
            <button
              type="button"
              onClick={() => setOverviewExpanded((v) => !v)}
              className="text-xs font-medium text-[var(--accent-text)] hover:underline py-1"
            >
              {overviewExpanded ? zh.detail.overview.collapse : zh.detail.overview.expand}
            </button>
          )}
        </section>

        {/* Seasons & Episodes Section (for TV or multi-episode items) */}
        {regularSeasons.length > 0 && currentSeason && currentSeasonState && (
          <section aria-labelledby="seasons-heading" className="space-y-5 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--separator)] pb-4">
              {/* Tabs if <= 6 seasons, otherwise a select */}
              {regularSeasons.length <= 6 ? (
                <Tabs
                  selectedKey={String(selectedSeasonNum)}
                  onSelectionChange={(key) => setSelectedSeasonNum(Number(key))}
                  aria-label="选择季数"
                >
                  <Tabs.ListContainer>
                    <Tabs.List className="flex items-center gap-1.5 bg-[var(--surface)] p-1 rounded-xl border border-[var(--border)] overflow-x-auto">
                      {regularSeasons.map((s) => (
                        <Tabs.Tab
                          key={s.seasonNumber}
                          id={String(s.seasonNumber)}
                          className="px-3.5 py-1.5 min-h-[38px] rounded-lg text-xs sm:text-sm font-medium text-[var(--muted)] data-[selected=true]:bg-[var(--accent)] data-[selected=true]:text-[var(--accent-foreground)] transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {s.name || `第 ${s.seasonNumber} 季`}
                        </Tabs.Tab>
                      ))}
                    </Tabs.List>
                  </Tabs.ListContainer>
                </Tabs>
              ) : (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="season-select"
                    className="text-sm font-medium text-[var(--foreground)]"
                  >
                    选择季数
                  </label>
                  <div className="relative">
                    <select
                      id="season-select"
                      value={selectedSeasonNum}
                      onChange={(e) => setSelectedSeasonNum(Number(e.target.value))}
                      className="h-10 pl-3.5 pr-9 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm font-medium text-[var(--foreground)] appearance-none"
                    >
                      {regularSeasons.map((s) => (
                        <option key={s.seasonNumber} value={s.seasonNumber}>
                          {s.name || `第 ${s.seasonNumber} 季`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[var(--muted)] absolute right-3 top-3 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Season Header: "已看 8/10", ProgressBar, and 整季标记 */}
              <div className="flex items-center justify-between sm:justify-end gap-4">
                <div className="flex items-center gap-3 min-w-[140px]">
                  <span className="text-xs text-[var(--muted)] tabular-nums whitespace-nowrap">
                    {zh.detail.seasons.watchedProgress(
                      currentSeasonState.watchedCount,
                      currentSeasonState.airedCount
                    )}
                  </span>
                  <ProgressBar
                    aria-label="本季观看进度"
                    value={
                      currentSeasonState.airedCount > 0
                        ? Math.round(
                            (currentSeasonState.watchedCount / currentSeasonState.airedCount) *
                              100
                          )
                        : 0
                    }
                    size="sm"
                    className="w-24"
                  >
                    <ProgressBar.Track className="h-1.5 bg-[var(--surface-tertiary)] rounded-full overflow-hidden">
                      <ProgressBar.Fill className="h-full bg-[var(--accent)] rounded-full" />
                    </ProgressBar.Track>
                  </ProgressBar>
                </div>

                {currentSeasonState.airedCount > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() =>
                      toggleSeason(
                        title.id,
                        currentSeason.seasonNumber,
                        currentSeasonState.state !== 'complete'
                      )
                    }
                    className="text-xs font-medium shrink-0"
                  >
                    {currentSeasonState.state === 'complete'
                      ? zh.detail.seasons.unmarkSeasonWatched
                      : zh.detail.seasons.markSeasonWatched}
                  </Button>
                )}
              </div>
            </div>

            {/* Episode Rows */}
            <div className="space-y-2">
              {currentSeason.episodes.map((ep) =>
                renderEpisodeRow(currentSeason.seasonNumber, ep)
              )}
            </div>

            {/* Specials collapsed at bottom */}
            {specialsSeason && specialsSeason.episodes.length > 0 && (
              <details className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <summary className="cursor-pointer list-none flex items-center justify-between text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
                  <span>
                    {zh.detail.seasons.specialsTitle} · {specialsSeason.episodes.length} 集
                  </span>
                  <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 space-y-2">
                  {specialsSeason.episodes.map((ep) => renderEpisodeRow(0, ep))}
                </div>
              </details>
            )}
          </section>
        )}

        {/* Playthrough History at the bottom if there is more than one */}
        {title.playthroughs.length > 1 && (
          <section className="pt-4 border-t border-[var(--separator)] space-y-3 max-w-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  {zh.detail.playthroughHistory.title}
                </h2>
                <span className="text-xs text-[var(--muted)] tabular-nums">
                  {zh.detail.playthroughHistory.watchedCount(state.completedPlaythroughCount)}
                </span>
              </div>
              {state.isRewatching && (
                <button
                  type="button"
                  onClick={() => cancelTitleRewatch(title.id)}
                  className="text-xs text-[var(--warning)] hover:underline flex items-center gap-1"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>{zh.detail.moreMenu.cancelRewatch}</span>
                </button>
              )}
            </div>
            <div className="space-y-2">
              {title.playthroughs.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between text-xs px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] tabular-nums"
                >
                  <span className="font-medium text-[var(--foreground)]">
                    {zh.detail.playthroughHistory.runLabel(p.number)}
                  </span>
                  <span className="text-[var(--muted)]">
                    {new Date(p.startedAt).toLocaleDateString('zh-CN')}
                    {p.completedAt
                      ? ` — ${new Date(p.completedAt).toLocaleDateString('zh-CN')} 看完`
                      : ' · 进行中'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Secondary Actions Drawer ("…" Menu: 加入列表, 记录观看时间, 暂停, 弃剧, 标题语言, 编辑, 删除) */}
      <Drawer.Backdrop isOpen={moreMenuOpen} onOpenChange={setMoreMenuOpen} isDismissable>
        <Drawer.Content placement="bottom" className="sm:max-w-md sm:mx-auto">
          <Drawer.Dialog className="bg-[var(--overlay)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-2xl p-5 text-[var(--foreground)] outline-none max-h-[85dvh] overflow-y-auto">
            <Drawer.Handle className="w-10 h-1.5 bg-[var(--surface-tertiary)] rounded-full mx-auto mb-4 sm:hidden" />
            <Drawer.Header className="pb-3 border-b border-[var(--separator)]">
              <Drawer.Heading className="text-base font-semibold text-[var(--foreground)]">
                {primary} · {zh.detail.moreMenu.label}
              </Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="py-3 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false);
                  setAddToListOpen(true);
                }}
                className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
              >
                <FolderPlus className="w-4 h-4 text-[var(--accent-text)]" />
                <span>{zh.detail.moreMenu.addToList}</span>
              </button>

              <button
                type="button"
                onClick={() => openResumeModal()}
                className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
              >
                <Clock className="w-4 h-4 text-[var(--accent-text)]" />
                <span>{zh.detail.moreMenu.recordTime}</span>
              </button>

              {title.resume && (
                <button
                  type="button"
                  onClick={() => {
                    saveResume(title.id, null);
                    setMoreMenuOpen(false);
                  }}
                  className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm text-[var(--foreground-secondary)] hover:bg-[var(--surface-secondary)] transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-[var(--muted)]" />
                  <span>{zh.detail.moreMenu.clearResume}</span>
                </button>
              )}

              {(state.status === 'completed' || state.status === 'caught_up') && (
                <button
                  type="button"
                  onClick={() => {
                    startTitleRewatch(title.id);
                    setMoreMenuOpen(false);
                  }}
                  className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-[var(--accent-text)]" />
                  <span>{zh.detail.moreMenu.startRewatch}</span>
                </button>
              )}

              {state.isRewatching && (
                <button
                  type="button"
                  onClick={() => {
                    cancelTitleRewatch(title.id);
                    setMoreMenuOpen(false);
                  }}
                  className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm text-[var(--warning)] hover:bg-[var(--surface-secondary)] transition-colors"
                >
                  <Undo2 className="w-4 h-4" />
                  <span>{zh.detail.moreMenu.cancelRewatch}</span>
                </button>
              )}

              {/* Pause & Drop controls */}
              {title.manualState === 'paused' || title.manualState === 'dropped' ? (
                <button
                  type="button"
                  onClick={() => {
                    setTitleManualState(title.id, null);
                    setMoreMenuOpen(false);
                  }}
                  className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm text-[var(--success)] hover:bg-[var(--surface-secondary)] transition-colors"
                >
                  <Play className="w-4 h-4" />
                  <span>{zh.detail.moreMenu.resumeFromManual}</span>
                </button>
              ) : null}

              {title.manualState !== 'paused' && (
                <button
                  type="button"
                  onClick={() => {
                    setTitleManualState(title.id, 'paused');
                    setMoreMenuOpen(false);
                  }}
                  className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
                >
                  <PauseCircle className="w-4 h-4 text-[var(--warning)]" />
                  <span>{zh.detail.moreMenu.pauseTitle}</span>
                </button>
              )}

              {title.manualState !== 'dropped' && (
                <button
                  type="button"
                  onClick={() => {
                    setTitleManualState(title.id, 'dropped');
                    setMoreMenuOpen(false);
                  }}
                  className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
                >
                  <Ban className="w-4 h-4 text-[var(--danger)]" />
                  <span>{zh.detail.moreMenu.dropTitle}</span>
                </button>
              )}

              {/* Title language switch */}
              <button
                type="button"
                onClick={() => {
                  setSelectedLang(title.displayLang);
                  setCustomTitleInput(title.names.custom || '');
                  setMoreMenuOpen(false);
                  setLangModalOpen(true);
                }}
                className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
              >
                <Languages className="w-4 h-4 text-[var(--accent-text)]" />
                <span>{zh.detail.moreMenu.titleLanguage}</span>
              </button>

              {/* Edit title & Douban info */}
              <button
                type="button"
                onClick={() => {
                  setEditName(title.names.zh || title.names.original || '');
                  setEditOrigName(title.names.original || '');
                  setEditMediaType(title.mediaType);
                  setEditYear(title.year ? String(title.year) : '');
                  setEditRuntime(title.runtimeMin ? String(title.runtimeMin) : '');
                  const s1 = regularSeasons.find((s) => s.seasonNumber === 1);
                  setEditEpisodeCount(s1 ? String(s1.episodes.length) : '');
                  setEditPosterUrl(title.posterPath || '');
                  setEditOverview(title.overview.zh || title.overview.en || '');
                  setEditDoubanScore(title.ratings.douban || '');
                  setEditDoubanUrl(title.externalIds?.douban || '');
                  setMoreMenuOpen(false);
                  setEditModalOpen(true);
                }}
                className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
              >
                <Edit3 className="w-4 h-4 text-[var(--accent-text)]" />
                <span>{zh.detail.moreMenu.editTitle}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const isDone = state.status === 'completed';
                  markWholeTitle(title.id, !isDone);
                  setMoreMenuOpen(false);
                }}
                className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                <span>
                  {state.status === 'completed'
                    ? zh.detail.moreMenu.unmarkMovieWatched
                    : zh.detail.moreMenu.markAllWatched}
                </span>
              </button>

              {title.source === 'tmdb' && (
                <button
                  type="button"
                  onClick={() => {
                    refreshTitleMetadata(title.id);
                    setMoreMenuOpen(false);
                  }}
                  className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm text-[var(--foreground-secondary)] hover:bg-[var(--surface-secondary)] transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-[var(--muted)]" />
                  <span>{zh.detail.moreMenu.refreshMeta}</span>
                </button>
              )}

              <button
                type="button"
                onClick={async () => {
                  setMoreMenuOpen(false);
                  await removeTitle(title.id);
                  navigate('/library');
                }}
                className="w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm text-[var(--danger)] hover:bg-[var(--danger-subtle)] transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>{zh.detail.moreMenu.deleteTitle}</span>
              </button>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

      {/* Record Resume Time Modal */}
      <Modal.Backdrop isOpen={resumeModalOpen} onOpenChange={setResumeModalOpen} isDismissable>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)] outline-none">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold">
                {zh.detail.resumeModal.title}
              </Modal.Heading>
            </Modal.Header>
            <form onSubmit={handleSaveResumeSubmit} className="mt-4 space-y-4">
              {regularSeasons.length > 0 && (
                <div className="space-y-1.5">
                  <label htmlFor="resume-ep-select" className="block text-xs text-[var(--muted)]">
                    {zh.detail.resumeModal.episodeLabel}
                  </label>
                  <select
                    id="resume-ep-select"
                    value={resumeEpisodeKey || ''}
                    onChange={(e) => setResumeEpisodeKey(e.target.value || null)}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]"
                  >
                    {regularSeasons.map((s) =>
                      s.episodes
                        .filter((ep) => {
                          const k = ep.key || makeEpisodeKey(s.seasonNumber, ep.number);
                          return airedKeySet.has(k);
                        })
                        .map((ep) => {
                          const k = ep.key || makeEpisodeKey(s.seasonNumber, ep.number);
                          return (
                            <option key={k} value={k}>
                              {formatEpisodeBadge(k)} · {ep.name}
                            </option>
                          );
                        })
                    )}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="resume-time-input" className="block text-xs text-[var(--muted)]">
                  {zh.detail.resumeModal.timeLabel}
                </label>
                <input
                  id="resume-time-input"
                  type="text"
                  value={resumeInputStr}
                  onChange={(e) => {
                    setResumeInputStr(e.target.value);
                    setResumeError(null);
                  }}
                  placeholder={zh.detail.resumeModal.timePlaceholder}
                  className="w-full h-10 px-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] tabular-nums focus:outline-none focus:border-[var(--accent)]"
                />
                {resumeError && <p className="text-xs text-[var(--danger)]">{resumeError}</p>}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onPress={() => setResumeModalOpen(false)}
                >
                  {zh.detail.resumeModal.cancel}
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  {zh.detail.resumeModal.save}
                </Button>
              </div>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Title Language Modal (中文 / 原名 / 英文 / 自定义) */}
      <Modal.Backdrop isOpen={langModalOpen} onOpenChange={setLangModalOpen} isDismissable>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)] outline-none">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold">
                {zh.detail.langModal.title}
              </Modal.Heading>
            </Modal.Header>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await updateTitleLanguage(title.id, selectedLang, customTitleInput);
                setLangModalOpen(false);
              }}
              className="mt-4 space-y-4"
            >
              <div className="space-y-2">
                {(
                  [
                    { value: null, label: zh.detail.langModal.followGlobal, preview: '' },
                    { value: 'zh', label: zh.detail.langModal.zh, preview: title.names.zh || '' },
                    {
                      value: 'original',
                      label: zh.detail.langModal.original,
                      preview: title.names.original || '',
                    },
                    { value: 'en', label: zh.detail.langModal.en, preview: title.names.en || '' },
                    {
                      value: 'custom',
                      label: zh.detail.langModal.custom,
                      preview: customTitleInput || title.names.custom || '',
                    },
                  ] as const
                ).map((opt) => {
                  const active = selectedLang === opt.value;
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setSelectedLang(opt.value)}
                      className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between text-left transition-colors ${
                        active
                          ? 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--foreground)]'
                          : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-tertiary)]'
                      }`}
                    >
                      <span className="text-sm font-medium">{opt.label}</span>
                      {opt.preview && (
                        <span className="text-xs text-[var(--muted)] truncate max-w-[160px]">
                          {opt.preview}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="custom-title-input" className="block text-xs text-[var(--muted)]">
                  {zh.detail.langModal.custom}
                </label>
                <input
                  id="custom-title-input"
                  type="text"
                  value={customTitleInput}
                  onChange={(e) => {
                    setCustomTitleInput(e.target.value);
                    if (e.target.value.trim()) {
                      setSelectedLang('custom');
                    }
                  }}
                  placeholder={zh.detail.langModal.customPlaceholder}
                  className="w-full h-10 px-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onPress={() => setLangModalOpen(false)}
                >
                  {zh.detail.langModal.cancel}
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  {zh.detail.langModal.save}
                </Button>
              </div>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Edit Title & Manual Douban Modal */}
      <Modal.Backdrop isOpen={editModalOpen} onOpenChange={setEditModalOpen} isDismissable>
        <Modal.Container size="md" placement="center">
          <Modal.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)] outline-none max-h-[88dvh] overflow-y-auto">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold">
                {zh.detail.editModal.title}
              </Modal.Heading>
            </Modal.Header>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await updateTitleDetails(title.id, {
                  name: editName,
                  originalName: editOrigName,
                  mediaType: editMediaType,
                  year: editYear.trim() ? parseInt(editYear.trim(), 10) || null : null,
                  runtimeMin: editRuntime.trim() ? parseInt(editRuntime.trim(), 10) || null : null,
                  ...(title.source === 'custom' || title.source === 'url'
                    ? {
                        episodeCount: editEpisodeCount.trim()
                          ? parseInt(editEpisodeCount.trim(), 10) || 0
                          : 0,
                      }
                    : {}),
                  posterPath: editPosterUrl,
                  overview: editOverview,
                  doubanScore: editDoubanScore,
                  doubanUrl: editDoubanUrl,
                });
                setEditModalOpen(false);
              }}
              className="mt-4 space-y-3.5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="edit-title-name" className="block text-xs text-[var(--muted)]">
                    {zh.detail.editModal.nameLabel}
                  </label>
                  <input
                    id="edit-title-name"
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-title-orig" className="block text-xs text-[var(--muted)]">
                    {zh.detail.editModal.originalNameLabel}
                  </label>
                  <input
                    id="edit-title-orig"
                    type="text"
                    value={editOrigName}
                    onChange={(e) => setEditOrigName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label htmlFor="edit-title-type" className="block text-xs text-[var(--muted)]">
                    {zh.detail.editModal.mediaTypeLabel}
                  </label>
                  <select
                    id="edit-title-type"
                    value={editMediaType}
                    onChange={(e) => setEditMediaType(e.target.value as MediaType)}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]"
                  >
                    <option value="movie">{zh.detail.mediaTypes.movie}</option>
                    <option value="tv">{zh.detail.mediaTypes.tv}</option>
                    <option value="other">{zh.detail.mediaTypes.other}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-title-year" className="block text-xs text-[var(--muted)]">
                    {zh.detail.editModal.yearLabel}
                  </label>
                  <input
                    id="edit-title-year"
                    type="number"
                    value={editYear}
                    onChange={(e) => setEditYear(e.target.value)}
                    placeholder="2024"
                    className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-title-runtime" className="block text-xs text-[var(--muted)]">
                    {zh.detail.editModal.runtimeLabel}
                  </label>
                  <input
                    id="edit-title-runtime"
                    type="number"
                    value={editRuntime}
                    onChange={(e) => setEditRuntime(e.target.value)}
                    placeholder="45"
                    className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] tabular-nums"
                  />
                </div>
              </div>

              {(title.source === 'custom' || title.source === 'url') && (
                <div className="space-y-1">
                  <label htmlFor="edit-title-eps" className="block text-xs text-[var(--muted)]">
                    {zh.detail.editModal.episodeCountLabel}
                  </label>
                  <input
                    id="edit-title-eps"
                    type="number"
                    min={0}
                    max={2000}
                    value={editEpisodeCount}
                    onChange={(e) => setEditEpisodeCount(e.target.value)}
                    placeholder="例如 12（留空或 0 表示单部影片）"
                    className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] tabular-nums"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="edit-title-poster" className="block text-xs text-[var(--muted)]">
                  {zh.detail.editModal.posterUrlLabel}
                </label>
                <input
                  id="edit-title-poster"
                  type="url"
                  value={editPosterUrl}
                  onChange={(e) => setEditPosterUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="edit-douban-score" className="block text-xs text-[var(--muted)]">
                    {zh.detail.editModal.doubanScoreLabel}
                  </label>
                  <input
                    id="edit-douban-score"
                    type="text"
                    value={editDoubanScore}
                    onChange={(e) => setEditDoubanScore(e.target.value)}
                    placeholder="例如 9.1"
                    className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="edit-douban-url" className="block text-xs text-[var(--muted)]">
                    {zh.detail.editModal.doubanUrlLabel}
                  </label>
                  <input
                    id="edit-douban-url"
                    type="text"
                    value={editDoubanUrl}
                    onChange={(e) => setEditDoubanUrl(e.target.value)}
                    placeholder="https://movie.douban.com/subject/..."
                    className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="edit-title-overview" className="block text-xs text-[var(--muted)]">
                  {zh.detail.editModal.overviewLabel}
                </label>
                <textarea
                  id="edit-title-overview"
                  rows={3}
                  value={editOverview}
                  onChange={(e) => setEditOverview(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)] resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onPress={() => setEditModalOpen(false)}
                >
                  {zh.detail.editModal.cancel}
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  {zh.detail.editModal.save}
                </Button>
              </div>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Add to List Modal */}
      <Modal.Backdrop isOpen={addToListOpen} onOpenChange={setAddToListOpen} isDismissable>
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)] outline-none">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold">
                {zh.detail.addToListModal.title}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-4 space-y-2 max-h-72 overflow-y-auto">
              {Object.values(lists).length === 0 ? (
                <div className="py-6 text-center space-y-3">
                  <p className="text-sm text-[var(--muted)]">{zh.detail.addToListModal.emptyLists}</p>
                  <Button
                    variant="primary"
                    size="sm"
                    onPress={() => {
                      setAddToListOpen(false);
                      navigate('/lists');
                    }}
                  >
                    {zh.detail.addToListModal.createFirstList}
                  </Button>
                </div>
              ) : (
                Object.values(lists).map((list) => {
                  const entries = entriesByList[list.id] || [];
                  const existingEntry = entries.find((e) => e.titleId === title.id);
                  return (
                    <div
                      key={list.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)]"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)] truncate">
                          {list.name}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {list.kind === 'ordered' ? zh.lists.orderedType : zh.lists.collectionType}
                        </p>
                      </div>
                      <Button
                        variant={existingEntry ? 'secondary' : 'primary'}
                        size="sm"
                        onPress={() =>
                          existingEntry
                            ? removeEntryFromList(list.id, existingEntry.id)
                            : addTitleToList(list.id, title.id)
                        }
                      >
                        {existingEntry
                          ? zh.detail.addToListModal.added
                          : zh.detail.addToListModal.add}
                      </Button>
                    </div>
                  );
                })
              )}
            </Modal.Body>
            <Modal.Footer className="mt-5 flex justify-end">
              <Button variant="secondary" size="sm" onPress={() => setAddToListOpen(false)}>
                {zh.app.close}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
};
