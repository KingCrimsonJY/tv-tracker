import type { ArchivedWatch, EpisodeMeta, ProgressDoc, SeasonDoc } from './types.ts';

export const flattenEpisodes = (seasons: SeasonDoc[]): EpisodeMeta[] =>
  [...seasons]
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .flatMap((s) => [...s.episodes].sort((a, b) => a.number - b.number));

export function episodeIdentity(ep: EpisodeMeta): string | null {
  if (ep.tmdbEpisodeId) return `tmdb:${ep.tmdbEpisodeId}`;
  return ep.sourceVideoId ? `video:${ep.sourceVideoId}` : null;
}

export function structureSignature(seasons: SeasonDoc[]): string {
  return JSON.stringify(
    [...seasons]
      .sort((a, b) => a.seasonNumber - b.seasonNumber)
      .map((s) => [
        s.seasonNumber,
        [...s.episodes].sort((a, b) => a.number - b.number).map((ep) => [ep.key, episodeIdentity(ep), ep.airDate]),
      ]),
  );
}

function mergeEpisode(local: EpisodeMeta, incoming: EpisodeMeta): EpisodeMeta {
  return {
    ...local,
    ...incoming,
    key: local.key,
    number: local.number,
    tmdbEpisodeId: incoming.tmdbEpisodeId ?? local.tmdbEpisodeId,
    sourceVideoId: incoming.sourceVideoId ?? local.sourceVideoId,
    name: incoming.name ? { ...local.name, ...incoming.name } : local.name,
    overview: {
      ...local.overview,
      ...Object.fromEntries(Object.entries(incoming.overview).filter(([, value]) => value)),
    },
    airDate: incoming.airDate ?? local.airDate,
    runtime: incoming.runtime ?? local.runtime,
    stillPath: incoming.stillPath || local.stillPath,
  };
}

export interface EpisodeMatch {
  from: EpisodeMeta;
  to: EpisodeMeta;
  method: 'id' | 'date' | 'legacy';
}
export function matchEpisodes(local: EpisodeMeta[], incoming: EpisodeMeta[]): EpisodeMatch[] {
  const matches: EpisodeMatch[] = [];
  const usedLocal = new Set<EpisodeMeta>();
  const usedIncoming = new Set<EpisodeMeta>();
  const match = (from: EpisodeMeta, to: EpisodeMeta, method: EpisodeMatch['method']) => {
    matches.push({ from, to, method });
    usedLocal.add(from);
    usedIncoming.add(to);
  };
  for (const from of local) {
    const identity = episodeIdentity(from);
    const to = identity && incoming.find((ep) => !usedIncoming.has(ep) && episodeIdentity(ep) === identity);
    if (to) match(from, to, 'id');
  }
  // Iteration is in season/episode order, disambiguating episodes sharing an air date.
  for (const from of local) {
    if (usedLocal.has(from) || !from.airDate) continue;
    const to = incoming.find((ep) => !usedIncoming.has(ep) && ep.airDate === from.airDate);
    if (to) match(from, to, 'date');
  }
  for (const from of local) {
    if (usedLocal.has(from) || episodeIdentity(from)) continue;
    const to = incoming.find(
      (ep) =>
        !usedIncoming.has(ep) &&
        ep.key === from.key &&
        (from.airDate
          ? ep.airDate === from.airDate
          : Boolean(from.name) && JSON.stringify(ep.name) === JSON.stringify(from.name)),
    );
    if (to) match(from, to, 'legacy');
  }
  return matches;
}

