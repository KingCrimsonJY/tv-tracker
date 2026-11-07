import { createRandomId } from '../../domain/id.ts';
import { makeEpisodeKey, normalizeLocalizedEpisodeName } from '../../domain/progress.ts';
import type {
  DisplayLang,
  EpisodeMeta,
  LinkImportEpisodeSeed,
  ManualState,
  ProgressDoc,
  SeasonDoc,
  TitleDoc,
} from '../../domain/types.ts';
import { getActiveCatalog } from '../../i18n/index.ts';
import { fetchTitleDetailsApi, fetchTmdbDetailsApi, patchTitleApi, putSeasonsApi, putTitleApi } from '../api.ts';
import type { CustomTitleInput, TrackerActionDeps, UpdateTitleDetailsInput } from './types.ts';

function buildCustomSeasons(
  epCount: number,
  runtimeMin: number | null,
  prevSeasons: SeasonDoc[] = [],
  episodeSeeds?: LinkImportEpisodeSeed[],
): SeasonDoc[] {
  const seedList = episodeSeeds && episodeSeeds.length > 0 ? episodeSeeds : [];
  const totalCount = epCount > 0 ? epCount : seedList.length;
  if (totalCount <= 0) return [];

  const existingS1 = prevSeasons.find((s) => s.seasonNumber === 1);
  const episodes: EpisodeMeta[] = Array.from({ length: totalCount }, (_, idx) => {
    const epNum = idx + 1;
    const prevEp = existingS1?.episodes.find((e) => e.number === epNum);
    if (prevEp) return prevEp;

    const seed = seedList[idx];
    return {
      number: epNum,
      key: makeEpisodeKey(1, epNum),
      name: normalizeLocalizedEpisodeName(seed?.name),
      airDate: seed?.airDate ?? null,
      runtime: seed?.runtime ?? runtimeMin,
      stillPath: null,
      overview: {},
      ...(seed?.sourceVideoId ? { sourceVideoId: seed.sourceVideoId } : {}),
    };
  });
  return [{ seasonNumber: 1, name: null, episodes }];
}

