import { readUpstream } from './upstreamStorage.ts';
import {
  migrateWatched,
  planStructure,
  type StructureReference,
  type StructurePreview,
} from '../../src/domain/structure.ts';
import type { EpisodeMeta, SeasonDoc, StateMutationResult } from '../../src/domain/types.ts';
import { readProgress, readSeasons, writeMetadata } from './metadataRepo.ts';
import { getTitle } from './titlesRepo.ts';
import { ConflictError, NotFoundError, type DbContext } from './types.ts';

function reference(seasons: SeasonDoc[], episode: EpisodeMeta): StructureReference {
  return {
    seasonNumber: seasons.find((season) => season.episodes.includes(episode))?.seasonNumber ?? 1,
    episodeNumber: episode.number,
    name: episode.name,
  };
}

export function previewStructure(ctx: DbContext, id: string): StructurePreview {
  const title = getTitle(ctx, id);
  if (!title) throw new NotFoundError('TITLE_NOT_FOUND');
  if (!title.upstreamChange) throw new ConflictError('STRUCTURE_CONFLICT', 'STRUCTURE_CONFLICT');
  const local = readSeasons(ctx, id);
  const incoming = readUpstream(ctx, id);
  const plan = planStructure(local, incoming);
  const progress = Object.values(readProgress(ctx, id)).map((doc) => migrateWatched(doc, local, incoming));
  return {
    version: ctx.getVersion(),
    signature: title.upstreamChange.signature,
    localSeasons: local.filter((s) => s.seasonNumber > 0).length,
    sourceSeasons: incoming.filter((s) => s.seasonNumber > 0).length,
    changes: [
      ...local
        .filter((s) => !s.episodes.length && !incoming.some((next) => next.seasonNumber === s.seasonNumber))
        .map((s) => ({ from: { seasonNumber: s.seasonNumber, name: s.name }, to: null })),
      ...incoming
        .filter((s) => !s.episodes.length && !local.some((old) => old.seasonNumber === s.seasonNumber))
        .map((s) => ({ from: null, to: { seasonNumber: s.seasonNumber, name: s.name } })),
      ...plan.moved.map((m) => ({ from: reference(local, m.from), to: reference(incoming, m.to) })),
      ...plan.removed.map((ep) => ({ from: reference(local, ep), to: null })),
      ...plan.added.map((ep) => ({ from: null, to: reference(incoming, ep) })),
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
    const target = decision === 'adopt' ? readUpstream(ctx, id) : local;
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
