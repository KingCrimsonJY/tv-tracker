import type { DatabaseSync } from 'node:sqlite';
import { normalizeTmdbImages } from '../../src/domain/images.ts';
export function migrateImages(db: DatabaseSync): void {
  for (const table of ['titles', 'seasons', 'progress', 'upstream_structures']) {
    const rows = db.prepare('SELECT rowid, data FROM ' + table).all() as { rowid: number; data: string }[];
    const update = db.prepare('UPDATE ' + table + ' SET data = ? WHERE rowid = ?');
    for (const row of rows) {
      const normalized = JSON.stringify(normalizeTmdbImages(JSON.parse(row.data) as unknown));
      if (normalized !== row.data) update.run(normalized, row.rowid);
    }
  }
}