export function createTitleActions(
  deps: TrackerActionDeps & {
    addTitleToList: (listId: string, titleId: string) => Promise<void>;
    triggerRefetch: () => Promise<void>;
  },
) {
  const { getState, setState, applyServerMutation, showToast, addTitleToList, triggerRefetch } = deps;

  const removeOptimisticNewTitle = (id: string) => {
    setState((curr) => {
      const nextTitles = { ...curr.titles };
      delete nextTitles[id];
      const nextSeasons = { ...curr.seasonsByTitle };
      delete nextSeasons[id];
      const nextProg = { ...curr.progressByTitle };
      delete nextProg[id];
      return { ...curr, titles: nextTitles, seasonsByTitle: nextSeasons, progressByTitle: nextProg };
    });
  };

  async function addTitleFromTmdb(
    mediaType: 'movie' | 'tv',
    sourceId: string,
    targetListId?: string,
  ): Promise<TitleDoc> {
    const existingId = `tmdb_${mediaType}_${sourceId}`;
    let titleDoc = getState().titles[existingId];

    if (!titleDoc) {
      const data = await fetchTmdbDetailsApi(mediaType, sourceId);

      const createdTitle = data.title;
      titleDoc = createdTitle;
      const initialProgress: ProgressDoc = {
        playthroughId: createdTitle.activePlaythroughId,
        watched: {},
      };
      const seasons = data.seasons || [];

      setState((prev) => ({
        ...prev,
        titles: { ...prev.titles, [createdTitle.id]: createdTitle },
        seasonsByTitle: { ...prev.seasonsByTitle, [createdTitle.id]: seasons },
        progressByTitle: {
          ...prev.progressByTitle,
          [createdTitle.id]: {
            ...(prev.progressByTitle[createdTitle.id] || {}),
            [initialProgress.playthroughId]: initialProgress,
          },
        },
      }));

      try {
        const mut = await putTitleApi(createdTitle.id, {
          title: createdTitle,
          seasons,
          progress: { [initialProgress.playthroughId]: initialProgress },
        });
        applyServerMutation(mut);
      } catch (err) {
        removeOptimisticNewTitle(createdTitle.id);
        void triggerRefetch();
        throw err;
      }
    }

    if (targetListId && getState().lists[targetListId]) {
      await addTitleToList(targetListId, titleDoc.id);
    }
    return titleDoc;
  }

  async function createCustomOrLinkTitle(input: CustomTitleInput): Promise<TitleDoc> {
    const now = Date.now();
    const id = createRandomId(input.source);
    const trimmedName = input.name.trim() || 'Untitled';
    const trimmedOrig = input.originalName?.trim() || trimmedName;
    const seedEpisodes = input.episodes && input.episodes.length > 0 ? input.episodes : undefined;
    const epCount =
      input.episodeCount && input.episodeCount > 0
        ? Math.min(2000, Math.floor(input.episodeCount))
        : seedEpisodes
          ? Math.min(2000, seedEpisodes.length)
          : 0;

    const rawPoster = input.posterPath ?? input.posterUrl;
    const posterUrl = rawPoster?.trim() ? rawPoster.trim().slice(0, 1000) : null;
    const rawSource = input.sourceUrl ?? input.sourceId;
    const sourceId = rawSource?.trim() ? rawSource.trim().slice(0, 2048) : null;
    const uploader = input.uploader?.trim() ? input.uploader.trim().slice(0, 200) : null;

    const newTitle: TitleDoc = {
      id,
      source: input.source,
      sourceId,
      mediaType: input.mediaType,
      names: { original: trimmedOrig, zh: trimmedName, en: trimmedOrig },
      displayLang: null,
      year: input.year || null,
      runtimeMin: input.runtimeMin || null,
      genres: [],
      posterPath: posterUrl,
      backdropPath: posterUrl,
      overview: { zh: input.overview?.trim() || '' },
      ...(uploader ? { uploader } : {}),
      showStatus: 'Ended',
      externalIds: {},
      ratings: {},
      manualState: null,
      playthroughs: [{ id: 'p1', number: 1, startedAt: now }],
      activePlaythroughId: 'p1',
      resume: null,
      metaFetchedAt: now,
      addedAt: now,
      updatedAt: now,
      lastActivityAt: now,
    };

    const seasons = buildCustomSeasons(
      input.mediaType === 'movie' ? 0 : epCount,
      input.runtimeMin || null,
      [],
      input.mediaType === 'movie' ? undefined : seedEpisodes,
    );
    const initialProgress: ProgressDoc = { playthroughId: 'p1', watched: {} };

    setState((prev) => ({
      ...prev,
      titles: { ...prev.titles, [newTitle.id]: newTitle },
      seasonsByTitle: { ...prev.seasonsByTitle, [newTitle.id]: seasons },
      progressByTitle: { ...prev.progressByTitle, [newTitle.id]: { p1: initialProgress } },
    }));

    try {
      const mut = await putTitleApi(newTitle.id, {
        title: newTitle,
        seasons,
        progress: { p1: initialProgress },
      });
      applyServerMutation(mut);
    } catch (err) {
      removeOptimisticNewTitle(newTitle.id);
      void triggerRefetch();
      throw err;
    }

    if (input.targetListId && getState().lists[input.targetListId]) {
      await addTitleToList(input.targetListId, newTitle.id);
    }
    return newTitle;
  }

  async function updateTitleDetails(titleId: string, input: UpdateTitleDetailsInput): Promise<void> {
    const state = getState();
    const prevTitle = state.titles[titleId];
    if (!prevTitle) return;
    const prevSeasons = state.seasonsByTitle[titleId] || [];
    const now = Date.now();

    const nextZh = input.name !== undefined ? input.name.trim() || prevTitle.names.zh : prevTitle.names.zh;
    const nextOrig =
      input.originalName !== undefined
        ? input.originalName.trim() || nextZh || prevTitle.names.original
        : prevTitle.names.original;
    const posterUrl =
      input.posterPath !== undefined
        ? input.posterPath?.trim()
          ? input.posterPath.trim().slice(0, 500)
          : null
        : prevTitle.posterPath;

    const updatedTitle: TitleDoc = {
      ...prevTitle,
      mediaType: input.mediaType ?? prevTitle.mediaType,
      names: { ...prevTitle.names, original: nextOrig, zh: nextZh },
      year: input.year !== undefined ? input.year : prevTitle.year,
      runtimeMin: input.runtimeMin !== undefined ? input.runtimeMin : prevTitle.runtimeMin,
      posterPath: posterUrl,
      backdropPath: prevTitle.source !== 'tmdb' ? posterUrl || prevTitle.backdropPath : prevTitle.backdropPath,
      overview: {
        ...prevTitle.overview,
        ...(input.overview !== undefined ? { zh: input.overview.trim() } : {}),
      },
      ...(input.uploader !== undefined ? { uploader: input.uploader?.trim() || null } : {}),
      updatedAt: now,
      lastActivityAt: now,
    };

    let updatedSeasons: SeasonDoc[] | undefined = undefined;
    if ((prevTitle.source === 'custom' || prevTitle.source === 'url') && input.episodeCount !== undefined) {
      const epCount = input.episodeCount && input.episodeCount > 0 ? Math.min(2000, Math.floor(input.episodeCount)) : 0;
      updatedSeasons = buildCustomSeasons(
        epCount,
        updatedTitle.runtimeMin || null,
        (await fetchTitleDetailsApi(titleId)).seasons,
      );
    }

    const patch: Partial<Omit<TitleDoc, 'id'>> = { updatedAt: now, lastActivityAt: now };
    const revertPatch: Partial<Omit<TitleDoc, 'id'>> = {
      updatedAt: prevTitle.updatedAt,
      lastActivityAt: prevTitle.lastActivityAt,
    };

    const keys = [
      'mediaType',
      'names',
      'year',
      'runtimeMin',
      'posterPath',
      'backdropPath',
      'overview',
      'uploader',
      'externalIds',
      'ratings',
    ] as const;
    for (const key of keys) {
      if (JSON.stringify(updatedTitle[key]) !== JSON.stringify(prevTitle[key])) {
        Object.assign(patch, { [key]: updatedTitle[key] });
        Object.assign(revertPatch, { [key]: prevTitle[key] });
      }
    }

    setState((prev) => ({
      ...prev,
      titles: {
        ...prev.titles,
        [titleId]: { ...(prev.titles[titleId] || prevTitle), ...patch, id: titleId },
      },
      ...(updatedSeasons !== undefined
        ? { seasonsByTitle: { ...prev.seasonsByTitle, [titleId]: updatedSeasons } }
        : {}),
    }));

    try {
      const mut = await patchTitleApi(titleId, patch);
      applyServerMutation(mut);
      if (updatedSeasons !== undefined) {
        const sMut = await putSeasonsApi(titleId, updatedSeasons);
        applyServerMutation(sMut);
      }
    } catch {
      setState((curr) => ({
        ...curr,
        titles: curr.titles[titleId]
          ? { ...curr.titles, [titleId]: { ...curr.titles[titleId], ...revertPatch, id: titleId } }
          : curr.titles,
        ...(updatedSeasons !== undefined ? { seasonsByTitle: { ...curr.seasonsByTitle, [titleId]: prevSeasons } } : {}),
      }));
      showToast(getActiveCatalog().app.writeRollbackToast, 'danger');
      await triggerRefetch();
    }
  }

  async function updateTitleLanguage(
    titleId: string,
    displayLang: DisplayLang | null,
    customName?: string,
  ): Promise<void> {
    const prevTitle = getState().titles[titleId];
    if (!prevTitle) return;
    const now = Date.now();
    const trimmedCustom = customName?.trim();
    const updatedNames = { ...prevTitle.names };
    if (trimmedCustom) updatedNames.custom = trimmedCustom;
    else if (customName !== undefined) delete updatedNames.custom;

    const patch: Partial<Omit<TitleDoc, 'id'>> = {
      displayLang,
      updatedAt: now,
      ...(JSON.stringify(updatedNames) !== JSON.stringify(prevTitle.names) ? { names: updatedNames } : {}),
    };

    setState((prev) =>
      prev.titles[titleId]
        ? { ...prev, titles: { ...prev.titles, [titleId]: { ...prev.titles[titleId], ...patch, id: titleId } } }
        : prev,
    );

    try {
      applyServerMutation(await patchTitleApi(titleId, patch));
    } catch {
      setState((curr) =>
        curr.titles[titleId]
          ? {
              ...curr,
              titles: {
                ...curr.titles,
                [titleId]: {
                  ...curr.titles[titleId],
                  displayLang: prevTitle.displayLang,
                  names: prevTitle.names,
                  updatedAt: prevTitle.updatedAt,
                },
              },
            }
          : curr,
      );
      showToast(getActiveCatalog().app.writeRollbackToast, 'danger');
      await triggerRefetch();
    }
  }

  async function setTitleManualState(titleId: string, manualState: ManualState): Promise<void> {
    const prevTitle = getState().titles[titleId];
    if (!prevTitle) return;
    const now = Date.now();

    setState((prev) =>
      prev.titles[titleId]
        ? {
            ...prev,
            titles: {
              ...prev.titles,
              [titleId]: { ...prev.titles[titleId], manualState, updatedAt: now, lastActivityAt: now },
            },
          }
        : prev,
    );

    try {
      applyServerMutation(await patchTitleApi(titleId, { manualState, updatedAt: now, lastActivityAt: now }));
    } catch {
      setState((curr) =>
        curr.titles[titleId]
          ? {
              ...curr,
              titles: {
                ...curr.titles,
                [titleId]: {
                  ...curr.titles[titleId],
                  manualState: prevTitle.manualState,
                  updatedAt: prevTitle.updatedAt,
                  lastActivityAt: prevTitle.lastActivityAt,
                },
              },
            }
          : curr,
      );
      showToast(getActiveCatalog().app.writeRollbackToast, 'danger');
      await triggerRefetch();
    }
  }

  return {
    addTitleFromTmdb,
    createCustomOrLinkTitle,
    updateTitleDetails,
    updateTitleLanguage,
    setTitleManualState,
  };
}
