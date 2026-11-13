import { describe, expect, test } from 'vitest';
import { planBatchListEntries, planBatchStatus } from './batch.ts';
import { makeBaseTvTitle, makeSampleSeasons, TODAY } from './testFixtures.ts';

const options = { includeSpecials: false, todayStr: TODAY, now: 5000 };

describe('planBatchStatus', () => {
  test('watched marks every aired episode, keeps earlier timestamps and clears a paused mark', () => {
    const title = makeBaseTvTitle({ showStatus: 'Ended', manualState: 'paused' });
    const change = planBatchStatus(
      title,
      makeSampleSeasons(),
      { playthroughId: 'p1', watched: { s1e1: 100 } },
      'watched',
      options,
    );
    expect(change?.title).toMatchObject({ manualState: null, updatedAt: 5000, lastActivityAt: 5000 });
    expect(change?.progress?.watched.s1e1).toBe(100);
    expect(change?.progress?.watched.s1e2).toBe(5000);
    expect(change?.progress?.watched.s0e1).toBeUndefined();
  });

  test('a title that is already in the requested state is left alone', () => {
    const title = makeBaseTvTitle({ showStatus: 'Ended' });
    const seasons = makeSampleSeasons();
    const done = planBatchStatus(title, seasons, undefined, 'watched', options);
    expect(done).not.toBeNull();
    expect(planBatchStatus(done?.title ?? title, seasons, done?.progress, 'watched', options)).toBeNull();
    expect(planBatchStatus(title, seasons, undefined, 'unwatched', options)).toBeNull();
    expect(planBatchStatus(title, seasons, undefined, 'active', options)).toBeNull();
    expect(planBatchStatus({ ...title, manualState: 'dropped' }, seasons, undefined, 'dropped', options)).toBeNull();
  });

  test('titles that have not been released cannot be marked watched but can be paused', () => {
    const movie = makeBaseTvTitle({ mediaType: 'movie', releaseDate: '2999-01-01' });
    expect(planBatchStatus(movie, [], undefined, 'watched', options)).toBeNull();
    expect(planBatchStatus(movie, [], undefined, 'paused', options)?.title.manualState).toBe('paused');
    expect(planBatchStatus(movie, [], undefined, 'paused', options)?.progress).toBeUndefined();
  });
});

describe('planBatchListEntries', () => {
  test('appends after the last rank in the given order, skipping members and duplicates', () => {
    let next = 0;
    const existing = [
      { id: 'e2', titleId: 'b', rank: 'a5', addedAt: 1 },
      { id: 'e1', titleId: 'a', rank: 'a1', addedAt: 1 },
    ];
    const added = planBatchListEntries(existing, ['d', 'a', 'c', 'd'], 9, () => 'new' + next++);
    expect(added.map((entry) => [entry.id, entry.titleId, entry.addedAt])).toEqual([
      ['new0', 'd', 9],
      ['new1', 'c', 9],
    ]);
    expect(added[0].rank > 'a5' && added[1].rank > added[0].rank).toBe(true);
    expect(planBatchListEntries(existing, ['a', 'b'], 9, () => 'x')).toEqual([]);
  });
});
