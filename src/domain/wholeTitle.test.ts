import { describe, expect, test } from 'vitest';
import { computeProgressDiff } from '../data/actions/types.ts';
import { canMarkWholeTitleWatched, markWholeTitleWatched } from './actions.ts';
import { planBatchStatus } from './batch.ts';
import { applyProgressMutation } from './progressMutation.ts';
import { makeBaseTvTitle, makeSampleSeasons, TODAY } from './testFixtures.ts';
import type { ProgressDoc, SeasonDoc } from './types.ts';

const options = { includeSpecials: false, todayStr: TODAY, now: 5000 };
const film = (releaseDate: string, overrides = {}) =>
  makeBaseTvTitle({ id: 'tmdb_movie_1', mediaType: 'movie', releaseDate, ...overrides });
const unairedSeasons = (): SeasonDoc[] =>
  makeSampleSeasons().map((season) => ({
    ...season,
    episodes: season.episodes.map((episode) => ({ ...episode, airDate: '2099-01-01' })),
  }));

describe('marking a whole title watched', () => {
  test('a film watched years ago keeps its date and is not touched by a batch', () => {
    const watchedIn2020 = 1_577_836_800_000;
    const title = film('2019-05-01', {
      playthroughs: [{ id: 'p1', number: 1, startedAt: 1, completedAt: watchedIn2020 }],
    });
    const progress: ProgressDoc = { playthroughId: 'p1', watched: {}, movieWatchedAt: watchedIn2020 };
    expect(markWholeTitleWatched(title, [], progress, true, options).progress.movieWatchedAt).toBe(watchedIn2020);
    expect(planBatchStatus(title, [], progress, 'watched', options)).toBeNull();
  });

  test('an unreleased film cannot be marked watched, from its menu or in a batch, paused or not', () => {
    const progress: ProgressDoc = { playthroughId: 'p1', watched: {} };
    for (const manualState of [null, 'paused', 'dropped'] as const) {
      const title = film('2099-12-31', { manualState });
      expect(canMarkWholeTitleWatched(title, [], options)).toBe(false);
      const result = markWholeTitleWatched(title, [], progress, true, options);
      expect(result.progress.movieWatchedAt).toBeUndefined();
      expect(result.manualState).toBe(manualState);
      expect(planBatchStatus(title, [], progress, 'watched', options)).toBeNull();
    }
  });

  test('a released film that was paused is marked watched and resumed', () => {
    const title = film('2020-01-01', { manualState: 'paused' });
    expect(canMarkWholeTitleWatched(title, [], options)).toBe(true);
    const change = planBatchStatus(title, [], { playthroughId: 'p1', watched: {} }, 'watched', options);
    expect(change?.title.manualState).toBeNull();
    expect(change?.progress?.movieWatchedAt).toBe(5000);
  });

  test('a paused series with no aired episode stays paused and unmarked', () => {
    const title = makeBaseTvTitle({ manualState: 'paused' });
    expect(canMarkWholeTitleWatched(title, unairedSeasons(), options)).toBe(false);
    expect(planBatchStatus(title, unairedSeasons(), undefined, 'watched', options)).toBeNull();
    expect(canMarkWholeTitleWatched(title, makeSampleSeasons(), options)).toBe(true);
  });
});

describe('clearing a viewing', () => {
  const removed = { ...makeSampleSeasons()[1].episodes[0], key: 's1e9', number: 9 };
  const before: ProgressDoc = {
    playthroughId: 'p1',
    watched: { s1e1: 1 },
    archivedWatched: [{ episode: removed, watchedAt: 9 }],
  };

  test('unmarking everything drops the marks kept for removed episodes, and says so to the server', () => {
    const after = markWholeTitleWatched(makeBaseTvTitle(), makeSampleSeasons(), before, false, options).progress;
    expect(after).toEqual({ playthroughId: 'p1', watched: {} });
    expect(computeProgressDiff(before, after)).toEqual({ replaceWatched: {}, hasChanges: true });
  });

  test('a batch clears a title whose only marks are archived ones', () => {
    const onlyArchived: ProgressDoc = { ...before, watched: {} };
    const change = planBatchStatus(makeBaseTvTitle(), makeSampleSeasons(), onlyArchived, 'unwatched', options);
    expect(change?.progress).toEqual({ playthroughId: 'p1', watched: {} });
    expect(planBatchStatus(makeBaseTvTitle(), makeSampleSeasons(), change?.progress, 'unwatched', options)).toBeNull();
  });

  test('replacing the marks forgets archived ones; an ordinary tick keeps them', () => {
    expect(applyProgressMutation(before, 'p1', { replaceWatched: {} })).toEqual({ playthroughId: 'p1', watched: {} });
    expect(applyProgressMutation(before, 'p1', { set: { s1e2: 2 } }).archivedWatched).toEqual(before.archivedWatched);
  });
});
