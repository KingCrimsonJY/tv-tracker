import { describe, expect, test } from 'vitest';
import { resolveLinkMetadata, decodeHtmlEntities, scrapeOpenGraph } from './linkImport.ts';
import { resolveBilibiliMetadata } from './bilibili.ts';
import { normalizeLinkUrl } from './linkUrls.ts';
import { mapYtdlpJsonToLinkResult, resolveWithYtdlp, YtdlpExecutionError } from './ytdlp.ts';
import { classifyLinkFailure } from './linkErrors.ts';
import { readResponseText, isPrivateOrReservedIp, type FetchFn } from '../security/ssrf.ts';
import { TrackerRepository } from '../db/repository.ts';
import { makeBaseTvTitle } from '../../src/domain/testFixtures.ts';

const lookupFn = async () => [{ address: '93.184.216.34' }];
const reply = (data: unknown) => Response.json({ code: 0, data });
const video = {
  bvid: 'BV1bK411W797', title: 'Multi-part', pic: 'http://i0.hdslb.com/cover.jpg', pubdate: 1600000000,
  owner: { name: 'Creator' }, duration: 189,
  pages: [{ page: 1, part: 'Opening', duration: 91 }, { page: 2, part: 'Closing', duration: 98 }],
};
const fetchVideo: FetchFn = async () => reply(video);

describe('Bilibili public metadata', () => {
  test('multi-part metadata uses stable per-part IDs, actual titles, dates, and durations', async () => {
    const result = await resolveBilibiliMetadata('https://www.bilibili.com/video/BV1bK411W797', { lookupFn, fetchFn: fetchVideo });
    expect(result?.episodes).toEqual([
      { sourceVideoId: 'BV1bK411W797_p1', name: 'Opening', runtime: 2, airDate: '2020-09-13' },
      { sourceVideoId: 'BV1bK411W797_p2', name: 'Closing', runtime: 2, airDate: '2020-09-13' },
    ]);
    expect(result?.posterUrl).toBe('https://i0.hdslb.com/cover.jpg');
  });
  test('selected part is a single item and invalid part is rejected', async () => {
    const deps = { lookupFn, fetchFn: fetchVideo };
    const result = await resolveBilibiliMetadata('https://www.bilibili.com/video/BV1bK411W797?p=2', deps);
    expect(result).toMatchObject({ title: 'Multi-part · Closing', runtimeMin: 2, episodes: [] });
    await expect(resolveBilibiliMetadata('https://www.bilibili.com/video/BV1bK411W797?p=99', deps)).rejects.toMatchObject({ code: 'LINK_UNAVAILABLE' });
  });
  test.each([100, 30])('collection paging handles an effective page size of %s', async pageSize => {
    const pages: number[] = [];
    const fetchFn: FetchFn = async input => {
      const pn = Number(new URL(input).searchParams.get('page_num'));
      pages.push(pn);
      return reply({
        meta: { name: 'Collection' }, page: { total: 102, page_size: pageSize },
        archives: Array.from({ length: Math.min(pageSize, 102 - (pn - 1) * pageSize) }, (_, i) => ({
          bvid: 'BV' + ((pn - 1) * pageSize + i), title: 'Video ' + ((pn - 1) * pageSize + i), duration: 120,
        })),
      });
    };
    const result = await resolveBilibiliMetadata('https://space.bilibili.com/123/lists/456?type=season', { lookupFn, fetchFn });
    expect(result?.episodes).toHaveLength(102);
    expect(result?.episodes[101].name).toBe('Video 101');
    expect(pages).toEqual(Array.from({ length: Math.ceil(102 / pageSize) }, (_, i) => i + 1));
  });
  test('empty lists and oversized lists are explicit failures', async () => {
    for (const total of [0, 2001]) {
      await expect(resolveBilibiliMetadata('https://space.bilibili.com/123/lists/456?type=season', {
        lookupFn, fetchFn: async () => reply({ meta: { name: 'List' }, page: { total }, archives: [] }),
      })).rejects.toMatchObject({ code: total ? 'LINK_PLAYLIST_TOO_LARGE' : 'LINK_EMPTY_PLAYLIST' });
    }
  });
  test('region-restricted bangumi still imports public metadata and explains playback access', async () => {
    const result = await resolveBilibiliMetadata('https://www.bilibili.com/bangumi/play/ss123', {
      lookupFn, fetchFn: async () => reply({
        title: 'Anime', season_id: 123, type: 1, episodes: [
          { id: 10, title: '1', long_title: 'Start', duration: 120000, rights: { area_limit: 1 } },
        ],
      }),
    });
    expect(result).toMatchObject({
      kind: 'tmdb-suggestion', mediaType: 'tv', warning: 'LINK_PLAYBACK_RESTRICTED',
      episodes: [{ sourceVideoId: '10', name: '1 Start', runtime: 2, airDate: null }],
    });
  });
  test('course preview is not classified as a TV series', async () => {
    const result = await resolveBilibiliMetadata('https://www.bilibili.com/cheese/play/ep10', {
      lookupFn, fetchFn: async () => reply({
        title: 'Course', season_id: 123, episodes: [{ id: 10, title: 'Preview', duration: 221, playable: true }],
      }),
    });
    expect(result).toMatchObject({ kind: 'video', mediaType: 'other', title: 'Preview', runtimeMin: 4 });
  });
  test.each([1, 0])('room state %s is preserved independently from watch progress', async status => {
    const result = await resolveBilibiliMetadata('https://live.bilibili.com/blanc/196', {
      lookupFn, fetchFn: async () => reply({ room_id: 196, title: 'Live room', live_status: status }),
    });
    expect(result?.liveStatus).toBe(status ? 'live' : 'offline');
    expect(result?.warning).toBe(status ? undefined : 'LINK_NOT_LIVE');
  });
});

