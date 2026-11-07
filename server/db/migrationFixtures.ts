import { DatabaseSync } from 'node:sqlite';
import type { SeasonDoc, TitleDoc } from '../../src/domain/types.ts';

/** Seed an older schema without calling repository methods that require current migrations. */
export function seedLegacyTitle(
  dbPath: string,
  title: TitleDoc,
  seasons: SeasonDoc[],
  watched: Record<string, number>,
): void {
  const db = new DatabaseSync(dbPath);
  try {
    const { id, ...data } = title;
    db.prepare('INSERT INTO titles (id, data, added_at, updated_at) VALUES (?, ?, ?, ?)').run(
      id,
      JSON.stringify(data),
      title.addedAt,
      title.updatedAt,
    );
    for (const season of seasons)
      db.prepare('INSERT INTO seasons (title_id, season_number, data) VALUES (?, ?, ?)').run(
        id,
        season.seasonNumber,
        JSON.stringify(season),
      );
    db.prepare('INSERT INTO progress (title_id, playthrough_id, data) VALUES (?, ?, ?)').run(
      id,
      'p1',
      JSON.stringify({ watched }),
    );
  } finally {
    db.close();
  }
}
