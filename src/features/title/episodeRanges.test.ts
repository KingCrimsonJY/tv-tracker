import { expect, test } from 'vitest';
import { initialEpisodeRange } from './episodeRanges';
import type { EpisodeMeta } from '../../domain/types';
const episodes: EpisodeMeta[] = Array.from({ length: 564 }, (_, index) => ({
  number: index + 1,
  key: 's1e' + (index + 1),
  name: null,
  overview: {},
  stillPath: null,
  airDate: null,
  runtime: null,
}));
test('opens the range containing the next episode and gives deep links priority', () => {
  const watched = Object.fromEntries(episodes.slice(0, 120).map((ep) => [ep.key, 1]));
  expect(initialEpisodeRange(episodes, watched, null)).toBe(2);
  expect(initialEpisodeRange(episodes, watched, 's1e564')).toBe(11);
  expect(initialEpisodeRange(episodes, Object.fromEntries(episodes.map((ep) => [ep.key, 1])), null)).toBe(0);
});
