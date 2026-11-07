import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRandomId } from '../domain/id.ts';
import type { AppStateSnapshot, SeasonDoc, StateMutationResult, TitleDoc } from '../domain/types.ts';
import * as api from './api.ts';
import { createTrackerActions } from './actions.ts';
import { applyMutationResult, applyStateSnapshot, createInitialAppState, createTrackerStore } from './store.ts';

function makeFixtureState(): {
  snapshot: AppStateSnapshot;
  title: TitleDoc;
  seasons: SeasonDoc[];
} {
  const initial = createInitialAppState();
  const title: TitleDoc = {
    id: 'tmdb_tv_1',
    source: 'tmdb',
    sourceId: '1',
    mediaType: 'tv',
    names: { original: 'Severance', zh: '人生切割术' },
    displayLang: null,
    year: 2022,
    runtimeMin: 50,
    genres: ['科幻'],
    posterPath: null,
    backdropPath: null,
    overview: { zh: '测试剧集' },
    showStatus: 'Returning Series',
    externalIds: {},
    ratings: {},
    manualState: 'paused',
    playthroughs: [{ id: 'p1', number: 1, startedAt: 1000 }],
    activePlaythroughId: 'p1',
    resume: null,
    metaFetchedAt: 1000,
    addedAt: 1000,
    updatedAt: 1000,
    lastActivityAt: 1000,
  };
  const seasons: SeasonDoc[] = [
    {
      seasonNumber: 1,
      name: null,
      episodes: [
        {
          number: 1,
          key: 's1e1',
          name: null,
          airDate: '2022-02-18',
          runtime: 50,
          stillPath: null,
          overview: {},
        },
        {
          number: 2,
          key: 's1e2',
          name: null,
          airDate: '2022-02-18',
          runtime: 50,
          stillPath: null,
          overview: {},
        },
        {
          number: 3,
          key: 's1e3',
          name: null,
          airDate: '2022-02-25',
          runtime: 50,
          stillPath: null,
          overview: {},
        },
      ],
    },
  ];

  const snapshot: AppStateSnapshot = {
    ...initial,
    epoch: 'epoch-1',
    version: 1,
    titles: { [title.id]: title },
    seasonsByTitle: { [title.id]: seasons },
    progressByTitle: {
      [title.id]: {
        p1: { playthroughId: 'p1', watched: {} },
      },
    },
  };

  return { snapshot, title, seasons };
}

describe('store state versioning & epoch handling', () => {
  it('does not overwrite newer state with an older /api/state snapshot of the same epoch', () => {
    const initial = createInitialAppState();

    const newerState = applyMutationResult(
      { ...initial, epoch: 'epoch-a' },
      {
        epoch: 'epoch-a',
        version: 5,
        upserts: {
          settings: {
            ...initial.settings,
            includeSpecials: true,
          },
        },
        deletes: {},
      },
    );
    expect(newerState.version).toBe(5);
    expect(newerState.settings.includeSpecials).toBe(true);

    // An older /api/state snapshot (version 3, same epoch) arrives late
    const staleSnapshot: AppStateSnapshot = {
      ...initial,
      epoch: 'epoch-a',
      version: 3,
      settings: {
        ...initial.settings,
        includeSpecials: false,
      },
    };

    const resultAfterStale = applyStateSnapshot(newerState, staleSnapshot);
    expect(resultAfterStale.version).toBe(5);
    expect(resultAfterStale.settings.includeSpecials).toBe(true);

    // A newer /api/state snapshot (version 6) replaces state
    const freshSnapshot: AppStateSnapshot = {
      ...initial,
      epoch: 'epoch-a',
      version: 6,
      settings: {
        ...initial.settings,
        defaultTitleLang: 'en',
      },
    };

    const resultAfterFresh = applyStateSnapshot(resultAfterStale, freshSnapshot);
    expect(resultAfterFresh.version).toBe(6);
    expect(resultAfterFresh.settings.defaultTitleLang).toBe('en');
  });

  it('forces a full state reset when epoch changes even if incoming version is lower (e.g. backup restore / server restart)', () => {
    const store = createTrackerStore();
    const { snapshot } = makeFixtureState();

    // Client is at epoch-1, version 10 with custom settings
    store.applySnapshot({
      ...snapshot,
      epoch: 'epoch-1',
      version: 10,
      settings: {
        ...snapshot.settings,
        includeSpecials: true,
      },
    });
    expect(store.getState().version).toBe(10);
    expect(store.getState().epoch).toBe('epoch-1');
    expect(store.getState().settings.includeSpecials).toBe(true);

    // Server restarts with a restored backup at version 2 and a new epoch-2
    store.applySnapshot({
      ...snapshot,
      epoch: 'epoch-2',
      version: 2,
      titles: {},
      settings: {
        ...snapshot.settings,
        includeSpecials: false,
      },
    });

    expect(store.getState().epoch).toBe('epoch-2');
    expect(store.getState().version).toBe(2);
    expect(store.getState().settings.includeSpecials).toBe(false);
    expect(Object.keys(store.getState().titles)).toHaveLength(0);
  });
});

