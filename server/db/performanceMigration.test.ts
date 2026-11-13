import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { TrackerRepository } from './repository';
import { seedLegacyTitle } from './migrationFixtures';
import { makeBaseTvTitle, makeSampleSeasons } from '../../src/domain/testFixtures';

test('migration separates old proposals, normalizes artwork and preserves history and full backups', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'performance-migration-'));
  const dataDir = path.join(root, 'data');
  const old = new TrackerRepository({ dataDir, migrateTo: 6 });
  old.close();
  const seasons = makeSampleSeasons();
  seasons[0].episodes[0].stillPath = 'https://image.tmdb.org/t/p/w300/still.jpg';
  const title = makeBaseTvTitle({
    posterPath: 'https://image.tmdb.org/t/p/w500/poster.jpg',
    upstreamChange: { signature: 'old-signature', fetchedAt: 1, seasons },
  });
  seedLegacyTitle(path.join(dataDir, 'tracker.db'), title, seasons, { s1e1: 100 });
  const repo = new TrackerRepository({ dataDir });
  try {
    expect(repo.getTitle(title.id)).toMatchObject({ posterPath: '/poster.jpg', episodeDetailsVersion: 0 });
    expect(repo.getTitle(title.id)?.upstreamChange?.seasons).toBeUndefined();
    expect(repo.getState().progressByTitle[title.id].p1.watched).toEqual({ s1e1: 100 });
    expect(repo.exportData().titles[title.id].upstreamChange?.seasons?.[0].episodes[0].stillPath).toBe('/still.jpg');
    expect(repo.getSeasons(title.id)[0].episodes[0].stillPath).toBe('/still.jpg');
  } finally {
    repo.close();
    rmSync(root, { recursive: true });
  }
});
