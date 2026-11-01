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
  Sparkles,
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
  resolveDisplayTitle,
} from '../domain/progress';
import type { HomeSectionId, ListEntryDoc, ProgressDoc, TitleDoc } from '../domain/types';
import { zh } from '../i18n/zh';

export const HomePage: React.FC = () => {
  const {
    user,
    titles,
    seasonsByTitle,
    lists,
    entriesByList,
    settings,
    getActiveProgress,
    toggleEpisode,
    markWholeTitle,
    signIn,
    seedDemoLibrary,
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
                className="text-lg sm:text-xl font-semibold text-white tracking-tight"
              >
                {zh.home.continueWatching}
              </h2>
              <span className="text-xs text-[#9ca3af] tabular-nums">
                {continueWatchingItems.length} 部正在观看
              </span>
            </div>

            {continueWatchingItems.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#1a1a1f]/60 p-6 flex items-center justify-between gap-4">
                <p className="text-sm text-[#9ca3af]">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {continueWatchingItems.map(({ title, state }) => {
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

                  const pct = Math.max(8, Math.round(state.progressRatio * 100));
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
                      className="group relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#1a1a1f] transition-transform duration-200 hover:scale-[1.01]"
                    >
                      <Link
                        to={detailHref}
                        className="block relative focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]"
                      >
                        <MediaImage
                          src={title.backdropPath || title.posterPath}
                          alt={primary}
                          aspect="backdrop"
                          mediaType={title.mediaType}
                          priority
                        />

                        {/* Scrim overlay for contrast */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent" />

                        <div className="absolute inset-x-0 bottom-0 p-4 flex items-end justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-semibold text-white truncate">
                              {primary}
                            </h3>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-[#d1d5db] tabular-nums">
                              <span>{progressSubtitle}</span>
                              {state.hasNewEpisodes && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-[#60a5fa] font-medium">
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
                              className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-white/15 hover:bg-[#3b82f6] text-white backdrop-blur-md flex items-center justify-center gap-1.5 text-xs font-medium transition-colors shrink-0"
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
                            <ProgressBar.Track className="h-1 bg-white/20 overflow-hidden">
                              <ProgressBar.Fill className="h-full bg-[#3b82f6]" />
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
                className="text-lg sm:text-xl font-semibold text-white tracking-tight"
              >
                {zh.home.newEpisodes}
              </h2>
              <span className="text-xs text-[#60a5fa] font-medium tabular-nums">
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
                className="text-lg sm:text-xl font-semibold text-white tracking-tight"
              >
                {zh.home.pinnedLists}
              </h2>
              <Link
                to="/lists"
                className="text-xs text-[#9ca3af] hover:text-white flex items-center gap-1 transition-colors"
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
                    className="group block rounded-2xl border border-white/[0.07] bg-[#1a1a1f] hover:bg-[#202027] p-5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-[#60a5fa] font-medium">
                          <ListOrdered className="w-4 h-4 shrink-0" />
                          <span>{zh.lists.orderedType}</span>
                        </div>
                        <h3 className="mt-1.5 text-base font-semibold text-white truncate">
                          {list.name}
                        </h3>
                        <p className="mt-1 text-sm text-[#d1d5db] truncate">
                          {nextTitleName ? (
                            <>
                              <span className="text-[#9ca3af]">{zh.home.nextTitlePrefix}</span>
                              <span className="font-medium text-white">{nextTitleName}</span>
                            </>
                          ) : (
                            <span className="text-[#9ca3af]">{zh.home.allCompleted}</span>
                          )}
                        </p>
                      </div>

                      <div className="text-right shrink-0 tabular-nums">
                        <span className="text-sm font-semibold text-white">
                          {listStats.completedCount}/{listStats.totalCount}
                        </span>
                        <p className="text-xs text-[#9ca3af] mt-0.5">已看完</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <ProgressBar
                        aria-label={`${list.name} 列表进度`}
                        value={pct}
                        size="sm"
                        className="w-full"
                      >
                        <ProgressBar.Track className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <ProgressBar.Fill className="h-full bg-[#3b82f6] rounded-full" />
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
                className="text-lg sm:text-xl font-semibold text-white tracking-tight"
              >
                {zh.home.recentlyAdded}
              </h2>
              <Link
                to="/library"
                className="text-xs text-[#9ca3af] hover:text-white flex items-center gap-1 transition-colors"
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
                className="text-lg sm:text-xl font-semibold text-white tracking-tight"
              >
                {zh.home.watchlist}
              </h2>
              <span className="text-xs text-[#9ca3af] tabular-nums">
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {zh.nav.home}
          </h1>
          <p className="text-xs sm:text-sm text-[#9ca3af] mt-0.5">{zh.app.tagline}</p>
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
            className="min-w-[44px] min-h-[44px] px-2.5 rounded-2xl bg-[#1a1a1f] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center gap-2 text-white transition-colors cursor-pointer"
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || zh.settings.title}
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#3b82f6]/20 text-[#60a5fa] flex items-center justify-center text-xs font-semibold">
                {user?.displayName ? user.displayName.slice(0, 1) : '帧'}
              </div>
            )}
            <Settings className="w-4 h-4 text-[#9ca3af]" />
          </button>
        </div>
      </header>

      {isEmpty ? (
        <Card className="bg-[#1a1a1f] border border-white/[0.07] rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto my-8">
          <Card.Content className="flex flex-col items-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#3b82f6]/15 flex items-center justify-center text-[#60a5fa]">
              <Film className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-semibold text-white">{zh.home.emptyTitle}</h2>
            <p className="text-sm text-[#9ca3af] leading-relaxed max-w-md">
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
              <Button
                variant="secondary"
                onPress={() => seedDemoLibrary()}
                className="gap-2 font-medium"
              >
                <Sparkles className="w-4 h-4" />
                <span>{zh.home.seedDemoAction}</span>
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
