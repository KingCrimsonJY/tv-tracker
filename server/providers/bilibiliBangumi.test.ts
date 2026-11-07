import { describe, expect, test } from 'vitest';
import { resolveBilibiliMetadata } from './bilibili.ts';

const lookupFn = async () => [{ address: '93.184.216.34' }];
const episodes = [
  { id: 10, title: '1', show_title: 'Episode 1', section_type: 0, duration: 1200000 },
  { id: 11, title: '2', show_title: 'Episode 2 preview', section_type: 1, duration: 31000 },
  { id: 12, title: '2', show_title: 'Episode 2', section_type: 0, duration: 1200000 },
  { id: 13, title: 'Extra', show_title: 'Behind the scenes', section_type: 2, duration: 60000 },
  { id: 14, title: '3', show_title: 'A story about a preview', duration: 1200000 },
];
const deps = (items = episodes) => ({
  lookupFn,
  fetchFn: async () =>
    Response.json({
      code: 0,
      result: {
        title: 'Series',
        season_id: 123,
        type: 1,
        episodes: items,
      },
    }),
});

describe('Bilibili bangumi episode selection', () => {
  test.each([false, true])('season imports exclude extras using section metadata (force=%s)', async (forceImport) => {
    const result = await resolveBilibiliMetadata('https://www.bilibili.com/bangumi/play/ss123', {
      ...deps(),
      forceImport,
    });
    expect(result?.episodes.map((ep) => ep.sourceVideoId)).toEqual(['10', '12', '14']);
    expect(result?.episodes.map((ep) => ep.name)).toEqual(['Episode 1', 'Episode 2', 'A story about a preview']);
  });

  test('an explicitly selected preview remains importable as a single video', async () => {
    const result = await resolveBilibiliMetadata('https://www.bilibili.com/bangumi/play/ep11', {
      ...deps(),
      forceImport: true,
    });
    expect(result).toMatchObject({ kind: 'video', title: 'Series · Episode 2 preview', runtimeMin: 1, episodes: [] });
  });

  test('episode suggestions keep the episode name and a separate series title', async () => {
    const result = await resolveBilibiliMetadata('https://www.bilibili.com/bangumi/play/ep10', deps());
    expect(result).toMatchObject({ kind: 'tmdb-suggestion', title: 'Series · Episode 1', seriesTitle: 'Series' });
  });

  test('a season with only promotional entries is not reported as a complete work', async () => {
    await expect(
      resolveBilibiliMetadata('https://www.bilibili.com/bangumi/play/ss123', {
        ...deps([episodes[1], episodes[3]]),
        forceImport: true,
      }),
    ).rejects.toMatchObject({ code: 'LINK_EMPTY_PLAYLIST' });
  });

  test('movie imports use one edition duration rather than adding dubbed editions', async () => {
    const result = await resolveBilibiliMetadata('https://www.bilibili.com/bangumi/play/ss123', {
      lookupFn,
      forceImport: true,
      fetchFn: async () =>
        Response.json({
          code: 0,
          result: {
            title: 'Movie',
            season_id: 123,
            type: 2,
            episodes: [
              { id: 20, title: 'Original', duration: 7260000, section_type: 0 },
              { id: 21, title: 'Dubbed', duration: 7260000, section_type: 0 },
            ],
          },
        }),
    });
    expect(result).toMatchObject({ mediaType: 'movie', runtimeMin: 121 });
  });

  test('course lessons are not filtered by bangumi section markers', async () => {
    const result = await resolveBilibiliMetadata('https://www.bilibili.com/cheese/play/ss123', deps());
    expect(result?.episodes).toHaveLength(5);
  });
});
