import { useTitleEpisodes } from './useTitleEpisodes';
import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@heroui/react';
import { useTracker } from '../../context/TrackerContext';
import { selectEntriesByList, selectLists, selectSettings } from '../../data/selectors';
import { useTrackerState } from '../../data/useTrackerState';
import type { AppStateSnapshot } from '../../domain/types';
import { canMarkWholeTitleWatched } from '../../domain/actions';
import { computeTitleState } from '../../domain/status';
import { resolveDisplayTitle, resolveOverviewText } from '../../domain/ordering';
import { resolveTitleGenres } from '../../domain/genres';
import { TitleMenu } from './TitleMenu';
import { useI18n } from '../../i18n';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useToday } from '../../hooks/useToday';

export function useTitleDetail() {
  const params = useParams<{ id?: string; titleId?: string }>();
  const id = params.id ?? params.titleId;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const highlightEpKey = searchParams.get('ep');

  const tracker = useTracker();
  const title = useTrackerState(useCallback((state: AppStateSnapshot) => (id ? state.titles[id] : undefined), [id]));
  const compactSeasons = useTrackerState(
    useCallback((state: AppStateSnapshot) => (id ? state.seasonsByTitle[id] : undefined), [id]),
  );
  const progressDocs = useTrackerState(
    useCallback((state: AppStateSnapshot) => (id ? state.progressByTitle[id] : undefined), [id]),
  );
  const settings = useTrackerState(selectSettings);
  const lists = useTrackerState(selectLists);
  const entriesByList = useTrackerState(selectEntriesByList);
  const { t, locale, translateError } = useI18n();
  usePageTitle(
    title ? resolveDisplayTitle(title.names, title.displayLang, settings.defaultTitleLang, locale).primary : null,
  );
  const { refreshTitleMetadata, refreshLinkTitlePlaylist, fetchAndCacheTitleRatings } = tracker;

  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [resumeDefaultEpKey, setResumeDefaultEpKey] = useState<string | null>(null);
  const [addToListOpen, setAddToListOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [undoPlaythroughOpen, setUndoPlaythroughOpen] = useState(false);
  const [deletePlaythroughId, setDeletePlaythroughId] = useState<string | null>(null);

  const seasons = useTitleEpisodes(id, compactSeasons, title?.episodeDetailsVersion ?? title?.metaFetchedAt);
  const activeProgress = useMemo(
    () =>
      title
        ? (progressDocs?.[title.activePlaythroughId] ?? { playthroughId: title.activePlaythroughId, watched: {} })
        : undefined,
    [title, progressDocs],
  );
  const today = useToday();

  const titleState = useMemo(() => {
    if (!title) return null;
    return computeTitleState(title, seasons, activeProgress, {
      includeSpecials: settings.includeSpecials,
      todayStr: today,
    });
  }, [title, seasons, activeProgress, settings.includeSpecials, today]);

  const titleUnavailable = title?.sourceUnavailable;
  const titleId = title?.id;
  const titleMetaFetchedAt = title?.metaFetchedAt;
  const titleRatingsFetchedAt = title?.ratings.fetchedAt;
  const titleSource = title?.source;
  const titleMediaType = title?.mediaType;
  const titleShowStatus = title?.showStatus;
  const titleImdbId = title?.externalIds?.imdb;
  const titleNameZh = title?.names.zh;
  const titleNameEn = title?.names.en;
  const titleOverviewZh = title?.overview.zh;
  const titleOverviewEn = title?.overview.en;

  useEffect(() => {
    if (!titleId || titleUnavailable) return;
    const now = Date.now();
    const isOngoing =
      titleMediaType === 'tv' && titleShowStatus && !['ended', 'canceled'].includes(titleShowStatus.toLowerCase());
    const threshold = isOngoing ? 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const missingEitherLang =
      titleSource === 'tmdb' && (!titleNameZh || !titleNameEn || (!titleOverviewZh && !titleOverviewEn));

    if (
      titleSource === 'tmdb' &&
      (!titleMetaFetchedAt ||
        now - titleMetaFetchedAt > threshold ||
        (missingEitherLang && now - titleMetaFetchedAt > 3600_000))
    ) {
      void refreshTitleMetadata(titleId).catch(() => {});
    }

    const ratingThreshold = 7 * 24 * 60 * 60 * 1000;
    if (titleImdbId && (!titleRatingsFetchedAt || now - titleRatingsFetchedAt > ratingThreshold)) {
      void fetchAndCacheTitleRatings(titleId).catch(() => {});
    }
  }, [
    titleId,
    titleUnavailable,
    titleMetaFetchedAt,
    titleRatingsFetchedAt,
    titleSource,
    titleMediaType,
    titleShowStatus,
    titleImdbId,
    titleNameZh,
    titleNameEn,
    titleOverviewZh,
    titleOverviewEn,
    refreshTitleMetadata,
    fetchAndCacheTitleRatings,
  ]);

  if (!title || !titleState) {
    return { title: undefined, titleState: null, navigate } as const;
  }

  const { primary: displayTitle, secondary } = resolveDisplayTitle(
    title.names,
    title.displayLang,
    settings.defaultTitleLang,
    locale,
  );
  const showOriginalSub = Boolean(secondary && secondary !== displayTitle);
  const rawOverview = resolveOverviewText(title, settings.defaultTitleLang, locale);
  const hasOverviewText = Boolean(rawOverview && rawOverview.trim() !== '');
  const overviewText = hasOverviewText ? rawOverview : t.detail.overview.empty;

  const regularSeasons = seasons.filter((s) => s.seasonNumber >= 1).sort((a, b) => a.seasonNumber - b.seasonNumber);
  const specialSeason = seasons.find((s) => s.seasonNumber === 0);

  const metaParts: string[] = [];
  if (title.year) metaParts.push(String(title.year));
  metaParts.push(t.mediaType[title.mediaType]);
  if (titleState.isEpisodic) {
    metaParts.push(t.detail.seasons.seasonCountMeta(regularSeasons.length || 1));
  } else if (title.runtimeMin) {
    metaParts.push(t.detail.seasons.runtimeMinutes(title.runtimeMin));
  }
  const localizedGenres = resolveTitleGenres(
    title,
    locale,
    tracker.tmdbGenres ? (locale === 'en' ? tracker.tmdbGenres.en : tracker.tmdbGenres.zh) : undefined,
  );
  if (localizedGenres.length > 0) {
    metaParts.push(localizedGenres.slice(0, 2).join(' / '));
  }

  const menuNode = React.createElement(TitleMenu, {
    title,
    titleState,
    onToggleStructureLock: () => {
      void tracker
        .setStructureLock(title.id, !title.structureLocked)
        .catch((error: unknown) => toast.danger(translateError(error)));
    },
    onAddToList: () => setAddToListOpen(true),
    onOpenResume: () => {
      setResumeDefaultEpKey(title.resume?.episodeKey ?? titleState.nextUp?.key ?? null);
      setResumeDialogOpen(true);
    },
    onMarkWholeWatched: () => void tracker.markWholeTitle(title.id, true),
    onSetManualState: (state) => void tracker.setTitleManualState(title.id, state),
    onOpenLangSelect: () => setLangModalOpen(true),
    onOpenEdit: () => setEditModalOpen(true),
    onRefreshMetadata: async () => {
      try {
        const status = await refreshTitleMetadata(title.id);
        const message = t.settings.dataManagement.refreshAllSummary(
          status === 'updated' ? 1 : 0,
          status === 'needsReview' ? 1 : 0,
          status === 'partial' ? 1 : 0,
          status === 'failed' ? 1 : 0,
          status === 'skipped' ? 1 : 0,
        );
        if (status === 'failed' || status === 'partial') toast.warning(message);
        else toast.success(message);
      } catch (err) {
        toast.danger(translateError(err));
      }
    },
    onRefreshPlaylist:
      title.source === 'url' && title.sourceId
        ? () => {
            // The action reports the outcome itself, success or failure.
            void refreshLinkTitlePlaylist(title.id).catch(() => {});
          }
        : undefined,
    onDelete: () => setDeleteConfirmOpen(true),
    canMarkAllWatched: canMarkWholeTitleWatched(title, seasons, {
      includeSpecials: settings.includeSpecials,
      todayStr: today,
    }),
  });

  return {
    ...tracker,
    lists,
    entriesByList,
    title,
    titleState,
    activeProgress,
    seasons,
    regularSeasons,
    specialSeason,
    today,
    highlightEpKey,
    displayTitle,
    showOriginalSub,
    hasOverviewText,
    overviewText,
    overviewExpanded,
    setOverviewExpanded,
    metaParts,
    menuNode,
    resumeDialogOpen,
    setResumeDialogOpen,
    resumeDefaultEpKey,
    setResumeDefaultEpKey,
    addToListOpen,
    setAddToListOpen,
    langModalOpen,
    setLangModalOpen,
    editModalOpen,
    setEditModalOpen,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    undoPlaythroughOpen,
    setUndoPlaythroughOpen,
    deletePlaythroughId,
    setDeletePlaythroughId,
    navigate,
  };
}
