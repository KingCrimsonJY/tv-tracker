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
import { fetchTitleDetailsApi, fetchTmdbDetailsApi, patchTitleApi, putSeasonsApi, putTitleApi } from '../api.ts';
import { composeOverlays, patchTitle } from '../overlays.ts';
import type { Overlay } from '../syncEngine.ts';
import type { Commit } from './commit.ts';
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

/** A title that exists only on this device until the server stores it. */
function addNewTitle(title: TitleDoc, seasons: SeasonDoc[], progress: ProgressDoc): Overlay {
  return (state) =>
    state.titles[title.id]
      ? state
      : {
          ...state,
          titles: { ...state.titles, [title.id]: title },
          seasonsByTitle: { ...state.seasonsByTitle, [title.id]: seasons },
          progressByTitle: { ...state.progressByTitle, [title.id]: { [progress.playthroughId]: progress } },
        };
}

export function createTitleActions(
  { getState, optimistic, applyServerMutation }: TrackerActionDeps,
  { commit }: Commit,
  addTitleToList: (listId: string, titleId: string) => Promise<void>,
) {
  /** Adding fails loudly: the caller shows the reason next to the search result or form. */
  async function storeNewTitle(title: TitleDoc, seasons: SeasonDoc[], targetListId?: string): Promise<void> {
    const progress: ProgressDoc = { playthroughId: title.activePlaythroughId, watched: {} };
    await optimistic(addNewTitle(title, seasons, progress), () =>
      putTitleApi(title.id, { title, seasons, progress: { [progress.playthroughId]: progress } }),
    );
    if (targetListId && getState().lists[targetListId]) await addTitleToList(targetListId, title.id);
  }

  async function addTitleFromTmdb(
    mediaType: 'movie' | 'tv',
    sourceId: string,
    targetListId?: string,
  ): Promise<TitleDoc> {
    const existing = getState().titles[`tmdb_${mediaType}_${sourceId}`];
    if (existing) {
      if (targetListId && getState().lists[targetListId]) await addTitleToList(targetListId, existing.id);
      return existing;
    }
    const data = await fetchTmdbDetailsApi(mediaType, sourceId);
    await storeNewTitle(data.title, data.seasons || [], targetListId);
    return data.title;
  }

  async function createCustomOrLinkTitle(input: CustomTitleInput): Promise<TitleDoc> {
    const now = Date.now();
    const name = input.name.trim() || 'Untitled';
    const originalName = input.originalName?.trim() || name;
    const seedEpisodes = input.episodes?.length ? input.episodes : undefined;
    const episodeCount =
      input.episodeCount && input.episodeCount > 0
        ? Math.min(2000, Math.floor(input.episodeCount))
        : Math.min(2000, seedEpisodes?.length ?? 0);
    const poster = (input.posterPath ?? input.posterUrl)?.trim().slice(0, 1000) || null;
    const uploader = input.uploader?.trim().slice(0, 200) || null;

    const title: TitleDoc = {
      id: createRandomId(input.source),
      source: input.source,
      sourceId: (input.sourceUrl ?? input.sourceId)?.trim().slice(0, 2048) || null,
      mediaType: input.mediaType,
      names: { original: originalName, zh: name, en: originalName },
      displayLang: null,
      year: input.year || null,
      runtimeMin: input.runtimeMin || null,
      genres: [],
      posterPath: poster,
      backdropPath: poster,
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
    const isMovie = input.mediaType === 'movie';
    const seasons = buildCustomSeasons(
      isMovie ? 0 : episodeCount,
      input.runtimeMin || null,
      [],
      isMovie ? undefined : seedEpisodes,
    );
    await storeNewTitle(title, seasons, input.targetListId);
    return title;
  }

  async function updateTitleDetails(titleId: string, input: UpdateTitleDetailsInput): Promise<void> {
    const prevTitle = getState().titles[titleId];
    if (!prevTitle) return;
    const now = Date.now();

    // The localized name is optional and can be cleared; the original name is required, so an empty one is
    // ignored (the dialog does not let it through). A title created by hand starts with its English name
    // mirroring the original; keep that mirror, or the edit would be invisible in the English interface.
    const names = { ...prevTitle.names };
    if (input.name !== undefined) {
      const localized = input.name.trim();
      if (localized) names.zh = localized;
      else delete names.zh;
    }
    const original = input.originalName?.trim();
    if (original) {
      if (names.en === names.original) names.en = original;
      names.original = original;
    }
    const poster =
      input.posterPath !== undefined ? input.posterPath?.trim().slice(0, 500) || null : prevTitle.posterPath;
    const next: TitleDoc = {
      ...prevTitle,
      mediaType: input.mediaType ?? prevTitle.mediaType,
      names,
      year: input.year !== undefined ? input.year : prevTitle.year,
      runtimeMin: input.runtimeMin !== undefined ? input.runtimeMin : prevTitle.runtimeMin,
      posterPath: poster,
      backdropPath: prevTitle.source !== 'tmdb' ? poster || prevTitle.backdropPath : prevTitle.backdropPath,
      overview: {
        ...prevTitle.overview,
        ...(input.overview !== undefined ? { [input.overviewLang ?? 'zh']: input.overview.trim() } : {}),
      },
      ...(input.uploader !== undefined ? { uploader: input.uploader?.trim() || null } : {}),
    };

    // Only the fields that changed are sent, so an edit never overwrites what another device changed meanwhile.
    const patch: Partial<Omit<TitleDoc, 'id'>> = { updatedAt: now, lastActivityAt: now };
    const editable = ['mediaType', 'names', 'year', 'runtimeMin', 'posterPath', 'backdropPath', 'overview', 'uploader'];
    for (const key of editable as Array<keyof Omit<TitleDoc, 'id'>>) {
      if (JSON.stringify(next[key]) !== JSON.stringify(prevTitle[key])) Object.assign(patch, { [key]: next[key] });
    }

    let seasons: SeasonDoc[] | undefined;
    if (prevTitle.source !== 'tmdb' && input.episodeCount !== undefined) {
      const count = input.episodeCount && input.episodeCount > 0 ? Math.min(2000, Math.floor(input.episodeCount)) : 0;
      seasons = buildCustomSeasons(count, next.runtimeMin || null, (await fetchTitleDetailsApi(titleId)).seasons);
    }
    const nextSeasons = seasons;

    await commit(
      composeOverlays(patchTitle(titleId, patch), (state) =>
        nextSeasons && state.titles[titleId]
          ? { ...state, seasonsByTitle: { ...state.seasonsByTitle, [titleId]: nextSeasons } }
          : state,
      ),
      async () => {
        const patched = await patchTitleApi(titleId, patch);
        if (!nextSeasons) return patched;
        applyServerMutation(patched);
        return putSeasonsApi(titleId, nextSeasons);
      },
    );
  }

  async function updateTitleLanguage(
    titleId: string,
    displayLang: DisplayLang | null,
    customName?: string,
  ): Promise<void> {
    const prevTitle = getState().titles[titleId];
    if (!prevTitle) return;
    const names = { ...prevTitle.names };
    const custom = customName?.trim();
    if (custom) names.custom = custom;
    else if (customName !== undefined) delete names.custom;
    const patch: Partial<Omit<TitleDoc, 'id'>> = {
      displayLang,
      updatedAt: Date.now(),
      ...(JSON.stringify(names) !== JSON.stringify(prevTitle.names) ? { names } : {}),
    };
    await commit(patchTitle(titleId, patch), () => patchTitleApi(titleId, patch));
  }

  async function setTitleManualState(titleId: string, manualState: ManualState): Promise<void> {
    if (!getState().titles[titleId]) return;
    const now = Date.now();
    const patch = { manualState, updatedAt: now, lastActivityAt: now };
    await commit(patchTitle(titleId, patch), () => patchTitleApi(titleId, patch));
  }

  return {
    addTitleFromTmdb,
    createCustomOrLinkTitle,
    updateTitleDetails,
    updateTitleLanguage,
    setTitleManualState,
  };
}
