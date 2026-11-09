import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { makeBaseTvTitle, makeSampleSeasons } from '../../src/domain/testFixtures';
import { seedLegacyTitle } from './migrationFixtures';
import { TrackerRepository } from './repository';

test('migration 010 finishes viewings that a later rewatch superseded', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'superseded-playthroughs-'));
  try {
    const migrations = path.join(root, 'old');
    mkdirSync(migrations);
    const current = path.resolve(import.meta.dirname, 'migrations');
    for (const name of readdirSync(current).filter((file) => Number(file.slice(0, 3)) <= 9))
      copyFileSync(path.join(current, name), path.join(migrations, name));
    const dataDir = path.join(root, 'data');
    new TrackerRepository({ dataDir, migrationsDir: migrations }).close();

    // A caught-up returning series rewatched twice: the first viewing never got a completion time.
    const title = makeBaseTvTitle({
      playthroughs: [
        { id: 'p1', number: 1, startedAt: 1000 },
        { id: 'p2', number: 2, startedAt: 2000, completedAt: 2500 },
        { id: 'p3', number: 3, startedAt: 3000 },
      ],
      activePlaythroughId: 'p3',
    });
    seedLegacyTitle(path.join(dataDir, 'tracker.db'), title, makeSampleSeasons(), { s1e1: 900 });

    const repo = new TrackerRepository({ dataDir });
    try {
      expect(repo.getTitle(title.id)?.playthroughs).toEqual([
        { id: 'p1', number: 1, startedAt: 1000, completedAt: 2000 },
        { id: 'p2', number: 2, startedAt: 2000, completedAt: 2500 },
        { id: 'p3', number: 3, startedAt: 3000 },
      ]);
    } finally {
      repo.close();
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
