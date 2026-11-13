import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, test } from 'vitest';
import { LATEST_SCHEMA_VERSION, MIGRATIONS } from './migrations.ts';
import { TrackerRepository } from './repository.ts';

function withDataDir(run: (dataDir: string, dbPath: string) => void): void {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhenji-migrations-'));
  try {
    run(dataDir, path.join(dataDir, 'tracker.db'));
  } finally {
    fs.rmSync(dataDir, { recursive: true });
  }
}

const userVersion = (dbPath: string): number => {
  const db = new DatabaseSync(dbPath);
  try {
    return Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);
  } finally {
    db.close();
  }
};

test('versions are contiguous from 1, so no two steps can claim the same number', () => {
  expect(MIGRATIONS.map((migration) => migration.version)).toEqual(MIGRATIONS.map((_, index) => index + 1));
  expect(LATEST_SCHEMA_VERSION).toBe(MIGRATIONS.length);
});

test('a new database lands on the latest version and reopening it changes nothing', () => {
  withDataDir((dataDir, dbPath) => {
    new TrackerRepository({ dataDir }).close();
    expect(userVersion(dbPath)).toBe(LATEST_SCHEMA_VERSION);
    new TrackerRepository({ dataDir }).close();
    expect(fs.readdirSync(path.join(dataDir, 'backups'))).toEqual([]);
  });
});

test('every older version upgrades to the latest and takes one safety backup first', () => {
  for (let from = 1; from < LATEST_SCHEMA_VERSION; from++) {
    withDataDir((dataDir, dbPath) => {
      new TrackerRepository({ dataDir, migrateTo: from }).close();
      expect(userVersion(dbPath)).toBe(from);
      new TrackerRepository({ dataDir }).close();
      expect(userVersion(dbPath)).toBe(LATEST_SCHEMA_VERSION);
      expect(
        fs.readdirSync(path.join(dataDir, 'backups')).filter((name) => name.includes('pre-migration')),
      ).toHaveLength(1);
    });
  }
});

test('a database that only ran the first of the two former "002" files is repaired', () => {
  withDataDir((dataDir, dbPath) => {
    new TrackerRepository({ dataDir, migrateTo: 1 }).close();
    const db = new DatabaseSync(dbPath);
    const title = {
      source: 'tmdb',
      names: { original: 'Show' },
      genres: [],
      ratings: { douban: '8.1' },
      externalIds: {},
    };
    db.prepare('INSERT INTO titles (id, data, added_at, updated_at) VALUES (?, ?, 1, 1)').run(
      't1',
      JSON.stringify(title),
    );
    db.prepare('INSERT INTO seasons (title_id, season_number, data) VALUES (?, 1, ?)').run(
      't1',
      JSON.stringify({ seasonNumber: 1, name: '第 1 季', episodes: [{ number: 1, key: 's1e1', name: 'Pilot' }] }),
    );
    // What the former 002_strip_douban.sql left behind: version 2, labels still raw strings.
    db.exec('PRAGMA user_version = 2;');
    db.close();

    const repo = new TrackerRepository({ dataDir });
    try {
      expect(repo.getTitle('t1')?.ratings).toEqual({});
      expect(repo.getSeasons('t1')[0]).toMatchObject({ name: null, episodes: [{ name: { zh: 'Pilot' } }] });
    } finally {
      repo.close();
    }
  });
});

test('a database written by a newer release is refused instead of being modified', () => {
  withDataDir((dataDir, dbPath) => {
    new TrackerRepository({ dataDir }).close();
    const db = new DatabaseSync(dbPath);
    db.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1};`);
    db.close();
    expect(() => new TrackerRepository({ dataDir })).toThrow(/newer than this release/);
    expect(userVersion(dbPath)).toBe(LATEST_SCHEMA_VERSION + 1);
  });
});