export function planStructure(local: SeasonDoc[], incoming: SeasonDoc[], locked = false) {
  const oldEpisodes = flattenEpisodes(local);
  const newEpisodes = flattenEpisodes(incoming);
  const matches = matchEpisodes(oldEpisodes, newEpisodes);
  const matchedOld = new Set(matches.map((m) => m.from));
  const matchedNew = new Set(matches.map((m) => m.to));
  const removed = oldEpisodes.filter((ep) => !matchedOld.has(ep));
  const added = newEpisodes.filter((ep) => !matchedNew.has(ep));
  const moved = matches.filter(
    (m) =>
      m.from.key !== m.to.key ||
      (episodeIdentity(m.from) && episodeIdentity(m.to) && episodeIdentity(m.from) !== episodeIdentity(m.to)),
  );
  const missingSeason = local.some((s) => !incoming.some((next) => next.seasonNumber === s.seasonNumber));
  const newSeason = incoming.some((s) => !local.some((old) => old.seasonNumber === s.seasonNumber));
  const destructive = missingSeason || removed.length > 0 || moved.length > 0;
  const changed = destructive || newSeason || added.length > 0;
  const byOld = new Map(matches.map((m) => [m.from, m]));
  const safe: SeasonDoc[] = local.map((season) => ({
    ...season,
    name: incoming.find((next) => next.seasonNumber === season.seasonNumber)?.name || season.name,
    posterPath: incoming.find((next) => next.seasonNumber === season.seasonNumber)?.posterPath || season.posterPath,
    airDate: incoming.find((next) => next.seasonNumber === season.seasonNumber)?.airDate || season.airDate,
    episodes: season.episodes.map((ep) => {
      const mapping = byOld.get(ep);
      if (
        !mapping ||
        (mapping.method !== 'id' && (mapping.from.key !== mapping.to.key || Boolean(episodeIdentity(mapping.from))))
      )
        return ep;
      return mergeEpisode(ep, mapping.to);
    }),
  }));
  if (locked) {
    const identities = new Set(oldEpisodes.map(episodeIdentity).filter(Boolean));
    const additions = newEpisodes
      .filter((ep) => {
        const id = episodeIdentity(ep);
        return id ? !identities.has(id) : added.includes(ep);
      })
      .sort((a, b) => (a.airDate || '9999').localeCompare(b.airDate || '9999'));
    let target = [...safe].sort((a, b) => b.seasonNumber - a.seasonNumber)[0];
    if (!target && additions.length) {
      target = { seasonNumber: 1, name: null, episodes: [] };
      safe.push(target);
    }
    if (target) {
      let number = Math.max(0, ...target.episodes.map((ep) => ep.number));
      for (const episode of additions) {
        const identity = episodeIdentity(episode);
        if (identity && identities.has(identity)) continue;
        if (identity) identities.add(identity);
        number++;
        target.episodes.push({ ...episode, number, key: 's' + target.seasonNumber + 'e' + number });
      }
    }
  } else {
    for (const season of incoming) {
      let target = safe.find((s) => s.seasonNumber === season.seasonNumber);
      const additions = season.episodes.filter((ep) => added.includes(ep));
      if (!target && (additions.length || season.episodes.length === 0)) {
        target = { ...season, episodes: [] };
        safe.push(target);
      }
      if (target) {
        const occupied = new Set(target.episodes.map((ep) => ep.number));
        let next = Math.max(0, ...occupied);
        for (const ep of additions) {
          const number = occupied.has(ep.number) ? ++next : ep.number;
          next = Math.max(next, number);
          occupied.add(number);
          target.episodes.push({ ...ep, number, key: `s${season.seasonNumber}e${number}` });
        }
        target.episodes.sort((a, b) => a.number - b.number);
      }
    }
  }
  return {
    safe: safe.sort((a, b) => a.seasonNumber - b.seasonNumber),
    matches,
    removed,
    added,
    moved,
    destructive,
    changed,
  };
}

export function migrateWatched(progress: ProgressDoc, local: SeasonDoc[], incoming: SeasonDoc[]): ProgressDoc {
  const oldEpisodes = flattenEpisodes(local);
  const newEpisodes = flattenEpisodes(incoming);
  const mappings = matchEpisodes(oldEpisodes, newEpisodes);
  const byKey = new Map(mappings.map((m) => [m.from.key, m.to.key]));
  const oldByKey = new Map(oldEpisodes.map((ep) => [ep.key, ep]));
  const watched: Record<string, number> = {};
  const archived: ArchivedWatch[] = [...(progress.archivedWatched || [])];
  for (const [key, watchedAt] of Object.entries(progress.watched)) {
    const target = byKey.get(key);
    if (target) {
      watched[target] = Math.max(watched[target] || 0, watchedAt);
      continue;
    }
    const episode = oldByKey.get(key);
    if (episode) archived.push({ episode, watchedAt });
    else
      archived.push({
        watchedAt,
        episode: {
          key,
          number: Number(key.match(/e(\d+)$/)?.[1]) || 1,
          name: null,
          airDate: null,
          runtime: null,
          stillPath: null,
          overview: {},
        },
      });
  }
  return restoreArchivedWatched({ ...progress, watched, archivedWatched: archived }, incoming);
}

/** Automatic refresh never remaps current marks; only explicitly adopted structures do. */
export function restoreArchivedWatched(progress: ProgressDoc, seasons: SeasonDoc[]): ProgressDoc {
  const newEpisodes = flattenEpisodes(seasons);
  const watched = { ...progress.watched };
  const used = new Set(Object.keys(watched));
  const retained: ArchivedWatch[] = [];
  for (const mark of progress.archivedWatched || []) {
    const identity = episodeIdentity(mark.episode);
    const target = identity
      ? newEpisodes.find((ep) => episodeIdentity(ep) === identity && !used.has(ep.key))
      : newEpisodes.find((ep) => !used.has(ep.key) && ep.airDate && ep.airDate === mark.episode.airDate);
    if (target) {
      watched[target.key] = mark.watchedAt;
      used.add(target.key);
    } else retained.push(mark);
  }
  return { ...progress, watched, archivedWatched: retained };
}

export interface StructureReference {
  seasonNumber: number;
  episodeNumber?: number;
  name: EpisodeMeta['name'];
}
export interface StructurePreview {
  version: number;
  signature: string;
  localSeasons: number;
  sourceSeasons: number;
  changes: { from: StructureReference | null; to: StructureReference | null }[];
  migrated: number;
  archived: number;
}
