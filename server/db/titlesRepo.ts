import { saveUpstream } from './upstreamStorage.ts';
import { titleDocSchema } from '../../src/domain/schemas.ts';
import type {
  ProgressDoc,
  SeasonDoc,
  StateDeletes,
  StateMutationResult,
  StateUpserts,
  TitleAtomicActionInput,
  TitleDoc,
} from '../../src/domain/types.ts';
import { ConflictError, type DbContext, NotFoundError, serializeTitleData, type StoredProgressData } from './types.ts';

export function getTitle(ctx: DbContext, id: string): TitleDoc | null {
  const row = ctx.db.prepare('SELECT data FROM titles WHERE id = ?').get(id) as { data: string } | undefined;
  if (!row) return null;
  const parsed = JSON.parse(row.data) as Omit<TitleDoc, 'id'>;
  return { ...parsed, id };
}

export function putTitle(
  ctx: DbContext,
  id: string,
  input: {
    title: TitleDoc;
    seasons?: SeasonDoc[];
    progress?: Record<string, ProgressDoc>;
  },
): StateMutationResult {
  return ctx.runInTransaction(() => {
    const titleDoc: TitleDoc = { ...input.title, id, episodeDetailsVersion: ctx.getVersion() + 1 };
    const dataJson = serializeTitleData(titleDoc);

    ctx.db
      .prepare(
        `INSERT INTO titles (id, data, added_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           data = excluded.data,
           added_at = excluded.added_at,
           updated_at = excluded.updated_at`,
      )
      .run(id, dataJson, titleDoc.addedAt, titleDoc.updatedAt);

    saveUpstream(ctx, titleDoc);
    let sortedSeasons: SeasonDoc[] | undefined;
    if (input.seasons !== undefined) {
      ctx.db.prepare('DELETE FROM seasons WHERE title_id = ?').run(id);
      sortedSeasons = [...input.seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
      const insertSeason = ctx.db.prepare('INSERT INTO seasons (title_id, season_number, data) VALUES (?, ?, ?)');
      for (const s of sortedSeasons) {
        insertSeason.run(id, s.seasonNumber, JSON.stringify(s));
      }
    }

    let storedProgressMap: Record<string, ProgressDoc> | undefined;
    if (input.progress !== undefined) {
      storedProgressMap = {};
      const upsertProg = ctx.db.prepare(
        `INSERT INTO progress (title_id, playthrough_id, data)
         VALUES (?, ?, ?)
         ON CONFLICT(title_id, playthrough_id) DO UPDATE SET data = excluded.data`,
      );
      for (const [ptId, pDoc] of Object.entries(input.progress)) {
        const progPayload: StoredProgressData = {
          watched: pDoc.watched || {},
          archivedWatched: pDoc.archivedWatched,
          ...(pDoc.movieWatchedAt !== undefined ? { movieWatchedAt: pDoc.movieWatchedAt } : {}),
        };
        upsertProg.run(id, ptId, JSON.stringify(progPayload));
        storedProgressMap[ptId] = {
          playthroughId: ptId,
          watched: progPayload.watched,
          archivedWatched: progPayload.archivedWatched,
          ...(progPayload.movieWatchedAt !== undefined ? { movieWatchedAt: progPayload.movieWatchedAt } : {}),
        };
      }
    }

    const version = ctx.bumpVersionInTx();
    return {
      version,
      upserts: {
        titles: { [id]: titleDoc },
        ...(sortedSeasons !== undefined ? { seasonsByTitle: { [id]: sortedSeasons } } : {}),
        ...(storedProgressMap !== undefined ? { progressByTitle: { [id]: storedProgressMap } } : {}),
      },
      deletes: {},
    };
  });
}

export function patchTitle(ctx: DbContext, id: string, patch: Partial<Omit<TitleDoc, 'id'>>): StateMutationResult {
  return ctx.runInTransaction(() => {
    const row = ctx.db.prepare('SELECT data FROM titles WHERE id = ?').get(id) as { data: string } | undefined;
    if (!row) {
      throw new NotFoundError(`Title not found: ${id}`, 'TITLE_NOT_FOUND');
    }

    const existing = JSON.parse(row.data) as Omit<TitleDoc, 'id'>;
    const merged: TitleDoc = {
      ...existing,
      ...patch,
      id,
    };
    const dataJson = serializeTitleData(merged);

    ctx.db
      .prepare('UPDATE titles SET data = ?, added_at = ?, updated_at = ? WHERE id = ?')
      .run(dataJson, merged.addedAt, merged.updatedAt, id);
    saveUpstream(ctx, merged);

    const version = ctx.bumpVersionInTx();
    return {
      version,
      upserts: {
        titles: { [id]: merged },
      },
      deletes: {},
    };
  });
}

export function deleteTitle(ctx: DbContext, id: string): StateMutationResult {
  return ctx.runInTransaction(() => {
    const affectedEntries = ctx.db.prepare('SELECT id, list_id FROM list_entries WHERE title_id = ?').all(id) as Array<{
      id: string;
      list_id: string;
    }>;

    ctx.db.prepare('DELETE FROM titles WHERE id = ?').run(id);
    const version = ctx.bumpVersionInTx();

    return {
      version,
      upserts: {},
      deletes: {
        titles: [id],
        ...(affectedEntries.length > 0
          ? {
              entries: affectedEntries.map((e) => ({
                listId: e.list_id,
                entryId: e.id,
              })),
            }
          : {}),
      },
    };
  });
}

export function replaceSeasons(ctx: DbContext, titleId: string, seasons: SeasonDoc[]): StateMutationResult {
  return ctx.runInTransaction(() => {
    const title = getTitle(ctx, titleId);
    if (!title) {
      throw new NotFoundError(`Title not found: ${titleId}`, 'TITLE_NOT_FOUND');
    }

    ctx.db.prepare('DELETE FROM seasons WHERE title_id = ?').run(titleId);
    const sortedSeasons = [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
    const insertStmt = ctx.db.prepare('INSERT INTO seasons (title_id, season_number, data) VALUES (?, ?, ?)');
    for (const s of sortedSeasons) {
      insertStmt.run(titleId, s.seasonNumber, JSON.stringify(s));
    }

    const version = ctx.bumpVersionInTx();
    const updated = { ...title, episodeDetailsVersion: version };
    ctx.db.prepare('UPDATE titles SET data = ? WHERE id = ?').run(serializeTitleData(updated), titleId);
    return {
      version,
      upserts: {
        titles: { [titleId]: updated },
        seasonsByTitle: {
          [titleId]: sortedSeasons,
        },
      },
      deletes: {},
    };
  });
}

/**
 * Reject progress writes built from a stale view of the playthroughs. Structural changes (start, cancel,
 * clear or delete a playthrough) must name the active playthrough they were computed from, may only remove
 * the playthrough whose progress is deleted in the same request, and progress may only be written to the
 * playthrough that is active once the request is applied.
 */
function assertPlaythroughWriteIsCurrent(current: Omit<TitleDoc, 'id'>, input: TitleAtomicActionInput): void {
  const conflict = () => new ConflictError('REWATCH_CONFLICT', 'REWATCH_CONFLICT');
  const expected = input.expectedActivePlaythroughId;
  if (expected !== undefined && expected !== current.activePlaythroughId) throw conflict();

  const currentIds = new Set(current.playthroughs.map((p) => p.id));
  const nextPlaythroughs = input.title?.playthroughs;
  const nextIds = nextPlaythroughs ? new Set(nextPlaythroughs.map((p) => p.id)) : currentIds;
  const nextActiveId = input.title?.activePlaythroughId ?? current.activePlaythroughId;
  const deletedId = input.progress?.deletePlaythroughId;
  const removedIds = [...currentIds].filter((id) => !nextIds.has(id));
  const structural =
    [...nextIds].some((id) => !currentIds.has(id)) ||
    removedIds.length > 0 ||
    nextActiveId !== current.activePlaythroughId ||
    deletedId !== undefined;

  if (structural && expected === undefined) throw conflict();
  if (removedIds.some((id) => id !== deletedId)) throw conflict();
  if (deletedId !== undefined && (nextIds.has(deletedId) || deletedId === nextActiveId)) throw conflict();
  const writtenId = input.progress?.playthroughId;
  if (writtenId !== undefined && writtenId !== nextActiveId) throw conflict();
}

export function applyTitleAtomicAction(
  ctx: DbContext,
  titleId: string,
  input: TitleAtomicActionInput,
): StateMutationResult {
  return ctx.runInTransaction(() => {
    const titleRow = ctx.db.prepare('SELECT data FROM titles WHERE id = ?').get(titleId) as
      { data: string } | undefined;
    if (!titleRow) {
      throw new NotFoundError(`Title not found: ${titleId}`, 'TITLE_NOT_FOUND');
    }

    const currentTitle = JSON.parse(titleRow.data) as Omit<TitleDoc, 'id'>;
    assertPlaythroughWriteIsCurrent(currentTitle, input);

    const upserts: StateUpserts = {};
    const deletes: StateDeletes = {};

    if (input.progress) {
      const progInput = input.progress;
      if (progInput.deletePlaythroughId) {
        ctx.db
          .prepare('DELETE FROM progress WHERE title_id = ? AND playthrough_id = ?')
          .run(titleId, progInput.deletePlaythroughId);
        deletes.progress = [{ titleId, playthroughId: progInput.deletePlaythroughId }];
      }

      if (progInput.playthroughId) {
        const ptId = progInput.playthroughId;
        const row = ctx.db
          .prepare('SELECT data FROM progress WHERE title_id = ? AND playthrough_id = ?')
          .get(titleId, ptId) as { data: string } | undefined;

        const current: StoredProgressData = row ? (JSON.parse(row.data) as StoredProgressData) : { watched: {} };

        const watched: Record<string, number> =
          progInput.replaceWatched !== undefined ? { ...progInput.replaceWatched } : { ...(current.watched || {}) };

        if (progInput.set) {
          for (const [epKey, ts] of Object.entries(progInput.set)) {
            watched[epKey] = ts;
          }
        }
        if (progInput.unset) {
          for (const epKey of progInput.unset) {
            delete watched[epKey];
          }
        }

        let movieWatchedAt = current.movieWatchedAt;
        if (progInput.movieWatchedAt === null) {
          movieWatchedAt = undefined;
        } else if (typeof progInput.movieWatchedAt === 'number') {
          movieWatchedAt = progInput.movieWatchedAt;
        }

        const updatedData: StoredProgressData = {
          archivedWatched: current.archivedWatched,
          watched,
          ...(movieWatchedAt !== undefined ? { movieWatchedAt } : {}),
        };

        ctx.db
          .prepare(
            `INSERT INTO progress (title_id, playthrough_id, data)
             VALUES (?, ?, ?)
             ON CONFLICT(title_id, playthrough_id) DO UPDATE SET data = excluded.data`,
          )
          .run(titleId, ptId, JSON.stringify(updatedData));

        const doc: ProgressDoc = {
          playthroughId: ptId,
          watched: updatedData.watched,
          archivedWatched: updatedData.archivedWatched,
          ...(updatedData.movieWatchedAt !== undefined ? { movieWatchedAt: updatedData.movieWatchedAt } : {}),
        };

        upserts.progressByTitle = {
          [titleId]: {
            [ptId]: doc,
          },
        };
      }
    }

    if (input.title) {
      const existing = JSON.parse(titleRow.data) as Omit<TitleDoc, 'id'>;
      const merged: TitleDoc = {
        ...existing,
        ...input.title,
        id: titleId,
      };
      if (!merged.playthroughs.some((p) => p.id === merged.activePlaythroughId)) {
        throw new ConflictError('activePlaythroughId must exist in playthroughs', 'CONFLICT_ERROR');
      }
      const validated = titleDocSchema.parse(merged);

      const dataJson = serializeTitleData(validated);
      ctx.db
        .prepare('UPDATE titles SET data = ?, added_at = ?, updated_at = ? WHERE id = ?')
        .run(dataJson, validated.addedAt, validated.updatedAt, titleId);
      saveUpstream(ctx, validated);

      upserts.titles = {
        [titleId]: validated,
      };
    }

    const version = ctx.bumpVersionInTx();
    return {
      version,
      upserts,
      deletes,
    };
  });
}
