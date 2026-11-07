import type { EpisodeMeta, ProgressDoc, SeasonDoc, TitleSource } from '../../src/domain/types.ts';
function cleanEpisode(source: TitleSource, ep: EpisodeMeta): EpisodeMeta {
  return source !== 'tmdb' && ep.airDate === '2020-01-01' ? { ...ep, airDate: null } : ep;
}
export function cleanLegacySeasons(source: TitleSource, seasons: SeasonDoc[]): SeasonDoc[] {
  return seasons.map(season => ({ ...season, episodes: season.episodes.map(ep => cleanEpisode(source, ep)) }));
}
export function cleanLegacyProgress(source: TitleSource, progress: ProgressDoc): ProgressDoc {
  return { ...progress, ...(progress.archivedWatched ? { archivedWatched: progress.archivedWatched.map(mark => ({ ...mark, episode: cleanEpisode(source, mark.episode) })) } : {}) };
}
