import type { DatabaseSync } from 'node:sqlite';
import { extractGenreIdsFromNames } from '../../src/domain/genres.ts';
import { normalizeLocalizedEpisodeName, normalizeLocalizedSeasonName, splitUploaderPrefixFromOverview } from '../../src/domain/progress.ts';
import type { SeasonDoc, TitleDoc } from '../../src/domain/types.ts';

export function runMigration002InTx(db: DatabaseSync): void {
  const seasonRows = db
    .prepare('SELECT title_id, season_number, data FROM seasons')
    .all() as Array<{ title_id: string; season_number: number; data: string }>;
  const updateSeason = db.prepare(
    'UPDATE seasons SET data = ? WHERE title_id = ? AND season_number = ?'
  );

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

export function runMigration003InTx(db: DatabaseSync): void {
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

      if (parsed.releaseDate === undefined) {
        const inferredAir = firstAirByTitle.get(row.id);
        if (inferredAir) {
          parsed.releaseDate = inferredAir;
        } else if (typeof parsed.year === 'number' && parsed.year > 1800) {
          parsed.releaseDate = `${parsed.year}-01-01`;
        } else {
          parsed.releaseDate = null;
        }
        changed = true;
      }

      if (!parsed.posters) {
        parsed.posters = {
          zh: parsed.posterPath ?? null,
          en: parsed.posterPath ?? null,
          textless: null,
        };
        changed = true;
      }

      if (changed) {
        updateTitle.run(JSON.stringify(parsed), row.id);
      }
    } catch {
      // Ignore malformed legacy row
    }
  }
}

export function runMigration004InTx(db: DatabaseSync): void {
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
