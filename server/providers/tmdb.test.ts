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

test('a Chinese-language original keeps its own title instead of another Chinese edition', async () => {
  vi.stubEnv('TMDB_READ_TOKEN', 'fixture-token');
  const translations = {
    translations: [
      { iso_639_1: 'zh', iso_3166_1: 'TW', data: { title: '\u8b93\u5b50\u5f48\u98db' } },
      { iso_639_1: 'zh', iso_3166_1: 'CN', data: { title: '' } },
    ],
  };
  const detail = (extra: object) => async () =>
    Response.json({
      id: 1,
      original_title: '\u8ba9\u5b50\u5f39\u98de',
      title: '\u8ba9\u5b50\u5f39\u98de',
      translations,
      ...extra,
    });

  const chinese = await fetchTmdbTitleDetails('movie', '51533', { fetchFn: detail({ original_language: 'zh' }) });
  expect(chinese.title.names.zh).toBe('\u8ba9\u5b50\u5f39\u98de');
});

test('a foreign work without a zh-CN title prefers the Chinese edition closest to Simplified', async () => {
  vi.stubEnv('TMDB_READ_TOKEN', 'fixture-token');
  const fetchFn: typeof fetch = async () =>
    Response.json({
      id: 2,
      original_language: 'en',
      original_title: 'Severance',
      title: 'Severance',
      translations: {
        translations: [
          { iso_639_1: 'zh', iso_3166_1: 'TW', data: { title: 'TW title' } },
          { iso_639_1: 'zh', iso_3166_1: 'SG', data: { title: 'SG title' } },
        ],
      },
    });
  expect((await fetchTmdbTitleDetails('movie', '2', { fetchFn })).title.names.zh).toBe('SG title');
});
