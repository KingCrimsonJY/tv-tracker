import { afterEach, expect, test, vi } from 'vitest';
import * as api from '../api.ts';
import { createTrackerActions } from '../actions.ts';
import { createTrackerStore } from '../store.ts';
import { makeBaseTvTitle } from '../../domain/testFixtures.ts';
afterEach(() => vi.restoreAllMocks());
test('Refresh All counts updated, partial, failed and skipped separately', async () => {
  const store = createTrackerStore();
  store.setState((s) => ({
    ...s,
    titles: Object.fromEntries(
      ['ok', 'partial', 'missing-token', 'manual'].map((id) => [
        id,
        makeBaseTvTitle({ id, source: id === 'manual' ? 'custom' : 'tmdb' }),
      ]),
    ),
  }));
  vi.spyOn(api, 'refreshMetadataApi').mockImplementation(async (id) => {
    if (id === 'missing-token') throw new Error('TMDB_NOT_CONFIGURED');
    return { version: 1, upserts: {}, deletes: {}, status: id === 'partial' ? 'partial' : 'updated' };
  });
  const actions = createTrackerActions({
    getState: store.getState,
    setState: store.setState,
    applyServerMutation: store.applyMutation,
    showToast: vi.fn(),
  });
  expect(await actions.refreshAllTmdbMetadata()).toEqual({ updated: 1, partial: 1, failed: 1, skipped: 1 });
  expect(api.refreshMetadataApi).toHaveBeenCalledTimes(3);
});
