
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
);
