import type { DatabaseSync } from 'node:sqlite';
import type { Playthrough, TitleDoc } from '../../src/domain/types.ts';

/**
 * Before migration 010, starting a rewatch of a caught-up returning series left the previous viewing without
 * `completedAt`, so history showed it as in progress and the watch count was too low. Every viewing except the
 * active one was finished when the next one started; use that start time.
 */
export function completeSupersededPlaythroughs(db: DatabaseSync): number {
  const rows = db.prepare('SELECT id, data FROM titles').all() as Array<{ id: string; data: string }>;
  const update = db.prepare('UPDATE titles SET data = ? WHERE id = ?');
  let changed = 0;
  for (const row of rows) {
    const title = JSON.parse(row.data) as Omit<TitleDoc, 'id'>;
    if (!Array.isArray(title.playthroughs) || title.playthroughs.length < 2) continue;
    const byStart = [...title.playthroughs].sort((a, b) => a.startedAt - b.startedAt);
    const nextStart = new Map(byStart.slice(0, -1).map((p, index) => [p.id, byStart[index + 1].startedAt]));
    let touched = false;
    const playthroughs = title.playthroughs.map((p): Playthrough => {
      const finishedBy = nextStart.get(p.id);
      if (p.id === title.activePlaythroughId || p.completedAt != null || finishedBy === undefined) return p;
      touched = true;
      return { ...p, completedAt: finishedBy };
    });
    if (!touched) continue;
    update.run(JSON.stringify({ ...title, playthroughs }), row.id);
    changed += 1;
  }
  return changed;
}