describe('link normalization and failures', () => {
  test('mobile and deterministic short links preserve the selected part', async () => {
    for (const input of ['https://m.bilibili.com/video/BV1bK411W797?p=2&share_token=tracking', 'https://b23.tv/BV1bK411W797?p=2']) {
      expect(await normalizeLinkUrl(input, { lookupFn })).toBe('https://www.bilibili.com/video/BV1bK411W797?p=2');
    }
  });
  test('a random short link is safely redirected and parsed with the dedicated provider', async () => {
    const result = await resolveLinkMetadata('https://b23.tv/abc', {
      lookupFn,
      fetchFn: async input => input.includes('b23.tv')
        ? new Response(null, { status: 302, headers: { location: 'https://m.bilibili.com/video/BV1bK411W797' } })
        : input.includes('api.bilibili.com') ? reply(video) : new Response('<html></html>'),
      execFn: async () => { throw new Error('Should not need yt-dlp'); },
    });
    expect(result.kind).toBe('playlist');
    expect(result.episodes).toHaveLength(2);
  });
  test('short links cannot redirect to localhost or a credential-bearing URL', async () => {
    for (const target of ['http://127.0.0.1/', 'https://user:secret@example.com/']) {
      await expect(normalizeLinkUrl('https://b23.tv/abc', {
        lookupFn, fetchFn: async () => new Response(null, { status: 302, headers: { location: target } }),
      })).rejects.toMatchObject({ code: 'UNSAFE_URL' });
    }
  });
  test.each([
    ['Video unavailable', 'LINK_UNAVAILABLE'],
    ['This video is not available in your country', 'LINK_REGION_RESTRICTED'],
    ['The uploader has not made this video available in your country', 'LINK_REGION_RESTRICTED'],
    ['Sign in to confirm your age', 'LINK_AGE_RESTRICTED'],
    ['You need to purchase the course', 'LINK_PAYMENT_REQUIRED'],
    ['This is a private playlist. Please log in', 'LINK_LOGIN_REQUIRED'],
    ['Streamer is not live', 'LINK_NOT_LIVE'],
    ['HTTP 429 Too Many Requests', 'LINK_RATE_LIMITED'],
    ['Sign in to confirm you are not a bot', 'LINK_RATE_LIMITED'],
  ])('provider reason %s survives instead of a fake success', async (message, code) => {
    expect(classifyLinkFailure(new Error(message)).code).toBe(code);
    await expect(resolveLinkMetadata('https://www.youtube.com/watch?v=00000000000', {
      lookupFn, execFn: async () => { throw new YtdlpExecutionError(message); },
      fetchFn: async () => new Response('<title>YouTube</title>'),
    })).rejects.toMatchObject({ code });
  });
  test.each(['<title>YouTube</title>', '{"code":-404}', '<title>www.youtube.com</title>', '<title>视频去哪了呢？</title>'])('error pages do not become importable titles: %s', async html => {
    await expect(resolveLinkMetadata('https://www.youtube.com/watch?v=00000000000', {
      lookupFn, execFn: async () => { throw new Error('no suitable extractor'); },
      fetchFn: async () => new Response(html, { headers: { 'Content-Type': 'text/html' } }),
    })).rejects.toMatchObject({ code: 'LINK_PARSE_FAILED' });
  });
  test.each([0, 2001])('YouTube playlist size %s cannot fall back to an ordinary web page', async count => {
    let scraped = false;
    await expect(resolveLinkMetadata('https://www.youtube.com/playlist?list=example', {
      lookupFn,
      execFn: async () => ({ stderr: '', stdout: JSON.stringify({
        title: 'Public playlist', _type: 'playlist', playlist_count: count,
        entries: count ? [{ id: 'entry', title: 'Video', duration: 60 }] : [],
      }) }),
      fetchFn: async () => { scraped = true; return new Response('<title>Public playlist</title>'); },
    })).rejects.toMatchObject({ code: count ? 'LINK_PLAYLIST_TOO_LARGE' : 'LINK_EMPTY_PLAYLIST' });
    expect(scraped).toBe(false);
  });
  test('an unsuccessful web response releases its unread body', async () => {
    let cancelled = false;
    await expect(scrapeOpenGraph('https://example.com/missing', {
      lookupFn,
      fetchFn: async () => new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode('Not found')); },
        cancel() { cancelled = true; },
      }), { status: 404 }),
    })).rejects.toThrow('HTTP 404');
    expect(cancelled).toBe(true);
  });
  test('malformed numeric HTML entities cannot crash the decoder', () => {
    expect(decodeHtmlEntities('&#99999999999; &#x110000; &#x1f3ac;')).toBe('&#99999999999; &#x110000; 🎬');
  });
  test('stream size limit cancels the body', async () => {
    let cancelled = false;
    const response = new Response(new ReadableStream({
      start(controller) { controller.enqueue(new TextEncoder().encode('1234567890')); },
      cancel() { cancelled = true; },
    }));
    expect(await readResponseText(response, 4)).toBe('1234');
    expect(cancelled).toBe(true);
  });
  test.each(['0:0:0:0:0:ffff:7f00:1', '64:ff9b::7f00:1', '2002:7f00:1::', '2001:db8::1', '::1'])('rejects special IPv6 address %s', ip => {
    expect(isPrivateOrReservedIp(ip)).toBe(true);
  });
  test('allows public IPv6 addresses', () => expect(isPrivateOrReservedIp('2606:4700:4700::1111')).toBe(false));
});

