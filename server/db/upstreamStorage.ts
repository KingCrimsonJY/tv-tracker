import type { SeasonDoc, TitleDoc } from '../../src/domain/types.ts';
import { ConflictError, type DbContext } from './types.ts';

export function saveUpstream(ctx: DbContext, title: TitleDoc): void {
  if (title.upstreamChange?.seasons) {
    ctx.db
      .prepare(
        'INSERT INTO upstream_structures (title_id, data) VALUES (?, ?) ON CONFLICT(title_id) DO UPDATE SET data = excluded.data',
      )
      .run(title.id, JSON.stringify(title.upstreamChange.seasons));
  } else if (!title.upstreamChange) {
    ctx.db.prepare('DELETE FROM upstream_structures WHERE title_id = ?').run(title.id);
  } else {
    readUpstream(ctx, title.id);
  }
}
export function readUpstream(ctx: DbContext, id: string): SeasonDoc[] {
  const row = ctx.db.prepare('SELECT data FROM upstream_structures WHERE title_id = ?').get(id) as
    { data: string } | undefined;
  if (!row) throw new ConflictError('STRUCTURE_CONFLICT', 'STRUCTURE_CONFLICT');
  return JSON.parse(row.data) as SeasonDoc[];
}
