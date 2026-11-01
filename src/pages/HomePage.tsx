import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  Film,
  ListOrdered,
  LogIn,
  Plus,
  Settings,
} from 'lucide-react';
import { Button, Card, ProgressBar } from '@heroui/react';
import { MediaImage } from '../components/MediaImage';
import { PosterCard } from '../components/PosterCard';
import { useTracker } from '../context/TrackerContext';
import { computeListProgress, sortListEntries } from '../domain/ordering';
import {
  computeTitleState,
  formatEpisodeBadge,
  formatSeconds,
  getTitleContinueProgressRatio,
  resolveDisplayTitle,
} from '../domain/progress';
import type { HomeSectionId, ListEntryDoc, ProgressDoc, TitleDoc } from '../domain/types';
import { zh } from '../i18n/zh';

export const HomePage: React.FC = () => {
  const {
    user,
    loadingData,
    titles,
    seasonsByTitle,
    lists,
    entriesByList,
    settings,
    getActiveProgress,
    toggleEpisode,
    markWholeTitle,
    signIn,
  } = useTracker();
  const navigate = useNavigate();

  const allTitles = Object.values(titles).sort(
    (a, b) => b.lastActivityAt - a.lastActivityAt
  );

  const progressMapForAllTitles: Record<string, ProgressDoc | undefined> = {};
  for (const t of allTitles) {
    progressMapForAllTitles[t.id] = getActiveProgress(t);
  }

  // Compute state for every title
  const computedItems = allTitles.map((title) => {
    const seasons = seasonsByTitle[title.id] || [];
    const progress = progressMapForAllTitles[title.id];
    const state = computeTitleState(title, seasons, progress, {
      includeSpecials: settings.includeSpecials,
    });
    return { title, seasons, progress, state };
  });

  // 继续观看: status === 'watching' (paused/dropped are already separate statuses)
  const continueWatchingItems = computedItems.filter(
    (item) => item.state.status === 'watching'
  );

  // 有新集: state.hasNewEpisodes === true
  const newEpisodeItems = computedItems.filter((item) => item.state.hasNewEpisodes);

  // 置顶列表: pinned ordered lists
  const pinnedOrderedLists = Object.values(lists)
    .filter((l) => l.pinned && l.kind === 'ordered')
    .sort((a, b) => (a.rank < b.rank ? -1 : 1));

  // 最近添加: sorted by addedAt descending
  const recentlyAddedItems = [...computedItems]
    .sort((a, b) => b.title.addedAt - a.title.addedAt)
    .slice(0, 12);

  // 想看: status === 'unwatched'
  const watchlistItems = computedItems.filter(
    (item) => item.state.status === 'unwatched'
  );

  const enabledSections = [...settings.homeSections]
    .filter((s) => s.enabled)
    .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));

  const isEmpty = allTitles.length === 0;

  const renderSection = (sectionId: HomeSectionId) => {
    switch (sectionId) {
      case 'continue_watching':
        return (
          <section
            key="continue_watching"
            aria-labelledby="heading-continue-watching"
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2
                id="heading-continue-watching"
                className="text-lg sm:text-xl font-semibold text-[var(--foreground)] tracking-tight"
              >
                {zh.home.continueWatching}
              </h2>
              <span className="text-xs text-[var(--muted)] tabular-nums">
                {continueWatchingItems.length} 部正在观看
              </span>
            </div>

            {continueWatchingItems.length === 0 ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 flex items-center justify-between gap-4">
                <p className="text-sm text-[var(--muted)]">
                  当前没有正在观看的影视，从片库挑选一部或搜索新作品开始吧。
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => navigate('/library')}
                  className="shrink-0"
                >
                  浏览片库
                </Button>
              </div>
            ) : (
              /* Item 12: Horizontal scroll-snap row; on phone each card is ~85% width so the next one peeks */
              <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                {continueWatchingItems.map(({ title, seasons, state }) => {
                  const { primary } = resolveDisplayTitle(
                    title.names,
                    title.displayLang,
                    settings.defaultTitleLang
                  );

                  const resume = title.resume;
                  const nextUp = state.nextUp;
                  const targetEpisodeKey = resume?.episodeKey || nextUp?.key || null;

                  let progressSubtitle = '';
                  if (resume && resume.seconds > 0) {
                    if (resume.episodeKey) {
                      progressSubtitle = `${formatEpisodeBadge(resume.episodeKey)} · ${formatSeconds(
                        resume.seconds
                      )}`;
                    } else {
                      progressSubtitle = `${formatSeconds(resume.seconds)}`;
                    }
                  } else if (nextUp) {
                    progressSubtitle = `${zh.home.nextEpisodePrefix} ${formatEpisodeBadge(
                      nextUp.key
                    )}`;
                  } else {
                    progressSubtitle = state.label;
                  }

                  // Item 15: Progress bar uses resume seconds ÷ (runtime × 60) for movies and resumed episodes
                  const ratio = getTitleContinueProgressRatio(title, seasons, state);
                  const pct = Math.max(2, Math.min(100, Math.round(ratio * 100)));
                  const detailHref = targetEpisodeKey
                    ? `/title/${title.id}?episode=${targetEpisodeKey}`
                    : `/title/${title.id}`;

                  const handleQuickMark = (e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (nextUp) {
                      toggleEpisode(title.id, nextUp.key);
                    } else if (title.mediaType === 'movie') {
                      markWholeTitle(title.id, true);
                    }
                  };

                  return (
                    <div
                      key={title.id}
                      className="w-[85%] sm:w-[340px] lg:w-[380px] shrink-0 snap-start group relative rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface)] transition-transform duration-200 hover:scale-[1.01]"
                    >
                      <Link
                        to={detailHref}
                        className="block relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                      >
                        <MediaImage
                          src={title.backdropPath || title.posterPath}
                          alt={primary}
                          aspect="backdrop"
                          mediaType={title.mediaType}
                          priority
                        />

                        {/* Scrim overlay for contrast */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[var(--scrim-strong)] via-[var(--scrim-mid)] to-transparent" />

                        <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-semibold text-[var(--on-scrim)] truncate">
                              {primary}
                            </h3>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--on-scrim-muted)] tabular-nums">
                              <span>{progressSubtitle}</span>
                              {state.hasNewEpisodes && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-[var(--accent-text)] font-medium">
                                    {zh.detail.newEpisodeBadge}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Inline Quick Action: Mark next episode / movie watched */}
                          {(nextUp || title.mediaType === 'movie') && (
                            <button
                              type="button"
                              onClick={handleQuickMark}
                              aria-label={
                                nextUp
                                  ? `${zh.home.markNextWatched} (${primary} ${formatEpisodeBadge(
                                      nextUp.key
                                    )})`
                                  : `${zh.home.markMovieWatched} (${primary})`
                              }
                              title={
                                nextUp
                                  ? `${zh.home.markNextWatched} ${formatEpisodeBadge(nextUp.key)}`
                                  : zh.home.markMovieWatched
                              }
                              className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-[var(--scrim-chip)] hover:bg-[var(--accent)] text-[var(--on-scrim)] backdrop-blur-md flex items-center justify-center gap-1.5 text-xs font-medium transition-colors shrink-0"
                            >
                              <Check className="w-4 h-4" />
                              <span className="tabular-nums">
                                {nextUp ? formatEpisodeBadge(nextUp.key) : '已看'}
                              </span>
                            </button>
                          )}
                        </div>

                        {/* Thin Progress Bar */}
                        <div className="absolute inset-x-0 bottom-0">
                          <ProgressBar
                            aria-label={`${primary} 进度`}
                            value={pct}
                            size="sm"
                            className="w-full"
                          >
                            <ProgressBar.Track className="h-1 bg-[var(--scrim-track)] overflow-hidden">
                              <ProgressBar.Fill className="h-full bg-[var(--accent)]" />
                            </ProgressBar.Track>
                          </ProgressBar>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );

      case 'new_episodes':
        if (newEpisodeItems.length === 0) return null;
        return (
          <section
            key="new_episodes"
            aria-labelledby="heading-new-episodes"
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2
                id="heading-new-episodes"
                className="text-lg sm:text-xl font-semibold text-[var(--foreground)] tracking-tight"
              >
                {zh.home.newEpisodes}
              </h2>
              <span className="text-xs text-[var(--accent-text)] font-medium tabular-nums">
                {newEpisodeItems.length} 部更新
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3.5 sm:gap-5">
              {newEpisodeItems.map(({ title, seasons, progress }) => (
                <PosterCard
                  key={title.id}
                  title={title}
                  seasons={seasons}
                  progress={progress}
                  defaultLang={settings.defaultTitleLang}
                  includeSpecials={settings.includeSpecials}
                />
              ))}
            </div>
          </section>
        );

      case 'pinned_lists':
        if (pinnedOrderedLists.length === 0) return null;
        return (
          <section
            key="pinned_lists"
            aria-labelledby="heading-pinned-lists"
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2
                id="heading-pinned-lists"
                className="text-lg sm:text-xl font-semibold text-[var(--foreground)] tracking-tight"
              >
                {zh.home.pinnedLists}
              </h2>
              <Link
                to="/lists"
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1 transition-colors"
              >
                <span>全部列表</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pinnedOrderedLists.map((list) => {
                const rawEntries = entriesByList[list.id] || [];
                const hydrated = rawEntries
                  .map((entry) => ({ entry, title: titles[entry.titleId] }))
                  .filter(
                    (item): item is { entry: ListEntryDoc; title: TitleDoc } =>
                      Boolean(item.title)
                  );

                const sorted = sortListEntries(
                  hydrated,
                  'ordered',
                  'manual',
                  settings.defaultTitleLang
                );

                const listStats = computeListProgress(
                  sorted,
                  seasonsByTitle,
                  progressMapForAllTitles,
                  { includeSpecials: settings.includeSpecials }
                );

                const nextTitleName = listStats.nextEntry
                  ? resolveDisplayTitle(
                      listStats.nextEntry.title.names,
                      listStats.nextEntry.title.displayLang,
                      settings.defaultTitleLang
                    ).primary
                  : null;

                const pct =
                  listStats.totalCount > 0
                    ? Math.round((listStats.completedCount / listStats.totalCount) * 100)
                    : 0;

                return (
                  <Link
                    key={list.id}
                    to={`/lists/${list.id}`}
                    className="group block rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] p-5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-[var(--accent-text)] font-medium">
                          <ListOrdered className="w-4 h-4 shrink-0" />
                          <span>{zh.lists.orderedType}</span>
                        </div>
                        <h3 className="mt-1.5 text-base font-semibold text-[var(--foreground)] truncate">
                          {list.name}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--foreground-secondary)] truncate">
                          {nextTitleName ? (
                            <>
                              <span className="text-[var(--muted)]">{zh.home.nextTitlePrefix}</span>
                              <span className="font-medium text-[var(--foreground)]">
                                {nextTitleName}
                              </span>
                            </>
                          ) : (
                            <span className="text-[var(--muted)]">{zh.home.allCompleted}</span>
                          )}
                        </p>
                      </div>

                      <div className="text-right shrink-0 tabular-nums">
                        <span className="text-sm font-semibold text-[var(--foreground)]">
                          {listStats.completedCount}/{listStats.totalCount}
                        </span>
                        <p className="text-xs text-[var(--muted)] mt-0.5">已看完</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <ProgressBar
                        aria-label={`${list.name} 列表进度`}
                        value={pct}
                        size="sm"
                        className="w-full"
                      >
                        <ProgressBar.Track className="h-1.5 bg-[var(--surface-tertiary)] rounded-full overflow-hidden">
                          <ProgressBar.Fill className="h-full bg-[var(--accent)] rounded-full" />
                        </ProgressBar.Track>
                      </ProgressBar>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );

      case 'recently_added':
        if (recentlyAddedItems.length === 0) return null;
        return (
          <section
            key="recently_added"
            aria-labelledby="heading-recently-added"
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2
                id="heading-recently-added"
                className="text-lg sm:text-xl font-semibold text-[var(--foreground)] tracking-tight"
              >
                {zh.home.recentlyAdded}
              </h2>
              <Link
                to="/library"
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-1 transition-colors"
              >
                <span>查看片库</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3.5 sm:gap-5">
              {recentlyAddedItems.slice(0, 6).map(({ title, seasons, progress }) => (
                <PosterCard
                  key={title.id}
                  title={title}
                  seasons={seasons}
                  progress={progress}
                  defaultLang={settings.defaultTitleLang}
                  includeSpecials={settings.includeSpecials}
                />
              ))}
            </div>
          </section>
        );

      case 'watchlist':
        if (watchlistItems.length === 0) return null;
        return (
          <section
            key="watchlist"
            aria-labelledby="heading-watchlist"
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2
                id="heading-watchlist"
                className="text-lg sm:text-xl font-semibold text-[var(--foreground)] tracking-tight"
              >
                {zh.home.watchlist}
              </h2>
              <span className="text-xs text-[var(--muted)] tabular-nums">
                {watchlistItems.length} 部待看
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3.5 sm:gap-5">
              {watchlistItems.slice(0, 12).map(({ title, seasons, progress }) => (
                <PosterCard
                  key={title.id}
                  title={title}
                  seasons={seasons}
                  progress={progress}
                  defaultLang={settings.defaultTitleLang}
                  includeSpecials={settings.includeSpecials}
                />
              ))}
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 space-y-10">
      {/* Top Header */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)]">
            {zh.nav.home}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">{zh.app.tagline}</p>
        </div>

        {/* Settings opens from an avatar button in the Home header, not a tab */}
        <div className="flex items-center gap-2.5">
          {!user && (
            <Button
              variant="secondary"
              size="sm"
              onPress={() => signIn().catch(() => {})}
              className="sm:hidden gap-1.5 text-xs min-h-[44px]"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Google 登录</span>
            </Button>
          )}

          <button
            type="button"
            onClick={() => navigate('/settings')}
            aria-label={zh.settings.title}
            title={zh.settings.title}
            className="min-w-[44px] min-h-[44px] px-2.5 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center gap-2 text-[var(--foreground)] transition-colors cursor-pointer"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || zh.settings.title}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-text)] flex items-center justify-center text-xs font-semibold">
                {user?.displayName ? user.displayName.slice(0, 1) : '帧'}
              </div>
            )}
            <Settings className="w-4 h-4 text-[var(--muted)]" />
          </button>
        </div>
      </header>

      {loadingData ? (
        <div className="space-y-8" aria-label="正在加载数据">
          <div className="space-y-4">
            <div className="h-6 w-28 rounded-lg bg-[var(--surface-secondary)] animate-pulse" />
            <div className="flex overflow-hidden gap-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-[85%] sm:w-[340px] lg:w-[380px] shrink-0 aspect-video rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pulse"
                />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-6 w-28 rounded-lg bg-[var(--surface-secondary)] animate-pulse" />
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="aspect-[2/3] rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      ) : isEmpty ? (
        <Card className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto my-8">
          <Card.Content className="flex flex-col items-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent-subtle)] flex items-center justify-center text-[var(--accent-text)]">
              <Film className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              {zh.home.emptyTitle}
            </h2>
            <p className="text-sm text-[var(--muted)] leading-relaxed max-w-md">
              {zh.home.emptyDescription}
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="primary"
                onPress={() => navigate('/search')}
                className="gap-2 font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>{zh.home.emptyAction}</span>
              </Button>
            </div>
          </Card.Content>
        </Card>
      ) : (
        <>{enabledSections.map((sec) => renderSection(sec.id))}</>
      )}
    </div>
  );
};
