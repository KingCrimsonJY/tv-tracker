import React from 'react';
import { ButtonLink } from '../components/ButtonLink';
import { Link } from 'react-router-dom';
import { Check, ChevronRight, Film, ListOrdered, Plus, Settings } from 'lucide-react';
import { Button, ProgressBar, Skeleton } from '@heroui/react';
import { MediaImage } from '../components/MediaImage';
import { PosterCard } from '../components/PosterCard';
import { useTracker } from '../context/TrackerContext';
import { compareRank, computeListProgress, sortListEntries } from '../domain/ordering';
import { activeProgressOf, NO_SEASONS } from '../domain/stableRefs';
import {
  computeTitleState,
  formatSeconds,
  getTitleContinueProgressRatio,
  pickBackdrop,
  pickPoster,
  resolveDisplayTitle,
} from '../domain/progress';
import type { AppStateSnapshot, HomeSectionId, ListEntryDoc, ProgressDoc, TitleDoc } from '../domain/types';
import { useI18n } from '../i18n';

const selectHomeData = (state: AppStateSnapshot) => [
  state.titles,
  state.seasonsByTitle,
  state.progressByTitle,
  state.lists,
  state.entriesByList,
  state.settings,
];

export const HomePage: React.FC = () => {
  const {
    loadingData,
    titles,
    seasonsByTitle,
    progressByTitle,
    lists,
    entriesByList,
    settings,
    markEpisodeWatched,
    markWholeTitle,
  } = useTracker(selectHomeData);
  const { locale, t } = useI18n();

  const allTitles = Object.values(titles);
  const defaultLang = settings.defaultTitleLang;
  const includeSpecials = settings.includeSpecials;

  const progressByTitleMap: Record<string, ProgressDoc | undefined> = {};
  for (const titleDoc of allTitles) {
    progressByTitleMap[titleDoc.id] = activeProgressOf(progressByTitle, titleDoc);
  }

  const enriched = allTitles.map((title) => {
    const seasons = seasonsByTitle[title.id] ?? NO_SEASONS;
    const progress = progressByTitleMap[title.id];
    const state = computeTitleState(title, seasons, progress, { includeSpecials });
    return { title, seasons, progress, state };
  });

  const continueWatchingItems = enriched
    .filter(
      ({ title, state }) =>
        state.status === 'watching' && (state.nextUp !== null || Boolean(title.resume && title.resume.seconds > 0)),
    )
    .sort((a, b) => b.title.lastActivityAt - a.title.lastActivityAt);

  const newEpisodeItems = enriched
    .filter(({ state }) => state.hasNewEpisodes)
    .sort((a, b) => b.title.lastActivityAt - a.title.lastActivityAt);

  const recentlyAddedItems = [...enriched].sort((a, b) => b.title.addedAt - a.title.addedAt).slice(0, 12);

  const wantToWatchItems = enriched
    .filter(({ state }) => state.status === 'unwatched')
    .sort((a, b) => b.title.addedAt - a.title.addedAt)
    .slice(0, 12);

  const pinnedOrderedLists = Object.values(lists)
    .filter((l) => l.pinned)
    .sort(compareRank);

  const renderPosterGridSection = (
    key: HomeSectionId,
    heading: string,
    items: typeof enriched,
    moreLink?: { to: string; label: string },
  ) => {
    if (items.length === 0) return null;
    return (
      <section key={key} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">{heading}</h2>
          {moreLink && (
            <Link
              to={moreLink.to}
              className="text-xs font-medium text-muted hover:text-foreground flex items-center gap-1 min-h-[44px] px-2"
            >
              <span>{moreLink.label}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
        <div className="poster-grid">
          {items.map(({ title, seasons, progress }) => (
            <PosterCard
              key={title.id}
              title={title}
              seasons={seasons}
              progress={progress}
              defaultLang={defaultLang}
              includeSpecials={includeSpecials}
            />
          ))}
        </div>
      </section>
    );
  };

  const renderSection = (key: HomeSectionId) => {
    switch (key) {
      case 'continue_watching': {
        if (continueWatchingItems.length === 0) return null;
        return (
          <section key={key} className="space-y-4">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
              {t.home.sections.continue_watching}
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none">
              {continueWatchingItems.map(({ title, seasons, progress, state }) => {
                const { primary } = resolveDisplayTitle(title.names, title.displayLang, defaultLang, locale);
                const ratio = getTitleContinueProgressRatio(title, seasons, state.progressRatio);
                // Report the real value to assistive technology; the fill's min width keeps a visible sliver.
                const pct = Math.min(100, ratio * 100);

                let subtitle: string = t.status[state.status];
                if (title.resume && title.resume.seconds > 0) {
                  const timeStr = formatSeconds(title.resume.seconds);
                  if (title.resume.episodeKey) {
                    const m = /^s(\d+)e(\d+)$/i.exec(title.resume.episodeKey);
                    if (m) subtitle = t.home.resumeEpisodeLabel(Number(m[1]), Number(m[2]), timeStr);
                  } else {
                    subtitle = t.home.resumeMovieLabel(timeStr);
                  }
                } else if (state.nextUp) {
                  subtitle = t.home.nextEpisodeLabel(state.nextUp.seasonNumber, state.nextUp.number);
                }

                // A resume point can sit on an episode that is already watched (e.g. a rewatch of one
                // episode); the quick action then targets the next unwatched episode instead.
                const resumeKey = title.resume?.episodeKey;
                const quickMarkEpisodeKey =
                  resumeKey && progress?.watched[resumeKey] === undefined ? resumeKey : state.nextUp?.key;

                return (
                  <div
                    key={title.id}
                    className="relative shrink-0 w-[280px] sm:w-[320px] snap-start group rounded-2xl overflow-hidden border border-border bg-surface"
                  >
                    <Link
                      to={`/title/${title.id}${quickMarkEpisodeKey ? `?ep=${quickMarkEpisodeKey}` : ''}`}
                      className="block relative"
                    >
                      <MediaImage
                        src={pickBackdrop(title, locale) || pickPoster(title, locale)}
                        alt={primary}
                        aspect="backdrop"
                        mediaType={title.mediaType}
                        priority
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-3.5 space-y-2">
                        <div className="pr-11">
                          <h3 className="text-sm sm:text-base font-semibold text-white truncate">{primary}</h3>
                          <p className="text-xs text-white/80 tabular-nums mt-0.5 truncate">{subtitle}</p>
                        </div>
                        <ProgressBar
                          aria-label={`${primary} ${t.app.watchProgressAriaSuffix}`}
                          value={pct}
                          size="sm"
                          className="w-full"
                        >
                          <ProgressBar.Track>
                            <ProgressBar.Fill className="min-w-1.5" />
                          </ProgressBar.Track>
                        </ProgressBar>
                      </div>
                    </Link>

                    {quickMarkEpisodeKey ? (
                      <div className="absolute right-3 bottom-5 z-10">
                        <Button
                          variant="secondary"
                          size="sm"
                          isIconOnly
                          onPress={() => {
                            void markEpisodeWatched(title.id, quickMarkEpisodeKey);
                          }}
                          aria-label={t.home.markNextWatchedAria(primary, quickMarkEpisodeKey.toUpperCase())}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : !state.isEpisodic ? (
                      <div className="absolute right-3 bottom-5 z-10">
                        <Button
                          variant="secondary"
                          size="sm"
                          isIconOnly
                          onPress={() => {
                            void markWholeTitle(title.id, true);
                          }}
                          aria-label={t.home.markMovieWatchedAria(primary)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        );
      }

      case 'new_episodes':
        return renderPosterGridSection(key, t.home.sections.new_episodes, newEpisodeItems);

      case 'pinned_lists': {
        if (pinnedOrderedLists.length === 0) return null;
        return (
          <section key={key} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                {t.home.sections.pinned_lists}
              </h2>
              <Link
                to="/lists"
                className="text-xs font-medium text-muted hover:text-foreground flex items-center gap-1 min-h-[44px] px-2"
              >
                <span>{t.home.manageLists}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pinnedOrderedLists.map((list) => {
                const rawEntries = entriesByList[list.id] || [];
                const hydrated = rawEntries
                  .map((entry) => ({ entry, title: titles[entry.titleId] }))
                  .filter((item): item is { entry: ListEntryDoc; title: TitleDoc } => Boolean(item.title));
                const sorted = sortListEntries(hydrated, list.kind, list.collectionSort, defaultLang, locale);
                const stats = computeListProgress(sorted, seasonsByTitle, progressByTitleMap, {
                  includeSpecials,
                });
                const nextTitleName = stats.nextEntry
                  ? resolveDisplayTitle(
                      stats.nextEntry.title.names,
                      stats.nextEntry.title.displayLang,
                      defaultLang,
                      locale,
                    ).primary
                  : null;
                const pct = stats.totalCount > 0 ? Math.round((stats.completedCount / stats.totalCount) * 100) : 0;

                return (
                  <Link
                    key={list.id}
                    to={`/lists/${list.id}`}
                    className="group flex flex-col justify-between p-4 rounded-2xl border border-border bg-surface hover:bg-surface-secondary transition-colors space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs text-accent-soft-foreground font-medium">
                          <ListOrdered className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{list.name}</span>
                        </div>
                        <p className="mt-1.5 text-sm font-medium text-foreground truncate">
                          {nextTitleName
                            ? t.home.pinnedListNextUp(nextTitleName)
                            : stats.totalCount > 0
                              ? t.home.pinnedListAllDone
                              : t.home.pinnedListEmpty}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-muted tabular-nums shrink-0">
                        {t.home.pinnedListProgress(stats.completedCount, stats.totalCount)}
                      </span>
                    </div>

                    <ProgressBar aria-label={t.lists.progressAria(list.name)} value={pct} size="sm" className="w-full">
                      <ProgressBar.Track>
                        <ProgressBar.Fill />
                      </ProgressBar.Track>
                    </ProgressBar>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      }

      case 'recently_added':
        return renderPosterGridSection(key, t.home.sections.recently_added, recentlyAddedItems, {
          to: '/library',
          label: t.home.viewAllLibrary,
        });

      case 'watchlist':
        return renderPosterGridSection(key, t.home.sections.watchlist, wantToWatchItems);

      default:
        return null;
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t.home.title}</h1>
        <div className="flex items-center gap-2">
          <ButtonLink to="/search" variant="secondary" size="sm">
            <Plus className="w-4 h-4" />
            <span>{t.library.addMediaButton}</span>
          </ButtonLink>
          <ButtonLink to="/settings" variant="secondary" size="sm" isIconOnly aria-label={t.settings.title}>
            <Settings className="w-4 h-4" />
          </ButtonLink>
        </div>
      </header>

      {loadingData ? (
        <div className="space-y-6" aria-label={t.home.loadingAria}>
          <Skeleton className="h-6 w-32 rounded-lg" />
          <div className="flex gap-4 overflow-hidden">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="w-[280px] sm:w-[320px] aspect-video rounded-2xl shrink-0" />
            ))}
          </div>
        </div>
      ) : allTitles.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 sm:p-12 text-center max-w-lg mx-auto my-8 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent-soft-foreground flex items-center justify-center mx-auto">
            <Film className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{t.home.emptyLibraryTitle}</h2>
          <p className="text-sm text-muted leading-relaxed">{t.home.emptyLibraryDescription}</p>
          <div className="pt-2">
            <ButtonLink to="/search" variant="primary">
              <Plus className="w-4 h-4" />
              <span>{t.home.emptyLibraryCta}</span>
            </ButtonLink>
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          {settings.homeSections.filter((s) => s.enabled).map((s) => renderSection(s.id))}
        </div>
      )}
    </div>
  );
};
