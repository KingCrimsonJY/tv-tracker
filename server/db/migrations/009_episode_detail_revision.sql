UPDATE titles SET data = json_set(data, '$.episodeDetailsVersion', 0)
WHERE json_type(data, '$.episodeDetailsVersion') IS NULL;
