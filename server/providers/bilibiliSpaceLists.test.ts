import { describe, expect, test } from 'vitest';
import { resolveBilibiliMetadata } from './bilibili.ts';
import { normalizeLinkUrl } from './linkUrls.ts';
import type { FetchFn } from '../security/ssrf.ts';

const lookupFn = async () => [{ address: '93.184.216.34' }];
const reply = (data: unknown) => Response.json({ code: 0, data });
const archive = (index: number) => ({
  bvid: 'BV' + index,
  title: 'Video ' + index,
  duration: 120,
  pubdate: 1700000000,
});

/**
 * Mirrors the real API: neither endpoint checks `mid`. Collection 1528929 belongs to another uploader, while
 * series 1528929 belongs to uploader 88461692 (the case that used to import a stranger's collection).
 */
function fakeBilibili(options: { seasonOwner?: string; seriesOwner?: string } = {}) {
  const calls: string[] = [];
  const fetchFn: FetchFn = async (input) => {
    const url = new URL(input);
    calls.push(url.pathname);
    const mid = url.searchParams.get('mid');
    if (url.pathname.endsWith('/seasons_archives_list')) {
      return reply({
        meta: { mid: Number(options.seasonOwner ?? '3461583176993363'), name: 'Someone else', total: 1 },
        page: { page_num: 1, page_size: 100, total: 1 },
        archives: [archive(900)],
      });
    }
    if (url.pathname.endsWith('/series/series')) {
      return reply({
        meta: { series_id: 1528929, mid: Number(options.seriesOwner ?? '88461692'), name: 'Deep Learning' },
      });
    }
    if (url.pathname.endsWith('/series/archives')) {
      const owned = mid === (options.seriesOwner ?? '88461692');
      return reply({
        page: { num: 1, size: 100, total: owned ? 5 : 0 },
        archives: owned ? Array.from({ length: 5 }, (_, index) => archive(index + 1)) : null,
      });
    }
    return Response.json({ code: -404 });
  };
  return { calls, deps: { lookupFn, fetchFn } };
}

describe('Bilibili uploader lists', () => {
  test('a player link without a type never imports another uploader collection with the same id', async () => {
    const { deps } = fakeBilibili();
    const normalized = await normalizeLinkUrl('https://www.bilibili.com/list/88461692?sid=1528929', deps);
    expect(normalized).toBe('https://space.bilibili.com/88461692/lists/1528929');
    const result = await resolveBilibiliMetadata(normalized, deps);
    expect(result).toMatchObject({
      kind: 'playlist',
      title: 'Deep Learning',
      sourceUrl: 'https://space.bilibili.com/88461692/lists/1528929?type=series',
    });
    expect(result?.episodes.map((episode) => episode.sourceVideoId)).toEqual(['BV1', 'BV2', 'BV3', 'BV4', 'BV5']);
  });

  test.each([
    'https://space.bilibili.com/88461692/lists/1528929?type=series',
    'https://space.bilibili.com/88461692/channel/seriesdetail?sid=1528929',
    'https://space.bilibili.com/88461692/lists/1528929',
  ])('every series link form resolves to the same canonical source: %s', async (link) => {
    const { deps } = fakeBilibili();
    const result = await resolveBilibiliMetadata(link, deps);
    expect(result?.sourceUrl).toBe('https://space.bilibili.com/88461692/lists/1528929?type=series');
    expect(result?.episodes).toHaveLength(5);
  });

  test('a declared series skips the collection endpoint entirely', async () => {
    const { calls, deps } = fakeBilibili();
    await resolveBilibiliMetadata('https://space.bilibili.com/88461692/lists/1528929?type=series', deps);
    expect(calls.some((path) => path.endsWith('/seasons_archives_list'))).toBe(false);
  });

  test.each([
    'https://space.bilibili.com/946974/lists/2443008?type=season',
    'https://space.bilibili.com/946974/channel/collectiondetail?sid=2443008',
    'https://space.bilibili.com/946974/lists/2443008',
  ])('every collection link form resolves to the same canonical source: %s', async (link) => {
    const { calls, deps } = fakeBilibili({ seasonOwner: '946974', seriesOwner: '35212306' });
    const result = await resolveBilibiliMetadata(link, deps);
    expect(result).toMatchObject({
      title: 'Someone else',
      sourceUrl: 'https://space.bilibili.com/946974/lists/2443008?type=season',
    });
    expect(calls.some((path) => path.includes('/series/'))).toBe(false);
  });

  test('an id owned by other uploaders in both id spaces is unavailable, not imported', async () => {
    const { deps } = fakeBilibili({ seasonOwner: '111', seriesOwner: '222' });
    for (const suffix of ['', '?type=season', '?type=series']) {
      await expect(
        resolveBilibiliMetadata('https://space.bilibili.com/88461692/lists/1528929' + suffix, deps),
      ).rejects.toMatchObject({ code: 'LINK_UNAVAILABLE' });
    }
  });

  test('a mistyped link still finds the list in the other id space', async () => {
    const { deps } = fakeBilibili();
    const result = await resolveBilibiliMetadata('https://space.bilibili.com/88461692/lists/1528929?type=season', deps);
    expect(result?.sourceUrl).toBe('https://space.bilibili.com/88461692/lists/1528929?type=series');
  });
});