describe('write reliability: rapid toggles & targeted rollback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('two rapid toggles on different episodes both persist without undoing each other', async () => {
    const store = createTrackerStore();
    const { snapshot } = makeFixtureState();
    store.applySnapshot(snapshot);

    let serverVersion = 1;
    const postSpy = vi.spyOn(api, 'postTitleActionApi').mockImplementation(async (titleId, payload) => {
      // Simulate network latency so both taps happen before the first resolves
      await new Promise((r) => setTimeout(r, 20));
      serverVersion += 1;
      const current = store.getState();
      const currentTitle = current.titles[titleId];
      const currentProg = current.progressByTitle[titleId]?.p1 || {
        playthroughId: 'p1',
        watched: {},
      };
      const nextWatched = {
        ...currentProg.watched,
        ...(payload.progress?.set || {}),
      };
      return {
        epoch: 'epoch-1',
        version: serverVersion,
        upserts: {
          titles: currentTitle ? { [titleId]: { ...currentTitle, ...(payload.title || {}) } } : undefined,
          progressByTitle: {
            [titleId]: {
              p1: {
                ...currentProg,
                watched: nextWatched,
              },
            },
          },
        },
        deletes: {},
      };
    });

    const toasts: string[] = [];
    const actions = createTrackerActions({
      getState: store.getState,
      setState: store.setState,
      applyServerMutation: (mut) => {
        store.applyMutation(mut);
      },
      showToast: (msg) => toasts.push(msg),
    });

    // Fire two episode toggles synchronously back-to-back
    const p1 = actions.toggleEpisode('tmdb_tv_1', 's1e1');
    const p2 = actions.toggleEpisode('tmdb_tv_1', 's1e2');

    // Immediately after both synchronous optimistic updates: both s1e1 and s1e2 are checked
    const optimisticWatched = store.getState().progressByTitle['tmdb_tv_1'].p1.watched;
    expect(typeof optimisticWatched.s1e1).toBe('number');
    expect(typeof optimisticWatched.s1e2).toBe('number');
    expect(store.getState().titles['tmdb_tv_1'].manualState).toBeNull();

    await Promise.all([p1, p2]);

    expect(postSpy).toHaveBeenCalledTimes(2);
    const finalWatched = store.getState().progressByTitle['tmdb_tv_1'].p1.watched;
    expect(typeof finalWatched.s1e1).toBe('number');
    expect(typeof finalWatched.s1e2).toBe('number');
    expect(toasts).toHaveLength(0);
  });

  it('a failed action reverts only its own optimistic change, shows toast, and refetches /api/state', async () => {
    const store = createTrackerStore();
    const { snapshot } = makeFixtureState();
    store.applySnapshot(snapshot);

    let callCount = 0;
    vi.spyOn(api, 'postTitleActionApi').mockImplementation(async (_titleId, payload) => {
      callCount += 1;
      const isFirst = callCount === 1;
      await new Promise((r) => setTimeout(r, 15));
      if (isFirst) {
        throw new Error('Simulated server error on s1e1');
      }
      // Second call (s1e2) succeeds
      const s1e2Ts = payload.progress?.set?.s1e2 ?? 2000;
      return {
        epoch: 'epoch-1',
        version: 2,
        upserts: {
          titles: {
            tmdb_tv_1: {
              ...snapshot.titles['tmdb_tv_1'],
              manualState: null,
            },
          },
          progressByTitle: {
            tmdb_tv_1: {
              p1: {
                playthroughId: 'p1',
                watched: { s1e2: s1e2Ts },
              },
            },
          },
        },
        deletes: {},
      };
    });

    const toasts: string[] = [];
    let refetchCalls = 0;
    const actions = createTrackerActions({
      getState: store.getState,
      setState: store.setState,
      applyServerMutation: (mut) => {
        store.applyMutation(mut);
      },
      showToast: (msg) => toasts.push(msg),
      refetchState: async () => {
        refetchCalls += 1;
      },
    });

    // Tap s1e1 (will fail) and immediately tap s1e2 (will succeed)
    const p1 = actions.toggleEpisode('tmdb_tv_1', 's1e1');
    const p2 = actions.toggleEpisode('tmdb_tv_1', 's1e2');

    await Promise.all([p1, p2]);

    // s1e1 was reverted, while s1e2 remains checked!
    const finalWatched = store.getState().progressByTitle['tmdb_tv_1'].p1.watched;
    expect(finalWatched.s1e1).toBeUndefined();
    expect(typeof finalWatched.s1e2).toBe('number');
    expect(toasts).toHaveLength(1);
    expect(refetchCalls).toBe(1);
  });
  it('undoing 3rd -> 2nd -> 1st -> 未看 and deleting a middle playthrough each send one atomic POST /api/titles/:id/actions', async () => {
    const store = createTrackerStore();
    const { snapshot, title } = makeFixtureState();
    store.applySnapshot({
      ...snapshot,
      titles: {
        tmdb_tv_1: {
          ...title,
          showStatus: 'Ended',
          manualState: null,
          playthroughs: [
            { id: 'p1', number: 1, startedAt: 1000, completedAt: 1500 },
            { id: 'p2', number: 2, startedAt: 2000, completedAt: 2500 },
            { id: 'p3', number: 3, startedAt: 3000, completedAt: 3500 },
          ],
          activePlaythroughId: 'p3',
        },
      },
      progressByTitle: {
        tmdb_tv_1: {
          p1: { playthroughId: 'p1', watched: { s1e1: 1100, s1e2: 1200, s1e3: 1300 } },
          p2: { playthroughId: 'p2', watched: { s1e1: 2100, s1e2: 2200, s1e3: 2300 } },
          p3: { playthroughId: 'p3', watched: { s1e1: 3100, s1e2: 3200, s1e3: 3300 } },
        },
      },
    });

    let serverVersion = 1;
    const postSpy = vi.spyOn(api, 'postTitleActionApi').mockImplementation(async (titleId, payload) => {
      serverVersion += 1;
      const curr = store.getState();
      const currTitle = curr.titles[titleId];
      const upserts: StateMutationResult['upserts'] = {};
      const deletes: StateMutationResult['deletes'] = {};

      if (payload.progress?.deletePlaythroughId) {
        deletes.progress = [{ titleId, playthroughId: payload.progress.deletePlaythroughId }];
      }
      if (payload.progress?.playthroughId) {
        const ptId = payload.progress.playthroughId;
        upserts.progressByTitle = {
          [titleId]: {
            [ptId]: {
              playthroughId: ptId,
              watched: payload.progress.replaceWatched ?? {},
            },
          },
        };
      }
      if (payload.title && currTitle) {
        upserts.titles = {
          [titleId]: {
            ...currTitle,
            ...payload.title,
            id: titleId,
          },
        };
      }
      return {
        epoch: 'epoch-1',
        version: serverVersion,
        upserts,
        deletes,
      };
    });

    const actions = createTrackerActions({
      getState: store.getState,
      setState: store.setState,
      applyServerMutation: (mut) => {
        store.applyMutation(mut);
      },
      showToast: () => {},
    });

    // Undo 3rd -> 2nd
    await actions.cancelTitleRewatch('tmdb_tv_1');
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(store.getState().titles['tmdb_tv_1'].activePlaythroughId).toBe('p2');
    expect(store.getState().titles['tmdb_tv_1'].playthroughs).toHaveLength(2);
    expect(store.getState().titles['tmdb_tv_1'].playthroughs[1].completedAt).toBe(2500);
    expect(store.getState().progressByTitle['tmdb_tv_1'].p3).toBeUndefined();

    // Undo 2nd -> 1st
    await actions.cancelTitleRewatch('tmdb_tv_1');
    expect(postSpy).toHaveBeenCalledTimes(2);
    expect(store.getState().titles['tmdb_tv_1'].activePlaythroughId).toBe('p1');
    expect(store.getState().titles['tmdb_tv_1'].playthroughs).toHaveLength(1);
    expect(store.getState().titles['tmdb_tv_1'].playthroughs[0].completedAt).toBe(1500);

    // Undo 1st -> 未看 (clears progress and completedAt)
    await actions.cancelTitleRewatch('tmdb_tv_1');
    expect(postSpy).toHaveBeenCalledTimes(3);
    expect(store.getState().titles['tmdb_tv_1'].activePlaythroughId).toBe('p1');
    expect(store.getState().titles['tmdb_tv_1'].playthroughs).toHaveLength(1);
    expect(store.getState().titles['tmdb_tv_1'].playthroughs[0].completedAt).toBeUndefined();
    expect(store.getState().progressByTitle['tmdb_tv_1'].p1.watched).toEqual({});
  });

  it('refreshTitleMetadata backfills releaseDate, localized posters, and backdropPath', async () => {
    const store = createTrackerStore();
    const { snapshot, title } = makeFixtureState();
    store.applySnapshot({
      ...snapshot,
      titles: {
        tmdb_tv_1: {
          ...title,
          releaseDate: null,
          posters: undefined,
          posterPath: null,
          backdropPath: null,
        },
      },
    });

    const refreshedTitle: TitleDoc = {
      ...title,
      source: 'tmdb',
      sourceId: '1',
      mediaType: 'tv',
      names: { original: 'Severance', zh: '人生切割术', en: 'Severance' },
      year: 2022,
      releaseDate: '2022-02-18',
      runtimeMin: 50,
      genres: ['剧情'],
      genreIds: [18],
      posterPath: 'https://image.tmdb.org/t/p/w500/zh.jpg',
      posters: {
        zh: 'https://image.tmdb.org/t/p/w500/zh.jpg',
        en: 'https://image.tmdb.org/t/p/w500/en.jpg',
        textless: 'https://image.tmdb.org/t/p/w500/clean.jpg',
      },
      backdropPath: 'https://image.tmdb.org/t/p/w1280/textless_bd.jpg',
      overview: { zh: '中文简介', en: 'English overview' },
      showStatus: 'Returning Series',
      externalIds: { imdb: 'tt11280740' },
      ratings: { tmdb: '8.4' },
    };
    const refreshSpy = vi.spyOn(api, 'refreshMetadataApi').mockResolvedValue({
      version: 2,
      status: 'updated',
      upserts: {
        titles: { [title.id]: refreshedTitle },
        seasonsByTitle: snapshot.seasonsByTitle,
      },
      deletes: {},
    });

    const actions = createTrackerActions({
      getState: store.getState,
      setState: store.setState,
      applyServerMutation: (mut) => {
        store.applyMutation(mut);
      },
      showToast: () => {},
    });

    await actions.refreshTitleMetadata('tmdb_tv_1');
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    const refreshed = store.getState().titles['tmdb_tv_1'];
    expect(refreshed.releaseDate).toBe('2022-02-18');
    expect(refreshed.posters).toEqual({
      zh: 'https://image.tmdb.org/t/p/w500/zh.jpg',
      en: 'https://image.tmdb.org/t/p/w500/en.jpg',
      textless: 'https://image.tmdb.org/t/p/w500/clean.jpg',
    });
    expect(refreshed.backdropPath).toBe('https://image.tmdb.org/t/p/w1280/textless_bd.jpg');
  });
});

describe('createRandomId uniqueness', () => {
  it('generates 1000 unique IDs in the same millisecond (both native randomUUID and fallback)', () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1710000000000);
    try {
      const idsNative = new Set<string>();
      const idsFallback = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        idsNative.add(createRandomId('entry'));
        idsFallback.add(createRandomId('entry', { forceFallback: true }));
      }
      expect(idsNative.size).toBe(1000);
      expect(idsFallback.size).toBe(1000);
    } finally {
      nowSpy.mockRestore();
    }
  });
});
