import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@heroui/react';
import { useTracker } from '../../context/TrackerContext';
import { computeTitleState } from '../../domain/status';
import { resolveDisplayTitle, resolveOverviewText } from '../../domain/ordering';
import { resolveTitleGenres } from '../../domain/genres';
import { TitleMenu } from './TitleMenu';
import { useI18n } from '../../i18n';

export function useTitleDetail() {
  const params = useParams<{ id?: string; titleId?: string }>();
  const id = params.id ?? params.titleId;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const highlightEpKey = searchParams.get('ep');

  const tracker = useTracker();
  const { t, locale, translateError } = useI18n();
  const {
    titles,
    seasonsByTitle,
    settings,
    getActiveProgress,
    refreshTitleMetadata,
    refreshLinkTitlePlaylist,
    fetchAndCacheTitleRatings,
  } = tracker;

  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [resumeDefaultEpKey, setResumeDefaultEpKey] = useState<string | null>(null);
  const [addToListOpen, setAddToListOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [undoPlaythroughOpen, setUndoPlaythroughOpen] = useState(false);
  const [deletePlaythroughId, setDeletePlaythroughId] = useState<string | null>(null);

  const title = id ? titles[id] : undefined;
  const seasons = useMemo(() => (id ? seasonsByTitle[id] ?? [] : []), [id, seasonsByTitle]);
  const activeProgress = title ? getActiveProgress(title) : undefined;
  const today = new Date().toISOString().slice(0, 10);

  const titleState = useMemo(() => {
    if (!title) return null;
    return computeTitleState(title, seasons, activeProgress, {
      includeSpecials: settings.includeSpecials,
      todayStr: today,
    });
  }, [title, seasons, activeProgress, settings.includeSpecials, today]);

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
    if (!titleId) return;
    const now = Date.now();
    const isOngoing =
      titleMediaType === 'tv' &&
      titleShowStatus &&
      !['ended', 'canceled'].includes(titleShowStatus.toLowerCase());
    const threshold = isOngoing ? 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const missingEitherLang =
      titleSource === 'tmdb' &&
      (!titleNameZh || !titleNameEn || (!titleOverviewZh && !titleOverviewEn));

    if (
      titleSource === 'tmdb' &&
      (!titleMetaFetchedAt || now - titleMetaFetchedAt > threshold || missingEitherLang)
    ) {
      void refreshTitleMetadata(titleId).catch(() => {});
    }

    const ratingThreshold = 7 * 24 * 60 * 60 * 1000;
    if (
      titleImdbId &&
      (!titleRatingsFetchedAt || now - titleRatingsFetchedAt > ratingThreshold)
    ) {
      void fetchAndCacheTitleRatings(titleId).catch(() => {});
    }
  }, [
    titleId,
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
    locale
  );
  const showOriginalSub = Boolean(secondary && secondary !== displayTitle);
  const overviewText =
    resolveOverviewText(title, settings.defaultTitleLang, locale) || t.detail.overview.empty;

  const regularSeasons = seasons
    .filter((s) => s.seasonNumber >= 1)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  const specialSeason = seasons.find((s) => s.seasonNumber === 0);

  const metaParts: string[] = [];
  if (title.year) metaParts.push(String(title.year));
  metaParts.push(t.mediaType[title.mediaType]);
  if (title.mediaType === 'tv' || regularSeasons.length > 0) {
    metaParts.push(t.detail.seasons.seasonCountMeta(regularSeasons.length || 1));
  } else if (title.runtimeMin) {
    metaParts.push(t.detail.seasons.runtimeMinutes(title.runtimeMin));
  }
  const localizedGenres = resolveTitleGenres(
    title,
    locale,
    tracker.tmdbGenres ? (locale === 'en' ? tracker.tmdbGenres.en : tracker.tmdbGenres.zh) : undefined
  );
  if (localizedGenres.length > 0) {
    metaParts.push(localizedGenres.slice(0, 2).join(' / '));
  }

  const hasAnyProgress = Boolean(
    title.playthroughs.length > 1 ||
      title.resume ||
      (activeProgress &&
        (Object.keys(activeProgress.watched).length > 0 || Boolean(activeProgress.movieWatchedAt)))
  );

  const menuNode = React.createElement(TitleMenu, {
    title,
    titleState,
    hasAnyProgress,
    onAddToList: () => setAddToListOpen(true),
    onOpenResume: () => {
      setResumeDefaultEpKey(title.resume?.episodeKey ?? titleState.nextUp?.key ?? null);
      setResumeDialogOpen(true);
    },
    onMarkWholeWatched: () => void tracker.markWholeTitle(title.id, true),
    onUndoPlaythrough: () => setUndoPlaythroughOpen(true),
    onSetManualState: (state) => void tracker.setTitleManualState(title.id, state),
    onOpenLangSelect: () => setLangModalOpen(true),
    onOpenEdit: () => setEditModalOpen(true),
    onRefreshMetadata: async () => {
      try {
        await refreshTitleMetadata(title.id);
      } catch (err) {
        toast.danger(translateError(err));
      }
    },
    onRefreshPlaylist:
      title.source === 'url' && title.sourceId
        ? async () => {
            try {
              const count = await refreshLinkTitlePlaylist(title.id);
              if (count > 0) {
                toast.success(t.detail.menu.refreshPlaylistAddedToast(count));
              } else {
                toast.success(t.detail.menu.refreshPlaylistNoNewToast);
              }
            } catch (err) {
              toast.danger(translateError(err));
            }
          }
        : undefined,
    onDelete: () => setDeleteConfirmOpen(true),
  });

  return {
    ...tracker,
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
