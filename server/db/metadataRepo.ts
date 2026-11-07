import type { SeasonDoc, StateMutationResult, TitleDoc, TmdbDetails } from '../../src/domain/types.ts';
import { restoreArchivedWatched, planStructure, structureSignature } from '../../src/domain/structure.ts';
import type { ProgressDoc } from '../../src/domain/types.ts';
import { getTitle } from './titlesRepo.ts';
import { ConflictError, NotFoundError, serializeTitleData, type DbContext } from './types.ts';

export function mergeMetadata(local: TitleDoc, incoming: TitleDoc, now: number): TitleDoc {
  const zh =
    incoming.names.zh && incoming.names.zh !== incoming.names.original
      ? incoming.names.zh
      : local.names.zh || incoming.names.zh;
  return {
    ...local,
    names: {
      ...local.names,
      original: incoming.names.original || local.names.original,
      zh,
      en: incoming.names.en || local.names.en,
    },
    year: incoming.year ?? local.year,
    releaseDate: incoming.releaseDate ?? local.releaseDate,
    runtimeMin: incoming.runtimeMin ?? local.runtimeMin,
    genres: incoming.genres.length ? incoming.genres : local.genres,
    genreIds: incoming.genreIds?.length ? incoming.genreIds : local.genreIds,
    posterPath: incoming.posterPath || local.posterPath,
    posters: {
      ...local.posters,
      ...Object.fromEntries(Object.entries(incoming.posters || {}).filter(([, value]) => value)),
    },
    backdropPath: incoming.backdropPath || local.backdropPath,
    overview: { zh: incoming.overview.zh || local.overview.zh, en: incoming.overview.en || local.overview.en },
    showStatus: incoming.showStatus || local.showStatus,
    externalIds: {
      ...local.externalIds,
      ...Object.fromEntries(Object.entries(incoming.externalIds).filter(([, value]) => value)),
    },
    ratings: { ...local.ratings, ...incoming.ratings },
    metaFetchedAt: now,
    updatedAt: now,
  };
}

export function readSeasons(ctx: DbContext, id: string): SeasonDoc[] {
  const rows = ctx.db.prepare('SELECT data FROM seasons WHERE title_id = ? ORDER BY season_number').all(id) as {
    data: string;
  }[];
  return rows.map((row) => JSON.parse(row.data) as SeasonDoc);
}

export function readProgress(ctx: DbContext, id: string): Record<string, ProgressDoc> {
  const rows = ctx.db.prepare('SELECT playthrough_id, data FROM progress WHERE title_id = ?').all(id) as {
    playthrough_id: string;
    data: string;
  }[];
  return Object.fromEntries(
    rows.map((row) => [
      row.playthrough_id,
      { ...(JSON.parse(row.data) as Omit<ProgressDoc, 'playthroughId'>), playthroughId: row.playthrough_id },
    ]),
  );
}

export function writeMetadata(
  ctx: DbContext,
  title: TitleDoc,
  seasons: SeasonDoc[],
  progress?: Record<string, ProgressDoc>,
): StateMutationResult {
  ctx.db
    .prepare('UPDATE titles SET data = ?, updated_at = ? WHERE id = ?')
    .run(serializeTitleData(title), title.updatedAt, title.id);
  ctx.db.prepare('DELETE FROM seasons WHERE title_id = ?').run(title.id);
  const write = ctx.db.prepare('INSERT INTO seasons (title_id, season_number, data) VALUES (?, ?, ?)');
  for (const season of seasons) write.run(title.id, season.seasonNumber, JSON.stringify(season));
  if (progress) {
    const writeProgress = ctx.db.prepare('UPDATE progress SET data = ? WHERE title_id = ? AND playthrough_id = ?');
    for (const doc of Object.values(progress)) {
      const { playthroughId, ...data } = doc;
      writeProgress.run(JSON.stringify(data), title.id, playthroughId);
    }
  }
  return {
    version: ctx.bumpVersionInTx(),
    upserts: {
      titles: { [title.id]: title },
      seasonsByTitle: { [title.id]: seasons },
      ...(progress ? { progressByTitle: { [title.id]: progress } } : {}),
    },
    deletes: {},
  };
}

export function refreshMetadata(
  ctx: DbContext,
  id: string,
  data: TmdbDetails,
  now: number,
  relink = false,
): StateMutationResult {
  return ctx.runInTransaction(() => {
    const current = getTitle(ctx, id);
    if (!current) throw new NotFoundError('TITLE_NOT_FOUND');
    if (!relink && (current.source !== data.title.source || current.sourceId !== data.title.sourceId)) {
      throw new ConflictError('STRUCTURE_CONFLICT', 'STRUCTURE_CONFLICT');
    }
    const local = readSeasons(ctx, id);
    const plan = planStructure(local, data.seasons, current.structureLocked);
    const title = mergeMetadata(current, data.title, now);
    title.sourceUnavailable = false;
    if (current.source === 'url' && data.title.mediaType === 'other') title.mediaType = 'other';
    if (relink) {
      title.source = data.title.source;
      title.sourceId = data.title.sourceId;
      title.mediaType = data.title.mediaType;
      title.ignoredStructure = null;
    }
    if (!data.failedSeasons?.length) {
      const signature = structureSignature(data.seasons);
      title.upstreamChange =
        (current.structureLocked ? plan.removed.length > 0 : plan.destructive) && signature !== title.ignoredStructure
          ? { signature, seasons: data.seasons, fetchedAt: now }
          : null;
    }
    const progress = Object.fromEntries(
      Object.entries(readProgress(ctx, id)).map(([key, doc]) => [key, restoreArchivedWatched(doc, plan.safe)]),
    );
    return writeMetadata(ctx, title, plan.safe, progress);
  });
}
