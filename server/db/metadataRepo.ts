import type { SeasonDoc, StateMutationResult, TitleDoc, TmdbDetails } from '../../src/domain/types.ts';
import { getTitle } from './titlesRepo.ts';
import { NotFoundError, serializeTitleData, type DbContext } from './types.ts';

export function mergeMetadata(local: TitleDoc, incoming: TitleDoc, now: number): TitleDoc {
  const zh = incoming.names.zh && incoming.names.zh !== incoming.names.original
    ? incoming.names.zh : local.names.zh || incoming.names.zh;
  return {
    ...local,
    names: { ...local.names, original: incoming.names.original, zh, en: incoming.names.en || local.names.en },
    year: incoming.year ?? local.year,
    releaseDate: incoming.releaseDate ?? local.releaseDate,
    runtimeMin: incoming.runtimeMin ?? local.runtimeMin,
    genres: incoming.genres.length ? incoming.genres : local.genres,
    genreIds: incoming.genreIds?.length ? incoming.genreIds : local.genreIds,
    posterPath: incoming.posterPath || local.posterPath,
    posters: { ...local.posters, ...Object.fromEntries(Object.entries(incoming.posters || {}).filter(([, value]) => value)) },
    backdropPath: incoming.backdropPath || local.backdropPath,
    overview: { zh: incoming.overview.zh || local.overview.zh, en: incoming.overview.en || local.overview.en },
    showStatus: incoming.showStatus || local.showStatus,
    externalIds: { ...local.externalIds, ...incoming.externalIds },
    ratings: { ...local.ratings, ...incoming.ratings },
    metaFetchedAt: now, updatedAt: now,
  };
}

// Preserve local rows absent from a response, including failed season requests.
export function mergeSeasonAdditions(local: SeasonDoc[], incoming: SeasonDoc[]): SeasonDoc[] {
  const result = new Map(local.map(season => [season.seasonNumber, season]));
  for (const season of incoming) {
    const previous = result.get(season.seasonNumber);
    const episodes = new Map(previous?.episodes.map(ep => [ep.key, ep]));
    for (const ep of season.episodes) episodes.set(ep.key, { ...episodes.get(ep.key), ...ep });
    result.set(season.seasonNumber, { ...previous, ...season, episodes: [...episodes.values()].sort((a, b) => a.number - b.number) });
  }
  return [...result.values()].sort((a, b) => a.seasonNumber - b.seasonNumber);
}

export function refreshMetadata(ctx: DbContext, id: string, data: TmdbDetails, now: number): StateMutationResult {
  return ctx.runInTransaction(() => {
    const current = getTitle(ctx, id);
    if (!current) throw new NotFoundError('TITLE_NOT_FOUND');
    const rows = ctx.db.prepare('SELECT data FROM seasons WHERE title_id = ? ORDER BY season_number').all(id) as { data: string }[];
    const seasons = mergeSeasonAdditions(rows.map(row => JSON.parse(row.data) as SeasonDoc), data.seasons);
    const title = mergeMetadata(current, data.title, now);
    ctx.db.prepare('UPDATE titles SET data = ?, updated_at = ? WHERE id = ?').run(serializeTitleData(title), now, id);
    const write = ctx.db.prepare('INSERT INTO seasons (title_id, season_number, data) VALUES (?, ?, ?) ON CONFLICT(title_id, season_number) DO UPDATE SET data = excluded.data');
    for (const season of seasons) write.run(id, season.seasonNumber, JSON.stringify(season));
    return { version: ctx.bumpVersionInTx(), upserts: { titles: { [id]: title }, seasonsByTitle: { [id]: seasons } }, deletes: {} };
  });
}
