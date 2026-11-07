import { afterEach, expect, test, vi } from 'vitest';
import { fetchTmdbTitleDetails } from './tmdb.ts';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
test('failed season requests are explicitly reported, never presented as a complete response', async () => {
  vi.stubEnv('TMDB_READ_TOKEN', 'fixture-token');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const fetchFn: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('/season/2')) return new Response('{}', { status: 503 });
    if (url.includes('/season/1')) return Response.json({ episodes: [{ episode_number: 1 }] });
    return Response.json({ id: 1, name: 'Test', seasons: [{ season_number: 1 }, { season_number: 2 }] });
  };
  const result = await fetchTmdbTitleDetails('tv', '1', { fetchFn });
  expect(result.failedSeasons).toEqual([2]);
  expect(result.seasons.map((s) => s.seasonNumber)).toEqual([1]);
});
