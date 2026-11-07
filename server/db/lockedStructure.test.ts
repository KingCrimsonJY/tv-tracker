import { afterEach, expect, test } from 'vitest';
import { flattenEpisodes, planStructure } from '../../src/domain/structure.ts';
import { makeBaseTvTitle } from '../../src/domain/testFixtures.ts';
import type { EpisodeMeta, SeasonDoc } from '../../src/domain/types.ts';
import { TrackerRepository } from './repository.ts';

const repos: TrackerRepository[] = [];
afterEach(() => {
  for (const repo of repos.splice(0)) repo.close();
});

function episode(number: number): EpisodeMeta {
  return {
    key: 's1e' + number,
    number,
    tmdbEpisodeId: number,
    name: { en: 'Story ' + number },
    airDate: new Date(Date.UTC(2024, 0, number)).toISOString().slice(0, 10),
    runtime: 20,
    stillPath: null,
    overview: {},
  };
}

function season(episodes: EpisodeMeta[], seasonNumber = 1): SeasonDoc {
  return {
    seasonNumber,
    name: null,
    episodes: episodes.map((ep, index) => ({ ...ep, number: index + 1, key: 's' + seasonNumber + 'e' + (index + 1) })),
  };
}

function setup(local = [season(Array.from({ length: 150 }, (_, index) => episode(index + 1)))]) {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  repos.push(repo);
  const title = makeBaseTvTitle({ structureLocked: true });
  const watched = Object.fromEntries(flattenEpisodes(local).map((ep, index) => [ep.key, 1000 + index]));
  repo.putTitle(title.id, { title, seasons: local, progress: { p1: { playthroughId: 'p1', watched } } });
  return {
    repo,
    title,
    local,
    watched,
    refresh: (incoming: SeasonDoc[]) => repo.refreshMetadata(title.id, { title, seasons: incoming }, 123456),
    assertWatched: () =>
      expect(repo.getState().progressByTitle[title.id].p1).toEqual({
        playthroughId: 'p1',
        watched,
        archivedWatched: [],
      }),
  };
}

test.each([
  { name: '80 recreated episodes', sizes: [80], recreated: 80, total: 150 },
  { name: '80 recreated episodes split into 50 and 30', sizes: [50, 30], recreated: 80, total: 150 },
  { name: '150 recreated episodes and two new episodes', sizes: [152], recreated: 150, total: 152 },
  { name: '150 stable IDs and two new episodes', sizes: [152], recreated: 0, total: 152 },
])('locked refresh preserves local episodes and watched marks: $name', ({ sizes, recreated, total }) => {
  const { repo, title, local, refresh, assertWatched } = setup();
  let offset = 0;
  const incoming = sizes.map((size, index) => {
    const episodes = Array.from({ length: size }, (_, position) => {
      const number = offset + position + 1;
      return {
        ...episode(number),
        tmdbEpisodeId: number <= recreated ? 10000 + number : number,
        name: { en: 'Updated story ' + number },
        overview: { en: 'Updated overview ' + number },
        runtime: 25,
        stillPath: '/updated-' + number + '.jpg',
      };
    });
    offset += size;
    return season(episodes, index + 1);
  });
  expect(planStructure(local, incoming, true).added).toHaveLength(total - 150);
  refresh(incoming);
  const stored = repo.getSeasons(title.id);
  expect(stored).toHaveLength(1);
  expect(stored[0].episodes).toHaveLength(total);
  const incomingEpisodes = flattenEpisodes(incoming);
  for (let index = 0; index < total; index++) {
    const expected = incomingEpisodes[index] ?? local[0].episodes[index];
    expect(stored[0].episodes[index]).toEqual({ ...expected, key: 's1e' + (index + 1), number: index + 1 });
  }
  expect(new Set(stored[0].episodes.map((ep) => ep.tmdbEpisodeId)).size).toBe(total);
  assertWatched();
  if (total === 152) expect(repo.getTitle(title.id)?.upstreamChange).toBeNull();
  const proposal = repo.exportData().titles[title.id].upstreamChange;
  expect(planStructure(stored, incoming, true).added).toHaveLength(0);
  refresh(incoming);
  expect(repo.getSeasons(title.id)).toEqual(stored);
  expect(repo.exportData().titles[title.id].upstreamChange).toEqual(proposal);
  assertWatched();
});

