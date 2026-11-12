import { afterEach, expect, test, vi } from 'vitest';
import * as api from '../api.ts';
import { createInitialAppState, createTrackerStore } from '../store.ts';
import { createTestActions } from '../testSupport.ts';
import { makeBaseTvTitle, makeSampleSeasons } from '../../domain/testFixtures.ts';
import type { AppStateSnapshot, StateMutationResult } from '../../domain/types.ts';

afterEach(() => vi.restoreAllMocks());

function library(count: number): AppStateSnapshot {
  const state = createInitialAppState();
  for (let index = 0; index < count; index++) {
    const id = 'title-' + index;
    state.titles[id] = makeBaseTvTitle({ id, showStatus: 'Ended' });
    state.seasonsByTitle[id] = makeSampleSeasons();
  }
  state.lists.list = {
    id: 'list',
    name: 'List',
    kind: 'collection',
    pinned: false,
    rank: 'a0',
    collectionSort: 'added',
    createdAt: 1,
  };
  state.entriesByList.list = [{ id: 'e0', titleId: 'title-0', rank: 'a0', addedAt: 1 }];
  return { ...state, version: 1, epoch: 'e' };
}

/** Resolve or reject the single request a batch sends, after inspecting the optimistic state. */
function interceptBatch() {
  let settle: { resolve: (mutation: StateMutationResult) => void; reject: (error: Error) => void } | undefined;
  const spy = vi
    .spyOn(api, 'batchTitlesApi')
    .mockImplementation(() => new Promise<StateMutationResult>((resolve, reject) => (settle = { resolve, reject })));
  return {
    spy,
    resolve: (mutation: StateMutationResult) => settle?.resolve(mutation),
    reject: (error: Error) => settle?.reject(error),
  };
}

test('a status batch updates every title at once with one request, and one failure undoes all of it', async () => {
  const store = createTrackerStore(library(60));
  const toasts: string[] = [];
  const { actions } = createTestActions(store, { showToast: (message) => toasts.push(message) });
  const ids = Object.keys(store.getState().titles);
  const batch = interceptBatch();
  let renders = 0;
  store.subscribe(() => renders++);

  const pending = actions.batchSetStatus(ids, 'watched');

  expect(renders).toBe(1);
  expect(batch.spy).toHaveBeenCalledTimes(1);
  const [sentIds, action] = batch.spy.mock.calls[0];
  expect(sentIds).toHaveLength(60);
  expect(action).toMatchObject({ type: 'status', status: 'watched' });
  const optimistic = store.getState();
  expect(ids.every((id) => Object.keys(optimistic.progressByTitle[id].p1.watched).length > 0)).toBe(true);
  expect(ids.every((id) => optimistic.titles[id].playthroughs[0].completedAt !== undefined)).toBe(true);

  batch.reject(new Error('offline'));
  expect(await pending).toEqual({ changed: 60, stored: false });
  expect(store.getState().progressByTitle).toEqual({});
  expect(store.getState().titles['title-0'].playthroughs[0].completedAt).toBeUndefined();
  expect(toasts).toHaveLength(1);
});

test('titles already in the requested state are neither sent nor counted', async () => {
  const state = library(3);
  state.titles['title-1'] = { ...state.titles['title-1'], manualState: 'paused' };
  const store = createTrackerStore(state);
  const { actions } = createTestActions(store);
  const batch = interceptBatch();

  const pending = actions.batchSetStatus(['title-0', 'title-1', 'title-2', 'missing'], 'paused');
  expect(batch.spy.mock.calls[0][0]).toEqual(['title-0', 'title-2']);
  batch.resolve({ version: 2, epoch: 'e', upserts: {}, deletes: {} });
  expect(await pending).toEqual({ changed: 2, stored: true });

  batch.spy.mockClear();
  store.setState((current) => ({
    ...current,
    titles: Object.fromEntries(
      Object.entries(current.titles).map(([id, title]) => [id, { ...title, manualState: 'paused' as const }]),
    ),
  }));
  expect(await actions.batchSetStatus(['title-0', 'title-1'], 'paused')).toEqual({ changed: 0, stored: true });
  expect(batch.spy).not.toHaveBeenCalled();
});

test('adding to a list shows placeholder entries that the server entries replace', async () => {
  const store = createTrackerStore(library(4));
  const { actions } = createTestActions(store);
  const batch = interceptBatch();

  const pending = actions.batchAddToList(['title-2', 'title-0', 'title-1'], 'list');
  expect(batch.spy.mock.calls[0]).toEqual([
    ['title-2', 'title-1'],
    expect.objectContaining({ type: 'addToList', listId: 'list' }),
  ]);
  expect(store.getState().entriesByList.list.map((entry) => entry.titleId)).toEqual(['title-0', 'title-2', 'title-1']);

  const serverEntries = [
    { id: 'e0', titleId: 'title-0', rank: 'a0', addedAt: 1 },
    { id: 'server-1', titleId: 'title-2', rank: 'a1', addedAt: 2 },
    { id: 'server-2', titleId: 'title-1', rank: 'a2', addedAt: 2 },
  ];
  batch.resolve({ version: 2, epoch: 'e', upserts: { entriesByList: { list: serverEntries } }, deletes: {} });
  expect(await pending).toEqual({ changed: 2, stored: true });
  expect(store.getState().entriesByList.list).toEqual(serverEntries);
  expect(await actions.batchAddToList(['title-0'], 'list')).toEqual({ changed: 0, stored: true });
});

test('deleting removes titles with their list entries and restores them when the request fails', async () => {
  const store = createTrackerStore(library(3));
  const { actions } = createTestActions(store);
  const batch = interceptBatch();

  const pending = actions.batchRemoveTitles(['title-0', 'title-1']);
  expect(Object.keys(store.getState().titles)).toEqual(['title-2']);
  expect(store.getState().entriesByList.list).toEqual([]);

  batch.reject(new Error('offline'));
  expect(await pending).toEqual({ changed: 2, stored: false });
  expect(Object.keys(store.getState().titles)).toHaveLength(3);
  expect(store.getState().entriesByList.list).toHaveLength(1);
});
