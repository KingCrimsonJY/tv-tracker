import { afterEach, expect, test, vi } from 'vitest';
import * as api from '../api.ts';
import { createInitialAppState, createTrackerStore } from '../store.ts';
import { createTestActions } from '../testSupport.ts';
import { makeBaseTvTitle } from '../../domain/testFixtures.ts';
import type { LinkImportEpisodeSeed, SeasonDoc, StateMutationResult, TitleDoc } from '../../domain/types.ts';

afterEach(() => vi.restoreAllMocks());

const echo = (version: number): StateMutationResult => ({ version, epoch: 'e', upserts: {}, deletes: {} });

function storeWith(title: TitleDoc) {
  const state = createInitialAppState();
  state.titles[title.id] = title;
  return createTrackerStore({ ...state, version: 1, epoch: 'e' });
}

test('the localized name can be cleared, and an empty original name is never written', async () => {
  const title = makeBaseTvTitle({ names: { original: 'Severance', zh: '人生切割术', en: 'Severance' } });
  const store = storeWith(title);
  const patch = vi.spyOn(api, 'patchTitleApi').mockResolvedValue(echo(2));
  const { actions } = createTestActions(store);

  await actions.updateTitleDetails(title.id, { name: '  ' });
  expect(patch.mock.calls[0][1].names).toEqual({ original: 'Severance', en: 'Severance' });

  patch.mockClear();
  await actions.updateTitleDetails(title.id, { originalName: '   ' });
  expect(patch.mock.calls[0][1].names).toBeUndefined();
});

test('renaming a hand-made title keeps its mirrored English name in step, but not a real one', async () => {
  const mirrored = makeBaseTvTitle({ source: 'custom', names: { original: 'Old', zh: '旧', en: 'Old' } });
  const patch = vi.spyOn(api, 'patchTitleApi').mockResolvedValue(echo(2));
  await createTestActions(storeWith(mirrored)).actions.updateTitleDetails(mirrored.id, { originalName: ' New ' });
  expect(patch.mock.calls[0][1].names).toEqual({ original: 'New', zh: '旧', en: 'New' });

  patch.mockClear();
  const translated = makeBaseTvTitle({ names: { original: 'ぼっち', zh: '孤独摇滚', en: 'Bocchi the Rock!' } });
  await createTestActions(storeWith(translated)).actions.updateTitleDetails(translated.id, {
    originalName: 'ぼっち・ざ・ろっく！',
  });
  expect(patch.mock.calls[0][1].names).toEqual({
    original: 'ぼっち・ざ・ろっく！',
    zh: '孤独摇滚',
    en: 'Bocchi the Rock!',
  });
});

test('a parsed playlist keeps episode names and source ids when the episode count is changed', async () => {
  const seeds: LinkImportEpisodeSeed[] = Array.from({ length: 10 }, (_, index) => ({
    name: 'Part ' + (index + 1),
    sourceVideoId: 'BV' + (index + 1),
    runtime: 10,
    airDate: '2024-01-01',
  }));
  let stored: SeasonDoc[] = [];
  vi.spyOn(api, 'putTitleApi').mockImplementation(async (_id, payload) => {
    stored = payload.seasons ?? [];
    return echo(2);
  });
  const create = (episodeCount: number) =>
    createTestActions(
      createTrackerStore({ ...createInitialAppState(), version: 1, epoch: 'e' }),
    ).actions.createCustomOrLinkTitle({
      source: 'url',
      sourceUrl: 'https://space.bilibili.com/1/lists/2?type=season',
      name: 'Playlist',
      mediaType: 'other',
      episodeCount,
      episodes: seeds,
    });

  await create(5);
  expect(stored[0].episodes.map((episode) => [episode.name?.zh, episode.sourceVideoId])).toEqual(
    seeds.slice(0, 5).map((seed) => [seed.name, seed.sourceVideoId]),
  );

  await create(12);
  expect(stored[0].episodes).toHaveLength(12);
  expect(stored[0].episodes[9]).toMatchObject({ name: { zh: 'Part 10' }, sourceVideoId: 'BV10' });
  expect(stored[0].episodes[11]).toMatchObject({ number: 12, name: null });
  expect(stored[0].episodes[11].sourceVideoId).toBeUndefined();
});
