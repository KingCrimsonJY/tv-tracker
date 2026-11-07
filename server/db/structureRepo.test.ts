import { afterEach, expect, test, vi } from 'vitest';
import { TrackerRepository } from './repository.ts';
import { makeBaseTvTitle } from '../../src/domain/testFixtures.ts';
import type { SeasonDoc, TitleDoc } from '../../src/domain/types.ts';
import { refreshTmdbTitle } from '../metadataService.ts';
import { TmdbRequestError } from '../providers/tmdb.ts';
const repos: TrackerRepository[] = [];
afterEach(() => {
  for (const repo of repos.splice(0)) repo.close();
});
function season(number: number, ids: number[]): SeasonDoc {
  return {
    seasonNumber: number,
    name: null,
    episodes: ids.map((id, index) => ({
      number: index + 1,
      key: `s${number}e${index + 1}`,
      tmdbEpisodeId: id,
      name: { en: `Story ${id}` },
      airDate: `2024-01-${String(id).padStart(2, '0')}`,
      runtime: 20,
      stillPath: null,
      overview: {},
    })),
  };
}
function setup(seasons = [season(1, [1, 2])], patch: Partial<TitleDoc> = {}) {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  repos.push(repo);
  const title = makeBaseTvTitle(patch);
  repo.putTitle(title.id, {
    title,
    seasons,
    progress: {
      p1: {
        playthroughId: 'p1',
        watched: Object.fromEntries(seasons.flatMap((s) => s.episodes.map((ep) => [ep.key, 123]))),
      },
    },
  });
  const refresh = (incoming: SeasonDoc[], failedSeasons: number[] = []) =>
    repo.refreshMetadata(title.id, {
      title: { ...title, names: { original: 'Updated' } },
      seasons: incoming,
      failedSeasons,
    });
  const decide = (decision: 'adopt' | 'keep') => {
    const preview = repo.previewStructure(title.id);
    return repo.decideStructure(title.id, decision, preview.version, preview.signature);
  };
  return { repo, title, refresh, decide };
}

test('removed season remains local until adoption; returning episode restores archived watched marks', () => {
  const { repo, title, refresh, decide } = setup([season(1, [1]), season(2, [2])]);
  refresh([season(1, [1])]);
  expect(repo.getState().seasonsByTitle[title.id]).toHaveLength(2);
  expect(repo.previewStructure(title.id)).toMatchObject({
    archived: 1,
    changes: [{ from: { seasonNumber: 2, episodeNumber: 1 }, to: null }],
  });
  decide('adopt');
  expect(repo.getState().progressByTitle[title.id].p1).toMatchObject({
    watched: { s1e1: 123 },
    archivedWatched: [{ episode: { tmdbEpisodeId: 2 }, watchedAt: 123 }],
  });
  refresh([season(1, [1]), season(2, [2])]);
  expect(repo.getState().progressByTitle[title.id].p1).toMatchObject({
    watched: { s1e1: 123, s2e1: 123 },
    archivedWatched: [],
  });
});

test('split season is previewed and adopted by stable episode id without moving marks automatically', () => {
  const { repo, title, refresh, decide } = setup();
  refresh([season(1, [1]), season(2, [2])]);
  expect(repo.getState().progressByTitle[title.id].p1.watched).toEqual({ s1e1: 123, s1e2: 123 });
  expect(repo.previewStructure(title.id).changes).toContainEqual({
    from: { seasonNumber: 1, episodeNumber: 2, name: { en: 'Story 2' } },
    to: { seasonNumber: 2, episodeNumber: 1, name: { en: 'Story 2' } },
  });
  decide('adopt');
  expect(repo.getState().progressByTitle[title.id].p1.watched).toEqual({ s1e1: 123, s2e1: 123 });
});

test('legacy episodes use air date and order after id matching, including recreated upstream ids', () => {
  const local = season(1, [1, 2]);
  for (const ep of local.episodes) delete ep.tmdbEpisodeId;
  const { repo, title, refresh, decide } = setup([local]);
  refresh([season(2, [1, 2])]);
  decide('adopt');
  expect(repo.getState().progressByTitle[title.id].p1.watched).toEqual({ s2e1: 123, s2e2: 123 });
});

