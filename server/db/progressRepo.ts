import type { ProgressDoc, StateMutationResult } from '../../src/domain/types.ts';
import { type DbContext, NotFoundError, type StoredProgressData } from './types.ts';

export function putProgress(
  ctx: DbContext,
  titleId: string,
  playthroughId: string,
  input: { watched: Record<string, number>; movieWatchedAt?: number }
): StateMutationResult {
  return ctx.runInTransaction(() => {
    const exists = ctx.db.prepare('SELECT 1 FROM titles WHERE id = ?').get(titleId);
    if (!exists) {
      throw new NotFoundError(`Title not found: ${titleId}`, 'TITLE_NOT_FOUND');
    }

    const previousRow = ctx.db.prepare('SELECT data FROM progress WHERE title_id = ? AND playthrough_id = ?').get(titleId, playthroughId) as { data: string } | undefined;
    const previous = previousRow ? JSON.parse(previousRow.data) as StoredProgressData : undefined;
    const payload: StoredProgressData = {
      archivedWatched: previous?.archivedWatched,
      watched: { ...(input.watched || {}) },
      ...(input.movieWatchedAt !== undefined ? { movieWatchedAt: input.movieWatchedAt } : {}),
    };

    ctx.db
      .prepare(
        `INSERT INTO progress (title_id, playthrough_id, data)
         VALUES (?, ?, ?)
         ON CONFLICT(title_id, playthrough_id) DO UPDATE SET data = excluded.data`
      )
      .run(titleId, playthroughId, JSON.stringify(payload));

    const doc: ProgressDoc = {
      playthroughId,
      watched: payload.watched,
          archivedWatched: payload.archivedWatched,
      ...(payload.movieWatchedAt !== undefined
        ? { movieWatchedAt: payload.movieWatchedAt }
        : {}),
    };

    const version = ctx.bumpVersionInTx();
    return {
      version,
      upserts: {
        progressByTitle: {
          [titleId]: {
            [playthroughId]: doc,
          },
        },
      },
      deletes: {},
    };
  });
}

export function patchProgress(
  ctx: DbContext,
  titleId: string,
  playthroughId: string,
  patch: {
    set?: Record<string, number>;
    unset?: string[];
    movieWatchedAt?: number | null;
  }
): StateMutationResult {
  return ctx.runInTransaction(() => {
    const exists = ctx.db.prepare('SELECT 1 FROM titles WHERE id = ?').get(titleId);
    if (!exists) {
      throw new NotFoundError(`Title not found: ${titleId}`, 'TITLE_NOT_FOUND');
    }

    const row = ctx.db
      .prepare('SELECT data FROM progress WHERE title_id = ? AND playthrough_id = ?')
      .get(titleId, playthroughId) as { data: string } | undefined;

    const current: StoredProgressData = row
      ? (JSON.parse(row.data) as StoredProgressData)
      : { watched: {} };

    const watched: Record<string, number> = { ...(current.watched || {}) };

    if (patch.set) {
      for (const [epKey, ts] of Object.entries(patch.set)) {
        watched[epKey] = ts;
      }
    }
    if (patch.unset) {
      for (const epKey of patch.unset) {
        delete watched[epKey];
      }
    }

    let movieWatchedAt = current.movieWatchedAt;
    if (patch.movieWatchedAt === null) {
      movieWatchedAt = undefined;
    } else if (typeof patch.movieWatchedAt === 'number') {
      movieWatchedAt = patch.movieWatchedAt;
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
         ON CONFLICT(title_id, playthrough_id) DO UPDATE SET data = excluded.data`
      )
      .run(titleId, playthroughId, JSON.stringify(updatedData));

    const doc: ProgressDoc = {
      playthroughId,
      watched: updatedData.watched,
          archivedWatched: updatedData.archivedWatched,
      ...(updatedData.movieWatchedAt !== undefined
        ? { movieWatchedAt: updatedData.movieWatchedAt }
        : {}),
    };

    const version = ctx.bumpVersionInTx();
    return {
      version,
      upserts: {
        progressByTitle: {
          [titleId]: {
            [playthroughId]: doc,
          },
        },
      },
      deletes: {},
    };
  });
}

export function deleteProgress(
  ctx: DbContext,
  titleId: string,
  playthroughId: string
): StateMutationResult {
  return ctx.runInTransaction(() => {
    ctx.db
      .prepare('DELETE FROM progress WHERE title_id = ? AND playthrough_id = ?')
      .run(titleId, playthroughId);
    const version = ctx.bumpVersionInTx();
    return {
      version,
      upserts: {},
      deletes: {
        progress: [{ titleId, playthroughId }],
      },
    };
  });
}
