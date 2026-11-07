import { expect, test } from 'vitest';
import { TrackerRepository } from './repository.ts';
import { makeBaseTvTitle } from '../../src/domain/testFixtures.ts';

test('concurrent rewatch attempts conflict without overwriting the first or orphaning progress', () => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  try {
    const title = makeBaseTvTitle(); repo.putTitle(title.id, { title });
    const request = (id: string) => ({ expectedActivePlaythroughId: 'p1', title: {
      activePlaythroughId: id, playthroughs: [...title.playthroughs, { id, number: 2, startedAt: Date.now() }],
    }, progress: { playthroughId: id, replaceWatched: {} } });
    repo.applyTitleAtomicAction(title.id, request('device-a'));
    const before = repo.getState();
    expect(() => repo.applyTitleAtomicAction(title.id, request('device-b'))).toThrow('REWATCH_CONFLICT');
    expect(repo.getState()).toEqual(before);
    expect(repo.getTitle(title.id)?.activePlaythroughId).toBe('device-a');
    expect(repo.getState().progressByTitle[title.id]['device-b']).toBeUndefined();
  } finally { repo.close(); }
});
