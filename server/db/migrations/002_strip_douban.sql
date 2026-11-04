UPDATE titles
SET data = json_remove(data, '$.ratings.douban', '$.externalIds.douban')
WHERE json_type(data, '$.ratings.douban') IS NOT NULL
   OR json_type(data, '$.externalIds.douban') IS NOT NULL;