test('locked structure updates names and appends new episodes without a review banner', () => {
  const { repo, title, refresh } = setup([season(1, [1])], { structureLocked: true });
  const incoming = season(1, [1, 2]);
  incoming.episodes[0].name = { en: 'New name' };
  refresh([incoming]);
  expect(repo.getState().seasonsByTitle[title.id][0].episodes).toHaveLength(2);
  expect(repo.getState().seasonsByTitle[title.id][0].episodes[0].name).toEqual({ en: 'New name' });
  expect(repo.getTitle(title.id)?.upstreamChange).toBeNull();
  expect(repo.getTitle(title.id)?.names.original).toBe('Updated');
});

test('keep local suppresses the same proposal; stale previews cannot overwrite newer state', () => {
  const { repo, title, refresh, decide } = setup();
  refresh([season(1, [1])]);
  const stale = repo.previewStructure(title.id);
  repo.patchSettings({ theme: 'light' });
  expect(() => repo.decideStructure(title.id, 'adopt', stale.version, stale.signature)).toThrow('STRUCTURE_CONFLICT');
  decide('keep');
  refresh([season(1, [1])]);
  expect(repo.getTitle(title.id)?.upstreamChange).toBeNull();
  expect(repo.getState().seasonsByTitle[title.id][0].episodes).toHaveLength(2);
});

test('partial upstream failures preserve local structure and cannot create removal proposals', () => {
  const { repo, title, refresh } = setup();
  refresh([], [1]);
  expect(repo.getTitle(title.id)?.upstreamChange).toBeUndefined();
  expect(repo.getState().seasonsByTitle[title.id][0].episodes).toHaveLength(2);
  expect(repo.getState().progressByTitle[title.id].p1.watched).toEqual({ s1e1: 123, s1e2: 123 });
});

test('deleted source preserves everything, stops refresh, and can become manual', async () => {
  const { repo, title } = setup();
  const before = repo.getState();
  const fetchDetails = vi.fn().mockRejectedValue(new TmdbRequestError(404));
  expect((await refreshTmdbTitle(repo, title.id, { configured: true, fetchDetails })).status).toBe('failed');
  expect(repo.getTitle(title.id)?.sourceUnavailable).toBe(true);
  expect(repo.getState().seasonsByTitle).toEqual(before.seasonsByTitle);
  expect(repo.getState().progressByTitle).toEqual(before.progressByTitle);
  expect((await refreshTmdbTitle(repo, title.id, { configured: true, fetchDetails })).status).toBe('skipped');
  expect(fetchDetails).toHaveBeenCalledTimes(1);
  repo.convertToManual(title.id);
  expect(repo.getTitle(title.id)).toMatchObject({ source: 'custom', sourceId: null, sourceUnavailable: false });
  expect(repo.getState().progressByTitle).toEqual(before.progressByTitle);
});

test('temporary upstream errors are not classified as deleted entries', async () => {
  const { repo, title } = setup();
  await refreshTmdbTitle(repo, title.id, {
    configured: true,
    fetchDetails: vi.fn().mockRejectedValue(new TmdbRequestError(503)),
  });
  expect(repo.getTitle(title.id)?.sourceUnavailable).not.toBe(true);
});

test('re-linking preserves local data and proposes the new structure', () => {
  const { repo, title } = setup();
  repo.refreshMetadata(
    title.id,
    { title: { ...title, sourceId: '999' }, seasons: [season(2, [1, 2])] },
    Date.now(),
    true,
  );
  expect(repo.getTitle(title.id)).toMatchObject({ sourceId: '999', sourceUnavailable: false });
  expect(repo.getState().seasonsByTitle[title.id][0].seasonNumber).toBe(1);
  expect(repo.previewStructure(title.id).changes).toHaveLength(2);
});

