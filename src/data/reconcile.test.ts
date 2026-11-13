import { expect, test, vi } from 'vitest';
import { createReconciler } from './reconcile.ts';
import { createTrackerStore } from './store.ts';
import { makeBaseTvTitle } from '../domain/testFixtures.ts';
import { TrackerRepository } from '../../server/db/repository.ts';

test('older SSE change after a newer write response converges through an authoritative read', async () => {
  const store = createTrackerStore();
  const title = makeBaseTvTitle();
  store.applyMutation({
    version: 2,
    upserts: { settings: { ...store.getState().settings, theme: 'light' } },
    deletes: {},
  });
  const read = createReconciler(async () => {
    store.applySnapshot({ ...store.getState(), titles: { [title.id]: title }, version: 2 });
  });
  store.applyMutation({ version: 1, upserts: { titles: { [title.id]: title } }, deletes: {} });
  await read();
  expect(store.getState().titles[title.id]).toEqual(title);
  expect(store.getState().settings.theme).toBe('light');
});

test('an event during an in-flight read schedules another read without parallel requests', async () => {
  let release: (() => void) | undefined;
  const read = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValue(undefined);
  const reconcile = createReconciler(read);
  const first = reconcile();
  const second = reconcile();
  expect(read).toHaveBeenCalledTimes(1);
  release?.();
  await Promise.all([first, second]);
  expect(read).toHaveBeenCalledTimes(2);
});

test('backup replacement removes stale seasons and playthroughs even when the title id remains', () => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  try {
    const title = makeBaseTvTitle();
    repo.putTitle(title.id, { title, progress: { orphan: { playthroughId: 'orphan', watched: { s1e1: 1 } } } });
    const client = createTrackerStore(repo.getState());
    const backup = repo.exportData();
    backup.progressByTitle = {};
    backup.seasonsByTitle = {};
    const mutation = repo.importData(backup);
    expect(mutation.replace).toBe(true);
    client.applyMutation(mutation);
    expect(client.getState()).toEqual(repo.getState());
    expect(client.getState().progressByTitle).toEqual({});
  } finally {
    repo.close();
  }
});

test('a failed read is repeated until one succeeds, without anything asking again', async () => {
  vi.useFakeTimers();
  try {
    const read = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const reconcile = createReconciler(read, () => 1000);

    // The version gap asks once; the read fails (for example a 503 from /api/state).
    await reconcile();
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(read).toHaveBeenCalledTimes(3);
    // It succeeded: nothing further is scheduled.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledTimes(3);
  } finally {
    vi.useRealTimers();
  }
});

test('a request during the wait reads at once and replaces the scheduled retry', async () => {
  vi.useFakeTimers();
  try {
    const read = vi.fn<() => Promise<boolean>>().mockResolvedValueOnce(false).mockResolvedValue(true);
    const reconcile = createReconciler(read, () => 1000);
    await reconcile();
    await reconcile();
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(read).toHaveBeenCalledTimes(2);
  } finally {
    vi.useRealTimers();
  }
});
