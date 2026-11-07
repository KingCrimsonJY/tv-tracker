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
  AND title_id IN (SELECT id FROM titles WHERE json_extract(data, '$.source') IN ('url', 'custom'));
