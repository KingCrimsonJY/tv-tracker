import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, test, vi } from 'vitest';
import { makeBaseTvTitle, makeSampleSeasons } from '../../src/domain/testFixtures.ts';
import { LATEST_SCHEMA_VERSION } from './migrations.ts';
import { TrackerRepository } from './repository.ts';
import { SafetyBackupError } from './types.ts';

function withDataDir(run: (dataDir: string) => void): void {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhenji-safety-'));
  try {
    run(dataDir);
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

/** The copy is written, but cannot be moved into place: a full disk or a directory the process may not write. */
function failNextBackup(): void {
  vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
    throw Object.assign(new Error('EACCES: permission denied, rename'), { code: 'EACCES' });
  });
  vi.spyOn(console, 'error').mockImplementationOnce(() => {});
}
afterEach(() => vi.restoreAllMocks());

test('an import does not replace the library when the copy of the old one cannot be written', () => {
  withDataDir((dataDir) => {
    const repo = new TrackerRepository({ dataDir });
    try {
      const title = makeBaseTvTitle();
      repo.putTitle(title.id, { title, seasons: makeSampleSeasons() });
      const empty = {
        ...repo.exportData(),
        titles: {},
        seasonsByTitle: {},
        progressByTitle: {},
        lists: {},
        entriesByList: {},
      };
      const before = repo.getState();
      failNextBackup();
      expect(() => repo.importData(empty)).toThrow(SafetyBackupError);
      expect(repo.getState()).toEqual(before);
    } finally {
      repo.close();
    }
  });
});

test('a database is not migrated when the copy of the old one cannot be written', () => {
  withDataDir((dataDir) => {
    new TrackerRepository({ dataDir }).close();
    const dbPath = path.join(dataDir, 'tracker.db');
    const setVersion = new DatabaseSync(dbPath);
    setVersion.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION - 1};`);
    setVersion.close();
    failNextBackup();

    expect(() => new TrackerRepository({ dataDir })).toThrow(SafetyBackupError);

    const check = new DatabaseSync(dbPath);
    try {
      expect(Number((check.prepare('PRAGMA user_version').get() as { user_version: number }).user_version)).toBe(
        LATEST_SCHEMA_VERSION - 1,
      );
    } finally {
      check.close();
    }
  });
});

test('an import gives every title a new episode-details revision, whatever the file recorded', () => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  try {
    const title = makeBaseTvTitle();
    repo.putTitle(title.id, { title, seasons: makeSampleSeasons() });
    repo.replaceSeasons(title.id, makeSampleSeasons());
    const exported = repo.exportData();
    const recorded = exported.titles[title.id].episodeDetailsVersion;
    expect(recorded).toBeGreaterThan(0);

    // Same revision number in the file, different episode names: clients must not keep the cached details.
    const result = repo.importData(exported);
    expect(repo.getTitle(title.id)?.episodeDetailsVersion).toBe(result.version);
    expect(result.version).toBeGreaterThan(recorded ?? 0);
  } finally {
    repo.close();
  }
});
