import { afterEach, beforeEach, expect, test } from 'vitest';
import { patchListEntryRequestSchema } from '../../src/domain/schemas.ts';
import { makeBaseTvTitle } from '../../src/domain/testFixtures.ts';
import { TrackerRepository } from './repository.ts';

let repo: TrackerRepository;
const entry = (titleId: string, rank: string) => ({ titleId, rank, addedAt: 1 });
const titleIdsIn = (listId: string) => repo.getState().entriesByList[listId].map((item) => item.titleId);

beforeEach(() => {
  repo = new TrackerRepository({ dbPath: ':memory:' });
  for (const id of ['tmdb_tv_1', 'tmdb_tv_2']) repo.putTitle(id, { title: makeBaseTvTitle({ id }) });
  repo.putList('watchlist', {
    name: 'Watchlist',
    kind: 'collection',
    pinned: false,
    rank: 'a0',
    collectionSort: 'manual',
    createdAt: 1,
  });
});
afterEach(() => repo.close());

test('two devices adding the same title to a list leave one entry, and both get the same list back', () => {
  // Neither has seen the other's change, so each sends an entry with an id of its own.
  const first = repo.putListEntry('watchlist', 'entry-device-a', entry('tmdb_tv_1', 'a0'));
  const second = repo.putListEntry('watchlist', 'entry-device-b', entry('tmdb_tv_1', 'a0'));

  expect(repo.getState().entriesByList.watchlist.map((item) => item.id)).toEqual(['entry-device-a']);
  expect(second.upserts.entriesByList?.watchlist).toEqual(first.upserts.entriesByList?.watchlist);
  expect(second.version).toBe(first.version + 1);
});

test('other titles are still added, a batch and a single add do not double up, and an entry can be rewritten', () => {
  repo.putListEntry('watchlist', 'entry-1', entry('tmdb_tv_1', 'a0'));
  repo.putListEntry('watchlist', 'entry-2', entry('tmdb_tv_2', 'a1'));
  expect(titleIdsIn('watchlist')).toEqual(['tmdb_tv_1', 'tmdb_tv_2']);

  repo.applyTitleBatch(['tmdb_tv_1', 'tmdb_tv_2'], { type: 'addToList', listId: 'watchlist', now: 2 });
  repo.putListEntry('watchlist', 'entry-3', entry('tmdb_tv_2', 'a2'));
  expect(titleIdsIn('watchlist')).toEqual(['tmdb_tv_1', 'tmdb_tv_2']);

  // Writing the same entry again (same id) is an update, not a duplicate.
  repo.putListEntry('watchlist', 'entry-1', { ...entry('tmdb_tv_1', 'a5'), note: 'again' });
  expect(repo.getState().entriesByList.watchlist.find((item) => item.id === 'entry-1')).toMatchObject({ rank: 'a5' });
  expect(titleIdsIn('watchlist').sort()).toEqual(['tmdb_tv_1', 'tmdb_tv_2']);
});

test('an entry cannot be pointed at another title, which would list that title twice', () => {
  expect(() => patchListEntryRequestSchema.parse({ titleId: 'tmdb_tv_1' })).toThrow();
  expect(patchListEntryRequestSchema.parse({ rank: 'a3', note: 'next' })).toEqual({ rank: 'a3', note: 'next' });

  // Writing an existing entry with the title of another one changes nothing either.
  repo.putListEntry('watchlist', 'entry-1', entry('tmdb_tv_1', 'a0'));
  repo.putListEntry('watchlist', 'entry-2', entry('tmdb_tv_2', 'a1'));
  repo.putListEntry('watchlist', 'entry-2', entry('tmdb_tv_1', 'a1'));
  expect(titleIdsIn('watchlist')).toEqual(['tmdb_tv_1', 'tmdb_tv_2']);
});
