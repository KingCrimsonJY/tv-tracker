import { describe, expect, test, vi } from 'vitest';
import { resolveBilibiliMetadata } from './bilibili.ts';
import { resolveLinkMetadata } from './linkImport.ts';
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

describe('a list owned by another uploader is never handed to yt-dlp', () => {
  // yt-dlp reads the same endpoints, which do not compare the uploader: it would return the stranger's list.
  test('when both id spaces answer with other owners', async () => {
    const { deps } = fakeBilibili({ seasonOwner: '222', seriesOwner: '333' });
    const execFn = vi.fn();
    await expect(
      resolveLinkMetadata('https://space.bilibili.com/111/lists/456?type=season', { ...deps, execFn }),
    ).rejects.toMatchObject({ code: 'LINK_UNAVAILABLE' });
    expect(execFn).not.toHaveBeenCalled();
  });

  test('when the collection is someone else’s and the series lookup fails', async () => {
    const { deps } = fakeBilibili({ seasonOwner: '222' });
    const fetchFn: FetchFn = (input, init) =>
      new URL(input).pathname.includes('/series/')
        ? Promise.resolve(Response.json({ code: -404, message: 'not found' }))
        : deps.fetchFn(input, init);
    const execFn = vi.fn();
    await expect(
      resolveLinkMetadata('https://space.bilibili.com/111/lists/457?type=season', { ...deps, fetchFn, execFn }),
    ).rejects.toMatchObject({ code: 'LINK_UNAVAILABLE' });
    expect(execFn).not.toHaveBeenCalled();
  });
});

describe('yt-dlp standing in for a rate-limited Bilibili API', () => {
  // The API refuses every call (risk control), so the link goes to yt-dlp, which names the real owner.
  const rateLimited: FetchFn = async () => Response.json({ code: -412, message: 'request was banned' });
  const collection = (uploaderId: string | undefined) => ({
    _type: 'playlist',
    title: 'Q&A',
    extractor_key: 'BilibiliCollectionList',
    webpage_url: 'https://space.bilibili.com/946974/lists/2443008?type=season',
    ...(uploaderId ? { uploader_id: uploaderId } : {}),
    entries: [
      { id: 'BV1xx411c7mD', title: 'One', url: 'https://www.bilibili.com/video/BV1xx411c7mD', ie_key: 'BiliBili' },
    ],
  });
  const resolve = (mid: string, uploaderId: string | undefined) =>
    resolveLinkMetadata(`https://space.bilibili.com/${mid}/lists/2443008?type=season`, {
      lookupFn,
      fetchFn: rateLimited,
      execFn: async () => ({ stdout: JSON.stringify(collection(uploaderId)), stderr: '' }),
    });

  test('its list is imported when the owner it reports is the uploader in the link', async () => {
    await expect(resolve('946974', '946974')).resolves.toMatchObject({ kind: 'playlist', title: 'Q&A' });
  });

  test('its list is refused when it belongs to someone else, or when it does not say whose it is', async () => {
    await expect(resolve('88461692', '946974')).rejects.toMatchObject({ code: 'LINK_UNAVAILABLE' });
    await expect(resolve('946974', undefined)).rejects.toMatchObject({ code: 'LINK_UNAVAILABLE' });
  });
});

describe('the old player address of an uploader list', () => {
  const legacy = (mid: string, business = 'space_series') =>
    `https://www.bilibili.com/medialist/play/${mid}?business=${business}&business_id=1528929&from=share`;

  test('becomes the list address, declaring the kind only for a series', async () => {
    expect(await normalizeLinkUrl(legacy('88461692'), { lookupFn })).toBe(
      'https://space.bilibili.com/88461692/lists/1528929?type=series',
    );
    expect(await normalizeLinkUrl(legacy('88461692', 'space_collection'), { lookupFn })).toBe(
      'https://space.bilibili.com/88461692/lists/1528929',
    );
  });

  test('imports the list of the uploader it names and refuses one that belongs to someone else', async () => {
    const { deps } = fakeBilibili();
    const execFn = vi.fn();
    await expect(resolveLinkMetadata(legacy('88461692'), { ...deps, execFn })).resolves.toMatchObject({
      title: 'Deep Learning',
      sourceUrl: 'https://space.bilibili.com/88461692/lists/1528929?type=series',
    });
    // yt-dlp, given this address as it is, returns the series whoever the uploader in it is.
    await expect(resolveLinkMetadata(legacy('946974'), { ...deps, execFn })).rejects.toMatchObject({
      code: 'LINK_UNAVAILABLE',
    });
    expect(execFn).not.toHaveBeenCalled();
  });
});

describe('list addresses behind a language prefix', () => {
  const normalize = (link: string) => normalizeLinkUrl(link, { lookupFn });

  test.each([
    [
      'https://www.bilibili.com/zh-Hans/medialist/play/88461692?business=space_series&business_id=1528929',
      'https://space.bilibili.com/88461692/lists/1528929?type=series',
    ],
    [
      'https://m.bilibili.com/zh-Hant/medialist/play/88461692?business=space_collection&business_id=1528929',
      'https://space.bilibili.com/88461692/lists/1528929',
    ],
    ['https://www.bilibili.com/zh-Hans/list/88461692?sid=1528929', 'https://space.bilibili.com/88461692/lists/1528929'],
  ])('%s is the same list as without it, and normalizing twice changes nothing', async (link, canonical) => {
    expect(await normalize(link)).toBe(canonical);
    expect(await normalize(canonical)).toBe(canonical);
  });

  test('the uploader in such an address is checked like any other', async () => {
    const { deps } = fakeBilibili();
    const execFn = vi.fn();
    const link = (mid: string) =>
      `https://www.bilibili.com/zh-Hans/medialist/play/${mid}?business=space_series&business_id=1528929`;
    await expect(resolveLinkMetadata(link('88461692'), { ...deps, execFn })).resolves.toMatchObject({
      title: 'Deep Learning',
    });
    await expect(resolveLinkMetadata(link('946974'), { ...deps, execFn })).rejects.toMatchObject({
      code: 'LINK_UNAVAILABLE',
    });
    expect(execFn).not.toHaveBeenCalled();
  });
});
