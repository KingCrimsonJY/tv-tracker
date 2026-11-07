import { expect, test, vi } from 'vitest';
import { createMutationSync } from './mutationSync';
import { createTrackerStore } from './store';
test('contiguous SSE and duplicate POST responses update locally without fetching state', () => {
  const store = createTrackerStore();
  const reconcile = vi.fn(async () => {});
  const sync = createMutationSync({ initial: store.getState(), publish: store.setState, reconcile });
  const mutation = {
    version: 1,
    upserts: { settings: { ...store.getState().settings, includeSpecials: true } },
    deletes: {},
  };
  sync.mutation(mutation);
  sync.mutation(mutation);
  expect(store.getState().settings.includeSpecials).toBe(true);
  expect(reconcile).not.toHaveBeenCalled();
});
test('a version gap, epoch change and explicit replacement trigger reconciliation', () => {
  const store = createTrackerStore();
  const reconcile = vi.fn(async () => {});
  const sync = createMutationSync({
    initial: { ...store.getState(), epoch: 'a', version: 2 },
    publish: store.setState,
    reconcile,
  });
  for (const extra of [{ version: 4 }, { version: 1, epoch: 'b' }, { version: 3, replace: true }]) {
    sync.mutation({ upserts: {}, deletes: {}, ...extra });
  }
  expect(reconcile).toHaveBeenCalledTimes(3);
});

test('the SSE handshake detects even one missed event between the snapshot and connection', () => {
  const store = createTrackerStore();
  const reconcile = vi.fn(async () => {});
  const sync = createMutationSync({ initial: { ...store.getState(), version: 3 }, publish: store.setState, reconcile });
  sync.mutation({ checkpoint: true, version: 4, upserts: {}, deletes: {} });
  expect(reconcile).toHaveBeenCalledTimes(1);
  sync.snapshot({ ...store.getState(), version: 5 });
  sync.mutation({ checkpoint: true, version: 4, upserts: {}, deletes: {} });
  expect(reconcile).toHaveBeenCalledTimes(1);
});
