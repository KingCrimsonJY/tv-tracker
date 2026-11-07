import { afterEach, expect, test } from 'vitest';
import { TrackerRepository } from './repository.ts';
import { makeBaseTvTitle, makeSampleSeasons } from '../../src/domain/testFixtures.ts';
const repos: TrackerRepository[] = [];
afterEach(() => {
  for (const repo of repos.splice(0)) repo.close();
});
test('partial metadata refresh preserves failed seasons and watched marks in one version', () => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  repos.push(repo);
  const title = makeBaseTvTitle();
  const seasons = makeSampleSeasons();
  repo.putTitle(title.id, { title, seasons, progress: { p1: { playthroughId: 'p1', watched: { s1e1: 42 } } } });
  const before = repo.getVersion();
  const incoming = { ...title, releaseDate: '2022-02-18', posters: { en: 'poster' }, backdropPath: 'backdrop' };
  const result = repo.refreshMetadata(title.id, { title: incoming, seasons: [seasons[0]], failedSeasons: [1] }, 123);
  expect(result.version).toBe(before + 1);
  expect(repo.getState().seasonsByTitle[title.id]).toEqual(seasons);
  expect(repo.getState().progressByTitle[title.id].p1.watched).toEqual({ s1e1: 42 });
  expect(repo.getTitle(title.id)).toMatchObject({
    releaseDate: '2022-02-18',
    posters: { en: 'poster' },
    backdropPath: 'backdrop',
  });
});