test('locked recreated episodes sharing an air date match in order without moving watched marks', () => {
  const local = season([episode(1), { ...episode(2), airDate: episode(1).airDate }]);
  const { repo, title, refresh, assertWatched } = setup([local]);
  const incoming = [
    season(
      local.episodes.map((ep) => ({ ...ep, tmdbEpisodeId: ep.number + 100, name: { en: 'Updated ' + ep.number } })),
      5,
    ),
  ];
  refresh(incoming);
  expect(repo.getSeasons(title.id)[0].episodes.map((ep) => [ep.key, ep.tmdbEpisodeId, ep.name])).toEqual([
    ['s1e1', 101, { en: 'Updated 1' }],
    ['s1e2', 102, { en: 'Updated 2' }],
  ]);
  expect(repo.getTitle(title.id)?.upstreamChange).toBeNull();
  assertWatched();
  const stored = repo.getSeasons(title.id);
  refresh(incoming);
  expect(repo.getSeasons(title.id)).toEqual(stored);
  assertWatched();
});

test('locked double release on the latest local date appends in source order exactly once', () => {
  const { repo, title, local, refresh, assertWatched } = setup();
  const latestDate = local[0].episodes[149].airDate;
  const incoming = [
    season([...local[0].episodes, { ...episode(152), airDate: latestDate }, { ...episode(151), airDate: latestDate }]),
  ];
  refresh(incoming);
  const stored = repo.getSeasons(title.id);
  expect(stored[0].episodes).toHaveLength(152);
  expect(stored[0].episodes.slice(150).map((ep) => [ep.key, ep.tmdbEpisodeId])).toEqual([
    ['s1e151', 152],
    ['s1e152', 151],
  ]);
  expect(repo.getTitle(title.id)?.upstreamChange).toBeNull();
  assertWatched();
  refresh(incoming);
  expect(repo.getSeasons(title.id)).toEqual(stored);
  assertWatched();
});

test.each([
  { name: 'undated', airDate: null },
  { name: 'older than the latest local episode', airDate: '2024-01-01' },
])('locked unmatched $name episode stays in review without blocking future appends', ({ airDate }) => {
  const { repo, title, local, refresh, assertWatched } = setup();
  const unknown = { ...episode(999), airDate };
  const incoming = [season([...local[0].episodes, unknown])];
  refresh(incoming);
  expect(repo.getSeasons(title.id)).toEqual(local);
  expect(repo.previewStructure(title.id).changes).toContainEqual({
    from: null,
    to: { seasonNumber: 1, episodeNumber: 151, name: unknown.name },
  });
  assertWatched();
  const proposal = repo.exportData().titles[title.id].upstreamChange;
  refresh(incoming);
  expect(repo.getSeasons(title.id)).toEqual(local);
  expect(repo.exportData().titles[title.id].upstreamChange).toEqual(proposal);
  assertWatched();

  const later = [season([...local[0].episodes, unknown, episode(152), episode(151)])];
  refresh(later);
  const stored = repo.getSeasons(title.id);
  expect(stored[0].episodes).toHaveLength(152);
  expect(stored[0].episodes.slice(150).map((ep) => [ep.key, ep.tmdbEpisodeId])).toEqual([
    ['s1e151', 151],
    ['s1e152', 152],
  ]);
  expect(repo.previewStructure(title.id).changes).toContainEqual({
    from: null,
    to: { seasonNumber: 1, episodeNumber: 151, name: unknown.name },
  });
  assertWatched();
  refresh(later);
  expect(repo.getSeasons(title.id)).toEqual(stored);
  assertWatched();
});
