import { expect, test } from 'vitest';
import { createTrackerStore } from './store';
import { makeBaseTvTitle } from '../domain/testFixtures';
test('snapshots and one-title mutations preserve all unchanged object references', () => {
  const store = createTrackerStore();
  const title = makeBaseTvTitle();
  store.setState((s) => ({ ...s, titles: { [title.id]: title, other: { ...title, id: 'other' } } }));
  const before = store.getState();
  store.applySnapshot(structuredClone(before));
  expect(store.getState()).toBe(before);
  store.applyMutation({
    version: 1,
    upserts: { titles: { [title.id]: { ...title, manualState: 'paused' } } },
    deletes: {},
  });
  expect(store.getState().titles.other).toBe(before.titles.other);
  expect(store.getState().settings).toBe(before.settings);
  expect(store.getState().seasonsByTitle).toBe(before.seasonsByTitle);
});