test('v2 export/import preserves pending structure and archived history; v1 still imports', () => {
  const { repo, title, refresh, decide } = setup();
  refresh([season(1, [1])]);
  decide('adopt');
  const backup = repo.exportData();
  repo.importData(backup);
  expect(repo.exportData(backup.exportedAt)).toEqual(backup);
  expect(repo.getState().progressByTitle[title.id].p1.archivedWatched).toHaveLength(1);
  repo.importData({ ...backup, version: 1 });
  expect(repo.getTitle(title.id)).toBeTruthy();
});

test('missing upstream text, images and identifiers do not erase local metadata', () => {
  const local = season(1, [1]);
  local.episodes[0].stillPath = '/keep.jpg';
  const { repo, title, refresh } = setup([local], { externalIds: { imdb: 'tt123' } });
  const incoming = season(1, [1]);
  incoming.episodes[0].name = null;
  incoming.episodes[0].runtime = null;
  refresh([incoming]);
  expect(repo.getState().seasonsByTitle[title.id][0].episodes[0]).toMatchObject({
    name: { en: 'Story 1' },
    runtime: 20,
    stillPath: '/keep.jpg',
  });
  expect(repo.getTitle(title.id)?.externalIds.imdb).toBe('tt123');
});

test('automatic refresh preserves orphan marks and does not silently replace known episode identities', () => {
  const local = season(1, [1]);
  const { repo, title, refresh, decide } = setup([local]);
  repo.putProgress(title.id, 'p1', { watched: { s1e1: 123, s9e9: 456 } });
  const replacement = season(1, [99]);
  replacement.episodes[0].airDate = local.episodes[0].airDate;
  refresh([replacement]);
  expect(repo.getState().seasonsByTitle[title.id][0].episodes[0].tmdbEpisodeId).toBe(1);
  expect(repo.getState().progressByTitle[title.id].p1.watched).toEqual({ s1e1: 123, s9e9: 456 });
  expect(repo.previewStructure(title.id).changes).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        from: expect.objectContaining({ seasonNumber: 1, episodeNumber: 1 }),
        to: expect.objectContaining({ seasonNumber: 1, episodeNumber: 1 }),
      }),
    ]),
  );
  decide('adopt');
  expect(repo.getState().seasonsByTitle[title.id][0].episodes[0].tmdbEpisodeId).toBe(99);
  expect(repo.getState().progressByTitle[title.id].p1).toMatchObject({
    watched: { s1e1: 123 },
    archivedWatched: [{ watchedAt: 456 }],
  });
});

test('empty season removal is visible in the preview', () => {
  const { repo, title, refresh } = setup([season(1, [1]), season(2, [])]);
  refresh([season(1, [1])]);
  expect(repo.previewStructure(title.id).changes).toContainEqual({ from: { seasonNumber: 2, name: null }, to: null });
});

test('locked new identities append to the last local season in air-date order and deduplicate on refresh', () => {
  const { repo, title, refresh } = setup([season(1, [1]), season(2, [2])], { structureLocked: true });
  const incoming = [season(1, [1]), season(5, [4, 3, 2])];
  refresh(incoming);
  refresh(incoming);
  const stored = repo.getSeasons(title.id);
  expect(stored.map((s) => s.seasonNumber)).toEqual([1, 2]);
  expect(stored[1].episodes.map((ep) => [ep.key, ep.tmdbEpisodeId])).toEqual([
    ['s2e1', 2],
    ['s2e2', 3],
    ['s2e3', 4],
  ]);
  expect(repo.getState().progressByTitle[title.id].p1.watched).toEqual({ s1e1: 123, s2e1: 123 });
});
test('pending structures live outside title docs and survive a complete v2 export/import', () => {
  const { repo, title, refresh } = setup();
  refresh([season(2, [1, 2])]);
  expect(repo.getTitle(title.id)?.upstreamChange?.seasons).toBeUndefined();
  const backup = repo.exportData();
  expect(backup.titles[title.id].upstreamChange?.seasons).toHaveLength(1);
  repo.importData(backup);
  expect(repo.getTitle(title.id)?.upstreamChange?.seasons).toBeUndefined();
  expect(repo.previewStructure(title.id).sourceSeasons).toBe(1);
});
