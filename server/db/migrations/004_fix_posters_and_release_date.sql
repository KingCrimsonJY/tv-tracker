-- Migration 004: remove backfilled duplicate posters (posters.en === posters.zh)
-- and reset synthetic ${year}-01-01 releaseDate values written by migration 003.
-- The JSON transformation runs in TrackerRepository.runMigration004InTx().
SELECT 1;
