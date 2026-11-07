import { expect, test, vi } from 'vitest';
import { suggestBangumiMatches } from './bangumi.ts';
import { resolveBilibiliMetadata } from './bilibili.ts';
import { makeBaseTvTitle } from '../../src/domain/testFixtures.ts';
import type { LinkImportResult } from '../../src/domain/types.ts';
const result: LinkImportResult = { kind: 'tmdb-suggestion', title: 'Bilibili-only show', posterUrl: null, overview: '', sourceUrl: 'https://www.bilibili.com/bangumi/play/ss123', year: null, runtimeMin: null, episodes: [{ name: 'Opening', sourceVideoId: '1' }], fallbackUsed: 'bilibili' };
test('bangumi automatically searches TMDB and returns matches for selection', async () => {
  const title = makeBaseTvTitle();
  const match = { ...title, sourceId: '1', mediaType: 'tv' as const };
  const search = vi.fn().mockResolvedValue([match]);
  expect(await suggestBangumiMatches(result, search)).toMatchObject({ kind: 'tmdb-suggestion', tmdbMatches: [match] });
  expect(search).toHaveBeenCalledWith(result.title);
});
test('bangumi defaults to link import without a match or when TMDB is unavailable', async () => {
  for (const search of [vi.fn().mockResolvedValue([]), vi.fn().mockRejectedValue(new Error('TMDB_NOT_CONFIGURED'))]) {
    expect(await suggestBangumiMatches(result, search)).toMatchObject({ kind: 'playlist', episodes: result.episodes });
  }
});
test('Bilibili dates and year use Asia/Shanghai across midnight and New Year', async () => {
  const data = await resolveBilibiliMetadata('https://www.bilibili.com/video/BV1bK411W797', {
    lookupFn: async () => [{ address: '93.184.216.34' }],
    fetchFn: async () => Response.json({ code: 0, data: {
      bvid: 'BV1bK411W797', title: 'Night', pubdate: Date.parse('2023-12-31T17:00:00Z') / 1000,
      pages: [{ page: 1, part: 'First' }, { page: 2, part: 'Second' }],
    } }),
  });
  expect(data?.year).toBe(2024); expect(data?.episodes[0].airDate).toBe('2024-01-01');
});
