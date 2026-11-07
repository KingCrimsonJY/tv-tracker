import type { EpisodeMeta } from '../../domain/types';
export const EPISODE_RANGE_SIZE = 50;
export function initialEpisodeRange(
  episodes: EpisodeMeta[],
  watched: Record<string, number>,
  highlight: string | null,
): number {
  const highlighted = highlight ? episodes.findIndex((episode) => episode.key === highlight) : -1;
  const next = highlighted >= 0 ? highlighted : episodes.findIndex((episode) => !watched[episode.key]);
  return Math.floor(Math.max(0, next) / EPISODE_RANGE_SIZE);
}
