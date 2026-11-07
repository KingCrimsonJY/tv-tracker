import type { ListEntryDoc, StateMutationResult, WatchListDoc } from '../../src/domain/types.ts';
import { type DbContext, NotFoundError, serializeEntryData, serializeListData } from './types.ts';

function getEntriesForListInTx(ctx: DbContext, listId: string): ListEntryDoc[] {
  const rows = ctx.db
    .prepare('SELECT id, title_id, rank, data FROM list_entries WHERE list_id = ? ORDER BY rank ASC')
    .all(listId) as Array<{
    id: string;
    title_id: string;
    rank: string;
    data: string;
  }>;
  return rows.map((r) => {
    const parsed = JSON.parse(r.data) as Omit<ListEntryDoc, 'id'>;
    return {
      ...parsed,
      id: r.id,
      titleId: r.title_id,
      rank: r.rank,
    };
  });
}

export function putList(ctx: DbContext, id: string, listInput: Omit<WatchListDoc, 'id'>): StateMutationResult {
  return ctx.runInTransaction(() => {
    const listDoc: WatchListDoc = { ...listInput, id };
    ctx.db
      .prepare(
        `INSERT INTO lists (id, data, rank)
         VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, rank = excluded.rank`,
      )
      .run(id, serializeListData(listDoc), listDoc.rank);

    const version = ctx.bumpVersionInTx();
    return {
      version,
      upserts: {
        lists: { [id]: listDoc },
      },
      deletes: {},
    };
  });
}

export function patchList(ctx: DbContext, id: string, patch: Partial<Omit<WatchListDoc, 'id'>>): StateMutationResult {
  return ctx.runInTransaction(() => {
    const row = ctx.db.prepare('SELECT data, rank FROM lists WHERE id = ?').get(id) as
      { data: string; rank: string } | undefined;
    if (!row) {
      throw new NotFoundError(`List not found: ${id}`, 'LIST_NOT_FOUND');
    }

    const existing = JSON.parse(row.data) as Omit<WatchListDoc, 'id'>;
    const merged: WatchListDoc = {
      ...existing,
      rank: row.rank,
      ...patch,
      id,
    };

    ctx.db.prepare('UPDATE lists SET data = ?, rank = ? WHERE id = ?').run(serializeListData(merged), merged.rank, id);

    const version = ctx.bumpVersionInTx();
    return {
      version,
      upserts: {
        lists: { [id]: merged },
      },
      deletes: {},
    };
  });
}

export function deleteList(ctx: DbContext, id: string): StateMutationResult {
  return ctx.runInTransaction(() => {
    ctx.db.prepare('DELETE FROM lists WHERE id = ?').run(id);
    const version = ctx.bumpVersionInTx();
    return {
      version,
      upserts: {},
      deletes: {
        lists: [id],
      },
    };
  });
}

export function putListEntry(
  ctx: DbContext,
  listId: string,
  entryId: string,
  entryInput: Omit<ListEntryDoc, 'id'>,
): StateMutationResult {
  return ctx.runInTransaction(() => {
    const listExists = ctx.db.prepare('SELECT 1 FROM lists WHERE id = ?').get(listId);
    if (!listExists) {
      throw new NotFoundError(`List not found: ${listId}`, 'LIST_NOT_FOUND');
    }
    const titleExists = ctx.db.prepare('SELECT 1 FROM titles WHERE id = ?').get(entryInput.titleId);
    if (!titleExists) {
      throw new NotFoundError(`Title not found: ${entryInput.titleId}`, 'TITLE_NOT_FOUND');
    }

    const entryDoc: ListEntryDoc = { ...entryInput, id: entryId };
    ctx.db
      .prepare(
        `INSERT INTO list_entries (id, list_id, title_id, rank, data)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           list_id = excluded.list_id,
           title_id = excluded.title_id,
           rank = excluded.rank,
           data = excluded.data`,
      )
      .run(entryId, listId, entryDoc.titleId, entryDoc.rank, serializeEntryData(entryDoc));

    const entries = getEntriesForListInTx(ctx, listId);
    const version = ctx.bumpVersionInTx();
    return {
      version,
      upserts: {
        entriesByList: {
          [listId]: entries,
        },
      },
      deletes: {},
    };
  });
}

export function patchListEntry(
  ctx: DbContext,
  listId: string,
  entryId: string,
  patch: Partial<Omit<ListEntryDoc, 'id'>>,
): StateMutationResult {
  return ctx.runInTransaction(() => {
    const row = ctx.db
      .prepare('SELECT title_id, rank, data FROM list_entries WHERE id = ? AND list_id = ?')
      .get(entryId, listId) as { title_id: string; rank: string; data: string } | undefined;
    if (!row) {
      throw new NotFoundError(`List entry not found: ${entryId}`, 'ENTRY_NOT_FOUND');
    }

    const existing = JSON.parse(row.data) as Omit<ListEntryDoc, 'id'>;
    const merged: ListEntryDoc = {
      ...existing,
      titleId: row.title_id,
      rank: row.rank,
      ...patch,
      id: entryId,
    };

    ctx.db
      .prepare('UPDATE list_entries SET title_id = ?, rank = ?, data = ? WHERE id = ? AND list_id = ?')
      .run(merged.titleId, merged.rank, serializeEntryData(merged), entryId, listId);

    const entries = getEntriesForListInTx(ctx, listId);
    const version = ctx.bumpVersionInTx();
    return {
      version,
      upserts: {
        entriesByList: {
          [listId]: entries,
        },
      },
      deletes: {},
    };
  });
}

export function deleteListEntry(ctx: DbContext, listId: string, entryId: string): StateMutationResult {
  return ctx.runInTransaction(() => {
    ctx.db.prepare('DELETE FROM list_entries WHERE id = ? AND list_id = ?').run(entryId, listId);
    const entries = getEntriesForListInTx(ctx, listId);
    const version = ctx.bumpVersionInTx();
    return {
      version,
      upserts: {
        entriesByList: {
          [listId]: entries,
        },
      },
      deletes: {
        entries: [{ listId, entryId }],
      },
    };
  });
}
