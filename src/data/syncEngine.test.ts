import { expect, test, vi } from 'vitest';
import { createSyncEngine } from './syncEngine';
import { createTrackerStore } from './store';
test('contiguous SSE and duplicate POST responses update locally without fetching state', () => {
  const store = createTrackerStore();
  const reconcile = vi.fn(async () => {});
  const sync = createSyncEngine({ initial: store.getState(), publish: store.setState, reconcile });
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
  const sync = createSyncEngine({
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
  const sync = createSyncEngine({ initial: { ...store.getState(), version: 3 }, publish: store.setState, reconcile });
  sync.mutation({ checkpoint: true, version: 4, upserts: {}, deletes: {} });
  expect(reconcile).toHaveBeenCalledTimes(1);
  sync.snapshot({ ...store.getState(), version: 5 });
  sync.mutation({ checkpoint: true, version: 4, upserts: {}, deletes: {} });
  expect(reconcile).toHaveBeenCalledTimes(1);
});

const settingsMutation = (version: number, includeSpecials: boolean, store = createTrackerStore()) => ({
  version,
  upserts: { settings: { ...store.getState().settings, includeSpecials } },
  deletes: {},
});
const setTheme =
  (theme: 'light' | 'dark'): import('./syncEngine').Overlay =>
  (state) => ({ ...state, settings: { ...state.settings, theme } });

test('a pending edit survives events from other devices and is replaced by the server reply', async () => {
  const store = createTrackerStore();
  const engine = createSyncEngine({ initial: store.getState(), publish: store.setState, reconcile: vi.fn() });
  let reply: (mutation: ReturnType<typeof settingsMutation>) => void = () => {};
  const pending = engine.optimistic(
    setTheme('light'),
    () => new Promise<ReturnType<typeof settingsMutation>>((resolve) => (reply = resolve)),
  );
  expect(store.getState().settings.theme).toBe('light');

  // Another device changes something else while our request is in flight: our edit must not flash back.
  engine.mutation(settingsMutation(1, true));
  expect(store.getState().settings).toMatchObject({ theme: 'light', includeSpecials: true });

  reply({ version: 2, upserts: { settings: { ...store.getState().settings, theme: 'light' } }, deletes: {} });
  await pending;
  expect(store.getState()).toMatchObject({ version: 2, settings: { theme: 'light', includeSpecials: true } });
});

test('a failed write is undone by dropping its edit, keeps later edits, and asks for a fresh snapshot', async () => {
  const store = createTrackerStore();
  const reconcile = vi.fn(async () => {});
  const engine = createSyncEngine({ initial: store.getState(), publish: store.setState, reconcile });
  let fail: (error: Error) => void = () => {};
  const failing = engine.optimistic(setTheme('light'), () => new Promise<never>((_resolve, reject) => (fail = reject)));
  const later = engine.optimistic(
    (state) => ({ ...state, settings: { ...state.settings, includeSpecials: true } }),
    async () => settingsMutation(1, true),
  );
  await later;
  expect(store.getState().settings).toMatchObject({ theme: 'light', includeSpecials: true });

  fail(new Error('offline'));
  await expect(failing).rejects.toThrow('offline');
  expect(store.getState().settings.theme).not.toBe('light');
  expect(store.getState().settings.includeSpecials).toBe(true);
  expect(reconcile).toHaveBeenCalledTimes(1);
});

test('a reply that skips a version keeps the edit visible until the snapshot arrives', async () => {
  const store = createTrackerStore();
  const views: string[] = [];
  store.subscribe(() => views.push(store.getState().settings.theme));
  const engine = createSyncEngine({
    initial: store.getState(),
    publish: store.setState,
    reconcile: async () => {
      engine.snapshot({ ...store.getState(), version: 5, settings: { ...store.getState().settings, theme: 'light' } });
    },
  });
  await engine.optimistic(setTheme('light'), async () => ({ version: 5, upserts: {}, deletes: {} }));
  expect(store.getState()).toMatchObject({ version: 5, settings: { theme: 'light' } });
  expect(views.every((theme) => theme === 'light')).toBe(true);
});

test('reset forgets confirmed state and pending edits', () => {
  const store = createTrackerStore();
  const engine = createSyncEngine({ initial: store.getState(), publish: store.setState, reconcile: vi.fn() });
  engine.mutation(settingsMutation(1, true));
  void engine.optimistic(setTheme('light'), () => new Promise<never>(() => {}));
  engine.reset(createTrackerStore().getState());
  expect(store.getState()).toMatchObject({ version: 0, settings: { includeSpecials: false } });
  engine.mutation(settingsMutation(1, false));
  expect(store.getState().settings.theme).not.toBe('light');
});
