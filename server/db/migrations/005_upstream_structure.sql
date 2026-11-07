-- Local structure and watched history remain authoritative across upstream changes.
UPDATE titles SET data = json_set(data,
  '$.structureLocked', json('false'), '$.sourceUnavailable', json('false'));
UPDATE progress SET data = json_set(data, '$.archivedWatched', json('[]'));
