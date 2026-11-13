import { expect, test } from 'vitest';
import { makeBaseTvTitle, makeSampleSeasons } from '../../src/domain/testFixtures.ts';
import { TrackerRepository } from './repository.ts';

const playthroughs = [
  { id: 'p1', number: 1, startedAt: 1, completedAt: 2 },
  { id: 'p2', number: 2, startedAt: 3, completedAt: 4 },
  { id: 'p3', number: 3, startedAt: 5 },
];

test('two devices deleting different past viewings cannot bring a deleted one back without its progress', () => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  try {
    const title = { ...makeBaseTvTitle(), playthroughs, activePlaythroughId: 'p3' };
    repo.putTitle(title.id, {
      title,
      seasons: makeSampleSeasons(),
      progress: Object.fromEntries(playthroughs.map((p) => [p.id, { playthroughId: p.id, watched: { s1e1: 1 } }])),
    });
    // Both devices build their request from the same [p1, p2, p3].
    const remove = (id: string) =>
      repo.applyTitleAtomicAction(title.id, {
        expectedActivePlaythroughId: 'p3',
        title: { playthroughs: playthroughs.filter((p) => p.id !== id) },
        progress: { deletePlaythroughId: id },
      });
    remove('p1');
    expect(() => remove('p2')).toThrow('REWATCH_CONFLICT');
    expect(repo.getTitle(title.id)?.playthroughs.map((p) => p.id)).toEqual(['p2', 'p3']);
    expect(Object.keys(repo.getState().progressByTitle[title.id]).sort()).toEqual(['p2', 'p3']);
  } finally {
    repo.close();
  }
});

test('clearing the only viewing also forgets the marks kept for episodes the source removed', () => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  try {
    const title = makeBaseTvTitle();
    const seasons = makeSampleSeasons();
    const removed = { ...seasons[1].episodes[0], key: 's1e9', number: 9 };
    const archivedWatched = [{ episode: removed, watchedAt: 9 }];
    repo.putTitle(title.id, {
      title,
      seasons,
      progress: { p1: { playthroughId: 'p1', watched: { s1e1: 1 }, archivedWatched } },
    });
    const stored = () => repo.getState().progressByTitle[title.id].p1;

    repo.applyTitleAtomicAction(title.id, { progress: { playthroughId: 'p1', set: { s1e2: 2 } } });
    expect(stored().archivedWatched).toEqual(archivedWatched);

    repo.applyTitleAtomicAction(title.id, {
      expectedActivePlaythroughId: 'p1',
      progress: { playthroughId: 'p1', replaceWatched: {}, movieWatchedAt: null },
    });
    expect(stored()).toEqual({ playthroughId: 'p1', watched: {} });
  } finally {
    repo.close();
  }
});

test('undoing a rewatch cannot fall back to a viewing another device has deleted', () => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  try {
    const title = { ...makeBaseTvTitle(), playthroughs, activePlaythroughId: 'p3' };
    repo.putTitle(title.id, {
      title,
      seasons: makeSampleSeasons(),
      progress: Object.fromEntries(playthroughs.map((p) => [p.id, { playthroughId: p.id, watched: { s1e1: 1 } }])),
    });
    // Device A deletes p2.
    repo.applyTitleAtomicAction(title.id, {
      expectedActivePlaythroughId: 'p3',
      title: { playthroughs: playthroughs.filter((p) => p.id !== 'p2') },
      progress: { deletePlaythroughId: 'p2' },
    });
    const before = repo.getState();
    // Device B, still seeing [p1, p2, p3], undoes the rewatch p3: p2 would become active again, empty.
    expect(() =>
      repo.applyTitleAtomicAction(title.id, {
        expectedActivePlaythroughId: 'p3',
        title: { playthroughs: playthroughs.filter((p) => p.id !== 'p3'), activePlaythroughId: 'p2' },
        progress: { deletePlaythroughId: 'p3' },
      }),
    ).toThrow('REWATCH_CONFLICT');
    expect(repo.getState()).toEqual(before);

    // The same undo from the current list still works.
    repo.applyTitleAtomicAction(title.id, {
      expectedActivePlaythroughId: 'p3',
      title: { playthroughs: [playthroughs[0]], activePlaythroughId: 'p1' },
      progress: { deletePlaythroughId: 'p3' },
    });
    expect(repo.getTitle(title.id)).toMatchObject({ activePlaythroughId: 'p1', playthroughs: [{ id: 'p1' }] });
  } finally {
    repo.close();
  }
});
