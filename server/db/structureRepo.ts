import { migrateWatched, planStructure, type StructurePreview } from '../../src/domain/structure.ts';
import type { StateMutationResult } from '../../src/domain/types.ts';
import { readProgress, readSeasons, writeMetadata } from './metadataRepo.ts';
import { getTitle } from './titlesRepo.ts';
import { ConflictError, NotFoundError, type DbContext } from './types.ts';

export function previewStructure(ctx: DbContext, id: string): StructurePreview {
  const title = getTitle(ctx, id);
  if (!title) throw new NotFoundError('TITLE_NOT_FOUND');
  if (!title.upstreamChange) throw new ConflictError('STRUCTURE_CONFLICT', 'STRUCTURE_CONFLICT');
  const local = readSeasons(ctx, id);
  const incoming = title.upstreamChange.seasons;
  const plan = planStructure(local, incoming);
  const progress = Object.values(readProgress(ctx, id)).map((doc) => migrateWatched(doc, local, incoming));
  return {
    version: ctx.getVersion(),
    signature: title.upstreamChange.signature,
    changes: [
      ...local
        .filter((s) => !s.episodes.length && !incoming.some((next) => next.seasonNumber === s.seasonNumber))
        .map((s) => ({ from: `s${s.seasonNumber}`, to: null })),
      ...incoming
        .filter((s) => !s.episodes.length && !local.some((old) => old.seasonNumber === s.seasonNumber))
        .map((s) => ({ from: null, to: `s${s.seasonNumber}` })),
      ...plan.moved.map((m) => ({ from: m.from.key, to: m.to.key })),
      ...plan.removed.map((ep) => ({ from: ep.key, to: null })),
      ...plan.added.map((ep) => ({ from: null, to: ep.key })),
    ],
    migrated: progress.reduce((sum, doc) => sum + Object.keys(doc.watched).length, 0),
    archived: progress.reduce((sum, doc) => sum + (doc.archivedWatched?.length || 0), 0),
  };
}

export function decideStructure(
  ctx: DbContext,
  id: string,
  decision: 'keep' | 'adopt',
  version: number,
  signature: string,
): StateMutationResult {
  return ctx.runInTransaction(() => {
    const title = getTitle(ctx, id);
    if (!title) throw new NotFoundError('TITLE_NOT_FOUND');
    const change = title.upstreamChange;
    if (
      !change ||
      change.signature !== signature ||
      ctx.getVersion() !== version ||
      (decision === 'adopt' && title.structureLocked)
    ) {
      throw new ConflictError('STRUCTURE_CONFLICT', 'STRUCTURE_CONFLICT');
    }
    const local = readSeasons(ctx, id);
    const target = decision === 'adopt' ? change.seasons : local;
    const progress = Object.fromEntries(
      Object.entries(readProgress(ctx, id)).map(([key, doc]) => [
        key,
        decision === 'adopt' ? migrateWatched(doc, local, target) : doc,
      ]),
    );
    const next = {
      ...title,
      upstreamChange: null,
      ignoredStructure: decision === 'keep' ? signature : null,
      updatedAt: Date.now(),
    };
    if (decision === 'adopt' && next.resume?.episodeKey) {
      const targetKey = planStructure(local, target).matches.find((m) => m.from.key === next.resume?.episodeKey)?.to
        .key;
      next.resume = targetKey ? { ...next.resume, episodeKey: targetKey } : null;
    }
    return writeMetadata(ctx, next, target, progress);
  });
}

export function convertToManual(ctx: DbContext, id: string): StateMutationResult {
  return ctx.runInTransaction(() => {
    const title = getTitle(ctx, id);
    if (!title) throw new NotFoundError('TITLE_NOT_FOUND');
    return writeMetadata(
      ctx,
      {
        ...title,
        source: 'custom',
        sourceId: null,
        sourceUnavailable: false,
        upstreamChange: null,
        ignoredStructure: null,
        structureLocked: false,
        updatedAt: Date.now(),
      },
      readSeasons(ctx, id),
    );
  });
}
