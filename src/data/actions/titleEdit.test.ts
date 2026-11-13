import { expect, test, vi } from 'vitest';
import { pickPoster } from '../../domain/airing.ts';
import { makeBaseTvTitle } from '../../domain/testFixtures.ts';
import type { AppStateSnapshot, StateMutationResult } from '../../domain/types.ts';
import { patchTitleApi } from '../api.ts';
import { createInitialAppState } from '../store.ts';
import type { Overlay } from '../syncEngine.ts';
import { createCommit } from './commit.ts';
import { createTitleActions } from './titles.ts';

vi.mock('../api.ts', () => ({
  patchTitleApi: vi.fn(async () => ({ version: 2, upserts: {}, deletes: {} })),
  fetchTitleDetailsApi: vi.fn(),
  fetchTmdbDetailsApi: vi.fn(),
  putSeasonsApi: vi.fn(),
  putTitleApi: vi.fn(),
}));

test('a poster the user sets on a TMDB title is the one shown, in either language', async () => {
  const title = makeBaseTvTitle({ posters: { zh: '/original-zh.jpg', en: '/original-en.jpg' } });
  let state: AppStateSnapshot = { ...createInitialAppState(), titles: { [title.id]: title } };
  const deps = {
    getState: () => state,
    optimistic: async <T extends StateMutationResult>(overlay: Overlay, request: () => Promise<T>) => {
      state = overlay(state);
      return request();
    },
    applyServerMutation: () => {},
    showToast: () => {},
  };
  const actions = createTitleActions(deps, createCommit(deps), async () => {});
  const custom = 'https://img.example/my-poster.jpg';

  await actions.updateTitleDetails(title.id, { posterPath: custom });

  expect(pickPoster(state.titles[title.id], 'zh-CN')).toBe(custom);
  expect(pickPoster(state.titles[title.id], 'en')).toBe(custom);
  expect(vi.mocked(patchTitleApi).mock.calls[0][1]).toMatchObject({ posterPath: custom, posters: {} });

  // An edit that leaves the poster alone leaves the localized posters alone too.
  state = { ...state, titles: { [title.id]: title } };
  await actions.updateTitleDetails(title.id, { name: 'Renamed' });
  expect(vi.mocked(patchTitleApi).mock.calls[1][1]).not.toHaveProperty('posters');
});
