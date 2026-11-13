import type { DatabaseSync } from 'node:sqlite';
import { migrateImages } from './imageMigration.ts';
import {
  backfillReleaseDates,
  normalizeLegacyLabels,
  removeSyntheticReleaseData,
  stripDoubanData,
} from './legacyMigrations.ts';
import { completeSupersededPlaythroughs } from './supersededPlaythroughs.ts';

export interface Migration {
  /** The `PRAGMA user_version` this step leaves behind. */
  version: number;
  name: string;
  /** Schema or set-based data changes. Runs first. */
  sql?: string;
  /** Row-by-row data changes that need application code. Runs after `sql`, in the same transaction. */
  run?: (db: DatabaseSync) => void;
}

/**
 * Every schema and data change, in order. A shipped step is immutable: databases in the field have already
 * recorded its version, so changing or renumbering it would silently skip them. Fix mistakes with a new step.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    sql: `
CREATE TABLE IF NOT EXISTS titles (
  id TEXT PRIMARY KEY,
  data JSON NOT NULL,
  added_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS seasons (
  title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  data JSON NOT NULL,
  PRIMARY KEY (title_id, season_number)
);

CREATE TABLE IF NOT EXISTS progress (
  title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  playthrough_id TEXT NOT NULL,
  data JSON NOT NULL,
  PRIMARY KEY (title_id, playthrough_id)
);

CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  data JSON NOT NULL,
  rank TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS list_entries (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  rank TEXT NOT NULL,
  data JSON NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  data JSON NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO meta (key, value) VALUES ('version', '0');`,
  },
  {
    // Shipped as two files that both claimed version 2, so a database could have run either or both.
    // Step 11 repeats them for databases that only ran the first.
    version: 2,
    name: 'strip Douban data, clean generic labels',
    run: (db) => {
      stripDoubanData(db);
      normalizeLegacyLabels(db);
    },
  },
  { version: 3, name: 'backfill release dates', run: backfillReleaseDates },
  { version: 4, name: 'remove synthetic release dates and duplicated posters', run: removeSyntheticReleaseData },
  {
    version: 5,
    name: 'upstream structure controls',
    sql: `
-- Local structure and watched history remain authoritative across upstream changes.
UPDATE titles SET data = json_set(data,
  '$.structureLocked', json('false'), '$.sourceUnavailable', json('false'));
UPDATE progress SET data = json_set(data, '$.archivedWatched', json('[]'));`,
  },
  {
    version: 6,
    name: 'retire live status and placeholder air dates',
    sql: `
-- Retire persisted live status without removing legacy titles or viewing history.
UPDATE titles SET data = json_remove(data, '$.liveStatus');
UPDATE seasons SET data = json_set(data, '$.episodes', json((
  SELECT json_group_array(json(CASE WHEN json_extract(value, '$.airDate') = '2020-01-01'
    THEN json_set(value, '$.airDate', NULL) ELSE value END))
  FROM json_each(seasons.data, '$.episodes')
))) WHERE title_id IN (SELECT id FROM titles WHERE json_extract(data, '$.source') IN ('url', 'custom'));
UPDATE progress SET data = json_set(data, '$.archivedWatched', json((
  SELECT json_group_array(json(CASE WHEN json_extract(value, '$.episode.airDate') = '2020-01-01'
    THEN json_set(value, '$.episode.airDate', NULL) ELSE value END))
  FROM json_each(progress.data, '$.archivedWatched')
))) WHERE json_type(data, '$.archivedWatched') = 'array'
  AND title_id IN (SELECT id FROM titles WHERE json_extract(data, '$.source') IN ('url', 'custom'));`,
  },
  {
    version: 7,
    name: 'separate upstream proposals, track enrichment attempts',
    sql: `

CREATE TABLE upstream_structures (
  title_id TEXT PRIMARY KEY REFERENCES titles(id) ON DELETE CASCADE,
  data TEXT NOT NULL
);
INSERT INTO upstream_structures (title_id, data)
SELECT id, json_extract(data, '$.upstreamChange.seasons') FROM titles
WHERE json_type(data, '$.upstreamChange.seasons') = 'array';
UPDATE titles SET data = json_remove(data, '$.upstreamChange.seasons')
WHERE json_type(data, '$.upstreamChange.seasons') = 'array';

CREATE TABLE enrichment_attempts (
  title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  video_id TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  next_attempt_at INTEGER NOT NULL,
  PRIMARY KEY (title_id, source_url, video_id)
);`,
  },
  { version: 8, name: 'store TMDB images as paths', run: migrateImages },
  {
    version: 9,
    name: 'episode detail revision',
    sql: `
UPDATE titles SET data = json_set(data, '$.episodeDetailsVersion', 0)
WHERE json_type(data, '$.episodeDetailsVersion') IS NULL;`,
  },
  {
    version: 10,
    name: 'finish superseded viewings',
    run: (db) => {
      completeSupersededPlaythroughs(db);
    },
  },
  {
    version: 11,
    name: 'repair databases that skipped half of step 2, index list entries',
    sql: `
CREATE INDEX IF NOT EXISTS list_entries_by_list ON list_entries (list_id, rank);
CREATE INDEX IF NOT EXISTS list_entries_by_title ON list_entries (title_id);
`,
    run: (db) => {
      stripDoubanData(db);
      normalizeLegacyLabels(db);
    },
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS.length;

MIGRATIONS.forEach((migration, index) => {
  if (migration.version !== index + 1) {
    throw new Error(`Migration "${migration.name}" must be version ${index + 1}, not ${migration.version}`);
  }
});
