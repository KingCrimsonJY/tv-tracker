import type { DatabaseSync } from 'node:sqlite';
import { extractGenreIdsFromNames } from '../../src/domain/genres.ts';
import {
  normalizeLocalizedEpisodeName,
  normalizeLocalizedSeasonName,
  splitUploaderPrefixFromOverview,
} from '../../src/domain/progress.ts';
import type { SeasonDoc, TitleDoc } from '../../src/domain/types.ts';

/** Idempotent: safe to repeat on rows that are already clean. */
export function stripDoubanData(db: DatabaseSync): void {
  db.exec(
    `UPDATE titles
     SET data = json_remove(data, '$.ratings.douban', '$.externalIds.douban')
     WHERE json_type(data, '$.ratings.douban') IS NOT NULL
        OR json_type(data, '$.externalIds.douban') IS NOT NULL`,
  );
}

/**
 * Turn legacy string season/episode names into localized objects, drop generic labels such as "Season 1",
 * move the uploader prefix out of link-import overviews and backfill genre ids. Idempotent.
 */
export function normalizeLegacyLabels(db: DatabaseSync): void {
  const seasonRows = db.prepare('SELECT title_id, season_number, data FROM seasons').all() as Array<{
    title_id: string;
    season_number: number;
    data: string;
  }>;
  const updateSeason = db.prepare('UPDATE seasons SET data = ? WHERE title_id = ? AND season_number = ?');

  for (const row of seasonRows) {
    try {
      const parsed = JSON.parse(row.data) as SeasonDoc & {
        name?: unknown;
        episodes?: Array<{ name?: unknown }>;
      };
      const normalizedSeason: SeasonDoc = {
        ...parsed,
        name: normalizeLocalizedSeasonName(parsed.name as string | null | undefined),
        episodes: Array.isArray(parsed.episodes)
          ? parsed.episodes.map((ep) => ({
              ...ep,
              name: normalizeLocalizedEpisodeName(ep.name as string | null | undefined),
            }))
          : [],
      };
      updateSeason.run(JSON.stringify(normalizedSeason), row.title_id, row.season_number);
    } catch {
      // Ignore malformed legacy row
    }
  }

  const titleRows = db.prepare('SELECT id, data FROM titles').all() as Array<{
    id: string;
    data: string;
  }>;
  const updateTitle = db.prepare('UPDATE titles SET data = ? WHERE id = ?');

  for (const row of titleRows) {
    try {
      const parsed = JSON.parse(row.data) as Omit<TitleDoc, 'id'>;
      let changed = false;

      if ((parsed.source === 'url' || parsed.source === 'custom') && parsed.overview?.zh) {
        const split = splitUploaderPrefixFromOverview(parsed.overview.zh);
        if (split.uploader) {
          parsed.uploader = parsed.uploader || split.uploader;
          parsed.overview = {
            ...parsed.overview,
            zh: split.overview,
          };
          changed = true;
        }
      }

      if (
        (!parsed.genreIds || parsed.genreIds.length === 0) &&
        Array.isArray(parsed.genres) &&
        parsed.genres.length > 0
      ) {
        const ids = extractGenreIdsFromNames(parsed.genres);
        if (ids.length > 0) {
          parsed.genreIds = ids;
          changed = true;
        }
      }

      if (changed) {
        updateTitle.run(JSON.stringify(parsed), row.id);
      }
    } catch {
      // Ignore malformed legacy row
    }
  }
}

function getFirstAirDatesByTitle(db: DatabaseSync): Map<string, string> {
  const seasonRows = db
    .prepare('SELECT title_id, season_number, data FROM seasons WHERE season_number = 1')
    .all() as Array<{ title_id: string; season_number: number; data: string }>;
  const firstAirByTitle = new Map<string, string>();
  for (const sRow of seasonRows) {
    try {
      const parsedSeason = JSON.parse(sRow.data) as SeasonDoc;
      const firstEpAirDate = parsedSeason.episodes?.[0]?.airDate;
      if (firstEpAirDate && firstEpAirDate.trim() !== '') {
        firstAirByTitle.set(sRow.title_id, firstEpAirDate.trim());
      } else if (parsedSeason.airDate && parsedSeason.airDate.trim() !== '') {
        firstAirByTitle.set(sRow.title_id, parsedSeason.airDate.trim());
      }
    } catch {
      // Ignore malformed season row
    }
  }
  return firstAirByTitle;
}

/** Earlier releases guessed `${year}-01-01` and duplicated the poster here; only real air dates are used now. */
export function backfillReleaseDates(db: DatabaseSync): void {
  const firstAirByTitle = getFirstAirDatesByTitle(db);
  const titleRows = db.prepare('SELECT id, data FROM titles').all() as Array<{ id: string; data: string }>;
  const updateTitle = db.prepare('UPDATE titles SET data = ? WHERE id = ?');
  for (const row of titleRows) {
    try {
      const parsed = JSON.parse(row.data) as Omit<TitleDoc, 'id'>;
      if (parsed.releaseDate !== undefined) continue;
      parsed.releaseDate = firstAirByTitle.get(row.id) ?? null;
      updateTitle.run(JSON.stringify(parsed), row.id);
    } catch {
      // Ignore malformed legacy row
    }
  }
}

/** Undo what the earlier version of the previous step wrote into databases that already ran it. */
export function removeSyntheticReleaseData(db: DatabaseSync): void {
  const firstAirByTitle = getFirstAirDatesByTitle(db);
  const titleRows = db.prepare('SELECT id, data FROM titles').all() as Array<{
    id: string;
    data: string;
  }>;
  const updateTitle = db.prepare('UPDATE titles SET data = ? WHERE id = ?');

  for (const row of titleRows) {
    try {
      const parsed = JSON.parse(row.data) as Omit<TitleDoc, 'id'>;
      let changed = false;

      if (parsed.posters && parsed.posters.en === parsed.posters.zh) {
        delete parsed.posters;
        changed = true;
      }

      if (
        typeof parsed.year === 'number' &&
        parsed.releaseDate === `${parsed.year}-01-01` &&
        firstAirByTitle.get(row.id) !== `${parsed.year}-01-01`
      ) {
        parsed.releaseDate = null;
        changed = true;
      }

      if (changed) {
        updateTitle.run(JSON.stringify(parsed), row.id);
      }
    } catch {
      // Ignore malformed row
    }
  }
}
