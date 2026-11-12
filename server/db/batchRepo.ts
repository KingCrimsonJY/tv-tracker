import { type BatchAction, planBatchListEntries, planBatchStatus } from '../../src/domain/batch.ts';
import { createRandomId } from '../../src/domain/id.ts';
import type {
  ListEntryDoc,
  ProgressDoc,
  StateDeletes,
  StateMutationResult,
  StateUpserts,
  TitleDoc,
} from '../../src/domain/types.ts';
import { readProgress, readSeasons } from './metadataRepo.ts';
import { getSettings } from './settingsAuthRepo.ts';
import { getTitle } from './titlesRepo.ts';
import { type DbContext, NotFoundError, serializeEntryData, serializeTitleData } from './types.ts';

/**
 * Apply one action to many titles in a single transaction: either every title changes or none does, the
 * version advances once, and every device receives one mutation. Titles that no longer exist are skipped,
 * because another device may have deleted them after the sender made its selection.
 */
export function applyTitleBatch(ctx: DbContext, titleIds: readonly string[], action: BatchAction): StateMutationResult {
  return ctx.runInTransaction(() => {
    const titles = [...new Set(titleIds)]
      .map((id) => getTitle(ctx, id))
      .filter((title): title is TitleDoc => title !== null);
    const upserts: StateUpserts = {};
    const deletes: StateDeletes = {};

    if (action.type === 'delete') {
      const entriesOf = ctx.db.prepare('SELECT id, list_id FROM list_entries WHERE title_id = ?');
      const remove = ctx.db.prepare('DELETE FROM titles WHERE id = ?');
      const entries: NonNullable<StateDeletes['entries']> = [];
      for (const title of titles) {
        for (const row of entriesOf.all(title.id) as Array<{ id: string; list_id: string }>) {
          entries.push({ listId: row.list_id, entryId: row.id });
        }
        remove.run(title.id);
      }
      if (titles.length) deletes.titles = titles.map((title) => title.id);
      if (entries.length) deletes.entries = entries;
    } else if (action.type === 'addToList') {
      if (!ctx.db.prepare('SELECT 1 FROM lists WHERE id = ?').get(action.listId)) {
        throw new NotFoundError(`List not found: ${action.listId}`, 'LIST_NOT_FOUND');
      }
      const existing = readEntries(ctx, action.listId);
      const added = planBatchListEntries(
        existing,
        titles.map((title) => title.id),
        action.now,
        () => createRandomId('entry'),
      );
      const insert = ctx.db.prepare(
        'INSERT INTO list_entries (id, list_id, title_id, rank, data) VALUES (?, ?, ?, ?, ?)',
      );
      for (const entry of added) {
        insert.run(entry.id, action.listId, entry.titleId, entry.rank, serializeEntryData(entry));
      }
      if (added.length) upserts.entriesByList = { [action.listId]: [...existing, ...added] };
    } else {
      const { includeSpecials } = getSettings(ctx);
      const updateTitle = ctx.db.prepare('UPDATE titles SET data = ?, updated_at = ? WHERE id = ?');
      const upsertProgress = ctx.db.prepare(
        `INSERT INTO progress (title_id, playthrough_id, data) VALUES (?, ?, ?)
         ON CONFLICT(title_id, playthrough_id) DO UPDATE SET data = excluded.data`,
      );
      const changedTitles: Record<string, TitleDoc> = {};
      const changedProgress: Record<string, Record<string, ProgressDoc>> = {};
      for (const title of titles) {
        const change = planBatchStatus(
          title,
          readSeasons(ctx, title.id),
          readProgress(ctx, title.id)[title.activePlaythroughId],
          action.status,
          { includeSpecials, todayStr: action.todayStr, now: action.now },
        );
        if (!change) continue;
        updateTitle.run(serializeTitleData(change.title), change.title.updatedAt, title.id);
        changedTitles[title.id] = change.title;
        if (change.progress) {
          const { playthroughId, ...data } = change.progress;
          upsertProgress.run(title.id, playthroughId, JSON.stringify(data));
          changedProgress[title.id] = { [playthroughId]: change.progress };
        }
      }
      if (Object.keys(changedTitles).length) upserts.titles = changedTitles;
      if (Object.keys(changedProgress).length) upserts.progressByTitle = changedProgress;
    }

    // Nothing to do is not a change: other devices have nothing to apply and the version stays put.
    const changed = Object.keys(upserts).length > 0 || Object.keys(deletes).length > 0;
    return { version: changed ? ctx.bumpVersionInTx() : ctx.getVersion(), upserts, deletes };
  });
}

function readEntries(ctx: DbContext, listId: string): ListEntryDoc[] {
  const rows = ctx.db
    .prepare('SELECT id, title_id, rank, data FROM list_entries WHERE list_id = ? ORDER BY rank ASC')
    .all(listId) as Array<{ id: string; title_id: string; rank: string; data: string }>;
  return rows.map((row) => ({
    ...(JSON.parse(row.data) as Omit<ListEntryDoc, 'id'>),
    id: row.id,
    titleId: row.title_id,
    rank: row.rank,
  }));
}
