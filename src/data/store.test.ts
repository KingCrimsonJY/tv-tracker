import { describe, expect, it } from 'vitest';
import type { AppStateSnapshot } from '../domain/types.ts';
import { applyMutationResult, applyStateSnapshot, createInitialAppState } from './store.ts';

describe('store state versioning', () => {
  it('does not overwrite newer state with an older /api/state snapshot', () => {
    const initial = createInitialAppState();

    // Advance state to version 5 via SSE mutation
    const newerState = applyMutationResult(initial, {
      version: 5,
      upserts: {
        settings: {
          ...initial.settings,
          includeSpecials: true,
        },
      },
      deletes: {},
    });
    expect(newerState.version).toBe(5);
    expect(newerState.settings.includeSpecials).toBe(true);

    // An older /api/state snapshot (version 3) arrives late
    const staleSnapshot: AppStateSnapshot = {
      ...initial,
      version: 3,
      settings: {
        ...initial.settings,
        includeSpecials: false,
      },
    };

    const resultAfterStale = applyStateSnapshot(newerState, staleSnapshot);
    expect(resultAfterStale.version).toBe(5);
    expect(resultAfterStale.settings.includeSpecials).toBe(true);

    // A newer /api/state snapshot (version 6) replaces state
    const freshSnapshot: AppStateSnapshot = {
      ...initial,
      version: 6,
      settings: {
        ...initial.settings,
        defaultTitleLang: 'en',
      },
    };

    const resultAfterFresh = applyStateSnapshot(resultAfterStale, freshSnapshot);
    expect(resultAfterFresh.version).toBe(6);
    expect(resultAfterFresh.settings.defaultTitleLang).toBe('en');
  });
});