describe('yt-dlp mapping and refresh', () => {
  test('enrichment stops launching requests after an anti-bot restriction without dropping entries', async () => {
    let calls = 0;
    const result = await resolveWithYtdlp('https://www.youtube.com/@example/shorts', {
      lookupFn,
      execFn: async () => {
        calls++;
        if (calls > 1) throw new YtdlpExecutionError('Sign in to confirm you are not a bot');
        return { stderr: '', stdout: JSON.stringify({
          title: 'Shorts', extractor: 'youtube:tab', _type: 'playlist',
          entries: Array.from({ length: 20 }, (_, i) => ({ id: String(i).padStart(11, '0'), title: 'Short ' + i })),
        }) };
      },
    });
    expect(result.episodes).toHaveLength(20);
    expect(result.warning).toBe('LINK_METADATA_INCOMPLETE');
    expect(calls).toBeLessThanOrEqual(5);
  });
  test('truncated playlists are explicitly marked incomplete', () => {
    expect(mapYtdlpJsonToLinkResult({ title: 'List', playlist_count: 3, entries: [{ id: 'one', title: 'One', duration: 60 }] },
      'https://www.youtube.com/playlist?list=abc').warning).toBe('LINK_METADATA_INCOMPLETE');
  });
  test('episode_number alone does not turn a classroom video into a TV suggestion', () => {
    expect(mapYtdlpJsonToLinkResult({
      title: 'Lesson', episode_number: 1, extractor: 'BilibiliCheese',
    }, 'https://www.bilibili.com/cheese/play/ep1').kind).toBe('video');
  });
  test('live and replay flags survive mapping', () => {
    expect(mapYtdlpJsonToLinkResult({ title: 'Live', is_live: true }, 'https://www.youtube.com/live/123').liveStatus).toBe('live');
    expect(mapYtdlpJsonToLinkResult({ title: 'Replay', live_status: 'was_live' }, 'https://www.youtube.com/live/123').liveStatus).toBe('ended');
  });
  test('empty playlists and missing titles are rejected', () => {
    expect(() => mapYtdlpJsonToLinkResult({ title: 'Empty', _type: 'playlist', entries: [] }, 'https://www.youtube.com/playlist?list=abc')).toThrow();
    expect(() => mapYtdlpJsonToLinkResult({}, 'https://www.youtube.com/watch?v=abc')).toThrow();
  });
  test('refresh fills missing metadata without changing existing names, keys or watched history', () => {
    const repo = new TrackerRepository({ dbPath: ':memory:' });
    try {
      const title = { ...makeBaseTvTitle(), id: 'url_refresh', source: 'url' as const, sourceId: 'https://www.youtube.com/playlist?list=abc', mediaType: 'movie' as const };
      repo.putTitle(title.id, {
        title, seasons: [{ seasonNumber: 1, name: null, episodes: [
          { number: 1, key: 's1e1', name: null, runtime: null, airDate: null, stillPath: null, overview: {}, sourceVideoId: 'one' },
          { number: 2, key: 's1e2', name: { zh: 'Custom' }, runtime: 30, airDate: null, stillPath: null, overview: {}, sourceVideoId: 'two' },
        ] }], progress: { p1: { playthroughId: 'p1', watched: { s1e1: 1234 } } },
      });
      const incoming = [{ sourceVideoId: 'one', name: 'First', runtime: 2 }, { sourceVideoId: 'two', name: 'Provider', runtime: 3 }, { sourceVideoId: 'three', name: 'New', runtime: 4 }];
      const result = repo.appendPlaylistEpisodes(title.id, incoming);
      expect(result.addedCount).toBe(1);
      const episodes = repo.getState().seasonsByTitle[title.id][0].episodes;
      expect(episodes[0]).toMatchObject({ key: 's1e1', name: { zh: 'First' }, runtime: 2 });
      expect(episodes[1]).toMatchObject({ name: { zh: 'Custom' }, runtime: 30 });
      expect(episodes[2].airDate).toBeNull();
      expect(result.upserts.titles?.[title.id]?.mediaType).toBe('other');
      expect(repo.getState().progressByTitle[title.id].p1.watched).toEqual({ s1e1: 1234 });
      expect(repo.appendPlaylistEpisodes(title.id, incoming).addedCount).toBe(0);
    } finally { repo.close(); }
  });
});
