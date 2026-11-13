import { seedLegacyTitle } from './migrationFixtures.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { TrackerRepository } from './repository.ts';
import { makeBaseTvTitle, makeSampleSeasons } from '../../src/domain/testFixtures.ts';

test('migration initializes upstream controls while preserving legacy library and history', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'structure-migration-'));
  const dataDir = path.join(root, 'data');
  const title = makeBaseTvTitle();
  const seasons = makeSampleSeasons();
  const old = new TrackerRepository({ dataDir, migrateTo: 4 });
  old.close();
  seedLegacyTitle(path.join(dataDir, 'tracker.db'), title, seasons, { s1e1: 42 });
  const upgraded = new TrackerRepository({ dataDir });
  try {
    expect(upgraded.getTitle(title.id)).toMatchObject({ structureLocked: false, sourceUnavailable: false });
    expect(upgraded.getState().seasonsByTitle[title.id]).toEqual(seasons);
    expect(upgraded.getState().progressByTitle[title.id].p1).toMatchObject({
      watched: { s1e1: 42 },
      archivedWatched: [],
    });
  } finally {
    upgraded.close();
    fs.rmSync(root, { recursive: true });
  }
});
