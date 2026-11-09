import { expect, test } from 'vitest';
import { TrackerRepository } from './repository.ts';
import { makeBaseTvTitle } from '../../src/domain/testFixtures.ts';

test('concurrent rewatch attempts conflict without overwriting the first or orphaning progress', () => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  try {
    const title = makeBaseTvTitle();
    repo.putTitle(title.id, { title });
    const request = (id: string) => ({
      expectedActivePlaythroughId: 'p1',
      title: {
        activePlaythroughId: id,
        playthroughs: [...title.playthroughs, { id, number: 2, startedAt: Date.now() }],
      },
      progress: { playthroughId: id, replaceWatched: {} },
    });
    repo.applyTitleAtomicAction(title.id, request('device-a'));
    const before = repo.getState();
    expect(() => repo.applyTitleAtomicAction(title.id, request('device-b'))).toThrow('REWATCH_CONFLICT');
    expect(repo.getState()).toEqual(before);
    expect(repo.getTitle(title.id)?.activePlaythroughId).toBe('device-a');
    expect(repo.getState().progressByTitle[title.id]['device-b']).toBeUndefined();
  } finally {
    repo.close();
  }
});

function startSecondPlaythrough(repo: TrackerRepository, titleId: string, base = makeBaseTvTitle()) {
  repo.applyTitleAtomicAction(titleId, {
    expectedActivePlaythroughId: 'p1',
    title: {
      activePlaythroughId: 'p2',
      playthroughs: [...base.playthroughs, { id: 'p2', number: 2, startedAt: 1_800_000_000_000 }],
    },
    progress: { playthroughId: 'p2', replaceWatched: {} },
  });
}

test('a stale "clear history" cannot drop a rewatch started on another device', () => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  try {
    const title = makeBaseTvTitle();
    repo.putTitle(title.id, { title, progress: { p1: { playthroughId: 'p1', watched: { s1e1: 1 } } } });
    startSecondPlaythrough(repo, title.id);
    const before = repo.getState();
    // The stale device still believes p1 is the only playthrough.
    expect(() =>
      repo.applyTitleAtomicAction(title.id, {
        expectedActivePlaythroughId: 'p1',
        progress: { playthroughId: 'p1', replaceWatched: {}, movieWatchedAt: null },
        title: { playthroughs: [{ id: 'p1', number: 1, startedAt: title.playthroughs[0].startedAt }] },
      }),
    ).toThrow('REWATCH_CONFLICT');
    // Older clients omitted the expected playthrough; they must not overwrite it either.
    expect(() =>
      repo.applyTitleAtomicAction(title.id, {
        progress: { playthroughId: 'p1', replaceWatched: {} },
        title: { playthroughs: [{ id: 'p1', number: 1, startedAt: 0 }], activePlaythroughId: 'p1' },
      }),
    ).toThrow('REWATCH_CONFLICT');
    expect(repo.getState()).toEqual(before);
  } finally {
    repo.close();
  }
});

test('stale episode marks are rejected instead of landing on an inactive playthrough', () => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  try {
    const title = makeBaseTvTitle();
    repo.putTitle(title.id, { title });
    startSecondPlaythrough(repo, title.id);
    expect(() =>
      repo.applyTitleAtomicAction(title.id, {
        expectedActivePlaythroughId: 'p1',
        progress: { playthroughId: 'p1', set: { s1e2: 5 } },
        title: { updatedAt: 5, lastActivityAt: 5 },
      }),
    ).toThrow('REWATCH_CONFLICT');
    expect(() =>
      repo.applyTitleAtomicAction(title.id, {
        progress: { playthroughId: 'p1', set: { s1e2: 5 } },
        title: { updatedAt: 5, lastActivityAt: 5 },
      }),
    ).toThrow('REWATCH_CONFLICT');
    expect(repo.getState().progressByTitle[title.id].p1?.watched.s1e2).toBeUndefined();
  } finally {
    repo.close();
  }
});

test('playthroughs can only be removed together with their progress', () => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  try {
    const title = makeBaseTvTitle();
    repo.putTitle(title.id, { title });
    startSecondPlaythrough(repo, title.id);
    const remaining = { title: { playthroughs: title.playthroughs, activePlaythroughId: 'p1' } };
    expect(() => repo.applyTitleAtomicAction(title.id, { expectedActivePlaythroughId: 'p2', ...remaining })).toThrow(
      'REWATCH_CONFLICT',
    );
    repo.applyTitleAtomicAction(title.id, {
      expectedActivePlaythroughId: 'p2',
      progress: { deletePlaythroughId: 'p2' },
      ...remaining,
    });
    const state = repo.getState();
    expect(state.titles[title.id].activePlaythroughId).toBe('p1');
    expect(state.progressByTitle[title.id]?.p2).toBeUndefined();
  } finally {
    repo.close();
  }
});
