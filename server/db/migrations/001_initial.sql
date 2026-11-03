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

INSERT OR IGNORE INTO meta (key, value) VALUES ('version', '0');
