import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';
import { createApp } from '../app.ts';
import { TrackerRepository } from '../db/repository.ts';
import { type DnsLookupFn, type FetchFn } from '../security/ssrf.ts';
import {
  decodeHtmlEntities,
  extractFirstHttpUrl,
  extractMetaContent,
  resolveLinkMetadata,
  YTDLP_MISSING_WARNING,
} from './linkImport.ts';
import {
  type YtdlpExecFn,
  YtdlpExecutionError,
  YtdlpNotInstalledError,
} from './ytdlp.ts';

const mockPublicDns: DnsLookupFn = async (hostname) => {
  if (hostname === 'internal.corp') {
    return [{ address: '10.0.0.42' }];
  }
  return [{ address: '93.184.216.34' }];
};

// Recorded yt-dlp JSON fixtures
const FIXTURE_YT_SINGLE = {
  id: 'KdyJYuKT44M',
  title: 'Part one: Billy Elliot The Musical is back!',
  description: 'Behind the scenes at The Royal Ballet School.',
  thumbnail: 'https://i.ytimg.com/vi/KdyJYuKT44M/maxresdefault.jpg',
  uploader: 'The Royal Ballet School',
  webpage_url: 'https://www.youtube.com/watch?v=KdyJYuKT44M',
  duration: 1520,
  upload_date: '20241115',
  _type: 'video',
  extractor: 'youtube',
  extractor_key: 'Youtube',
};

const FIXTURE_YT_PLAYLIST = {
  id: 'PL590L5WQmH8eYTXiTTjzo4YnK7vkCqZTI',
  title: 'This Is Google Home',
  description: 'Official Google Home mini-series.',
  uploader: 'Google',
  webpage_url: 'https://www.youtube.com/playlist?list=PL590L5WQmH8eYTXiTTjzo4YnK7vkCqZTI',
   thumbnails: [
    { url: 'https://i.ytimg.com/vi/15_DCzw_vHU/default.jpg', width: 120, height: 90 },
    { url: 'https://i.ytimg.com/vi/15_DCzw_vHU/hqdefault.jpg', width: 480, height: 360 },
  ],
  _type: 'playlist',
  playlist_count: 3,
  extractor: 'youtube:tab',
  extractor_key: 'YoutubeTab',
  entries: [
    {
      id: '15_DCzw_vHU',
      title: 'Google Home: Supports multiple users',
      url: 'https://www.youtube.com/watch?v=15_DCzw_vHU',
      duration: 65,
      ie_key: 'Youtube',
    },
    {
      id: 'psr8tUqqCC0',
      title: 'Google Home: Hands-Free Calling',
      url: 'https://www.youtube.com/watch?v=psr8tUqqCC0',
      duration: 120,
      ie_key: 'Youtube',
    },
    {
      id: 'vM9h2Gf07bA',
      title: 'Google Home: Play Music',
      url: 'https://www.youtube.com/watch?v=vM9h2Gf07bA',
      duration: 90,
      ie_key: 'Youtube',
    },
  ],
};

const FIXTURE_BILI_SINGLE_BV = {
  id: 'BV1aFXaYmEFt',
  title: '这就是全网吹的1000以内音质吊打的oppo enco x3啊？',
  description: '-',
  uploader: '爱乐堂堂',
  thumbnail: 'http://i0.hdslb.com/bfs/archive/526dd045023c31ec1b12df96f99bfe7d74025e86.jpg',
  webpage_url: 'https://www.bilibili.com/video/BV1aFXaYmEFt/',
  duration: 304.788,
  upload_date: '20250323',
  _type: 'video',
  extractor: 'BiliBili',
  extractor_key: 'BiliBili',
};

const FIXTURE_BILI_MULTIPART = {
  id: 'BV17x411w7KC',
  title: 'TypeScript 进阶实战教程（全 3 讲）',
  description: '从零深入理解类型体操与工程化配置',
  uploader: '前端技术课堂',
  thumbnail: 'http://i1.hdslb.com/bfs/archive/multipart-cover.jpg',
  webpage_url: 'https://www.bilibili.com/video/BV17x411w7KC',
  _type: 'playlist',
  playlist_count: 3,
  extractor: 'BiliBili',
  extractor_key: 'BiliBili',
  entries: [
    {
      id: 'BV17x411w7KC_p1',
      title: 'P1 基础类型与泛型约束',
      url: 'https://www.bilibili.com/video/BV17x411w7KC?p=1',
      duration: 900,
      ie_key: 'BiliBili',
    },
    {
      id: 'BV17x411w7KC_p2',
      title: 'P2 条件类型与 infer 推导',
      url: 'https://www.bilibili.com/video/BV17x411w7KC?p=2',
      duration: 1200,
      ie_key: 'BiliBili',
    },
    {
      id: null,
      title: null,
      url: 'https://www.bilibili.com/video/BV17x411w7KC?p=3',
      duration: 1080,
      ie_key: 'BiliBili',
    },
  ],
};

const FIXTURE_BILI_COLLECTION = {
  id: '37754047_1853488',
  title: '合集·独立游戏深度评测',
  description: '历年最值得玩的独立游戏盘点',
  uploader: '游戏研究员',
  thumbnail: 'http://archive.biliimg.com/bfs/archive/719f0dbcf4c307c85a95b84a6b2aeebec9341081.jpg',
  webpage_url: 'https://space.bilibili.com/37754047/lists/1853488?type=season',
  _type: 'playlist',
  playlist_count: 2,
  extractor: 'BilibiliCollectionList',
  extractor_key: 'BilibiliCollectionList',
  entries: [
    {
      id: 'BV1hZ4y1h7PV',
      title: '第一期：星际拓荒 Outer Wilds',
      url: 'https://www.bilibili.com/video/BV1hZ4y1h7PV',
      duration: 1500,
      ie_key: 'BiliBili',
    },
    {
      id: 'BV1Ps4y1R7uq',
      title: '第二期：极乐迪斯科 Disco Elysium',
      url: 'https://www.bilibili.com/video/BV1Ps4y1R7uq',
      duration: 1800,
      ie_key: 'BiliBili',
    },
  ],
};

const FIXTURE_BILI_BANGUMI = {
  id: '34415',
  title: '请问您今天要来点兔子吗？BLOOM',
  description: '心爱在木造房屋小镇度过的第二个夏天即将结束。',
  thumbnail: 'https://i0.hdslb.com/bfs/bangumi/image/bloom.jpg',
  webpage_url: 'https://www.bilibili.com/bangumi/play/ss34415',
  _type: 'playlist',
  extractor: 'BiliBiliBangumiSeason',
  extractor_key: 'BiliBiliBangumiSeason',
  entries: [
    {
      id: '341457',
      title: '第1话',
      url: 'https://www.bilibili.com/bangumi/play/ep341457',
      ie_key: 'BiliBiliBangumi',
    },
    {
      id: '341458',
      title: '第2话',
      url: 'https://www.bilibili.com/bangumi/play/ep341458',
      ie_key: 'BiliBiliBangumi',
    },
  ],
};

const mockFetch: FetchFn = async (input) => {
  const url = String(input);

  if (url === 'https://example.com/movies/solaris') {
    const html = `<!doctype html>
      <html>
        <head>
          <title>Solaris (1972)</title>
          <meta property="og:title" content="飞向太空 Solaris's &amp; Co. &#127916;" />
          <meta property='og:description' content='塔可夫斯基 "科幻" &#x7ECF;&#x5178;' />
          <meta property="og:image" content="/assets/posters/solaris.jpg" />
        </head>
        <body>Hello</body>
      </html>`;
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (url === 'https://example.com/huge') {
    const head = `<head><meta property="og:title" content="Huge Page Title" /><meta property="og:image" content="relative/poster.png" /></head>`;
    const padding = 'A'.repeat(700 * 1024);
    return new Response(head + padding, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (url === 'https://example.com/evil-redirect') {
    return new Response(null, {
      status: 302,
      headers: { Location: 'http://127.0.0.1:8080/internal' },
    });
  }

  return new Response('Not Found', { status: 404 });
};

test('1. Single YouTube video via yt-dlp maps title, cover, runtimeMin, year, and passes required CLI flags', async () => {
  let capturedArgs: readonly string[] = [];
  const execFn: YtdlpExecFn = async (_file, args) => {
    capturedArgs = args;
    return { stdout: JSON.stringify(FIXTURE_YT_SINGLE), stderr: '' };
  };

  const result = await resolveLinkMetadata('https://www.youtube.com/watch?v=KdyJYuKT44M', {
    lookupFn: mockPublicDns,
    fetchFn: mockFetch,
    execFn,
  });

  assert.ok(capturedArgs.includes('--dump-single-json'));
  assert.ok(capturedArgs.includes('--skip-download'));
  assert.ok(capturedArgs.includes('--flat-playlist'));
  assert.ok(capturedArgs.includes('--no-warnings'));
  const jsIdx = capturedArgs.indexOf('--js-runtimes');
  assert.ok(jsIdx !== -1 && capturedArgs[jsIdx + 1] === 'node');
  const extractorsIdx = capturedArgs.indexOf('--use-extractors');
  assert.ok(extractorsIdx !== -1 && capturedArgs[extractorsIdx + 1] === 'default,-generic');

  assert.equal(result.kind, 'video');
  assert.equal(result.fallbackUsed, 'yt-dlp');
  assert.equal(result.title, 'Part one: Billy Elliot The Musical is back!');
  assert.equal(result.posterUrl, 'https://i.ytimg.com/vi/KdyJYuKT44M/maxresdefault.jpg');
  assert.equal(
    result.overview,
    'The Royal Ballet School · Behind the scenes at The Royal Ballet School.'
  );
  assert.equal(result.runtimeMin, 25); // 1520s -> 25 min
  assert.equal(result.year, 2024);
  assert.equal(result.sourceUrl, 'https://www.youtube.com/watch?v=KdyJYuKT44M');
  assert.deepEqual(result.episodes, []);
});

test('2. YouTube playlist via yt-dlp maps one episode per entry with sourceVideoId', async () => {
  const execFn: YtdlpExecFn = async () => ({
    stdout: JSON.stringify(FIXTURE_YT_PLAYLIST),
    stderr: '',
  });

  const result = await resolveLinkMetadata(
    'https://www.youtube.com/playlist?list=PL590L5WQmH8eYTXiTTjzo4YnK7vkCqZTI',
    { lookupFn: mockPublicDns, fetchFn: mockFetch, execFn }
  );

  assert.equal(result.kind, 'playlist');
  assert.equal(result.title, 'This Is Google Home');
  assert.equal(result.posterUrl, 'https://i.ytimg.com/vi/15_DCzw_vHU/hqdefault.jpg');
  assert.equal(result.episodes.length, 3);
  assert.deepEqual(result.episodes[0], {
    name: 'Google Home: Supports multiple users',
    sourceVideoId: '15_DCzw_vHU',
    runtime: 1,
  });
  assert.deepEqual(result.episodes[1], {
    name: 'Google Home: Hands-Free Calling',
    sourceVideoId: 'psr8tUqqCC0',
    runtime: 2,
  });
  assert.deepEqual(result.episodes[2], {
    name: 'Google Home: Play Music',
    sourceVideoId: 'vM9h2Gf07bA',
    runtime: 2,
  });
});

test('3. Bilibili video with 分P (multi-part) maps entries with episode names and derived sourceVideoId', async () => {
  const execFn: YtdlpExecFn = async () => ({
    stdout: JSON.stringify(FIXTURE_BILI_MULTIPART),
    stderr: '',
  });

  const result = await resolveLinkMetadata('https://www.bilibili.com/video/BV17x411w7KC', {
    lookupFn: mockPublicDns,
    fetchFn: mockFetch,
    execFn,
  });

  assert.equal(result.kind, 'playlist');
  assert.equal(result.title, 'TypeScript 进阶实战教程（全 3 讲）');
  assert.equal(result.posterUrl, 'https://i1.hdslb.com/bfs/archive/multipart-cover.jpg');
  assert.equal(result.episodes.length, 3);
  assert.deepEqual(result.episodes[0], {
    name: 'P1 基础类型与泛型约束',
    sourceVideoId: 'BV17x411w7KC_p1',
    runtime: 15,
  });
  assert.deepEqual(result.episodes[1], {
    name: 'P2 条件类型与 infer 推导',
    sourceVideoId: 'BV17x411w7KC_p2',
    runtime: 20,
  });
  // Entry 3 had null id/title -> derives BV17x411w7KC_p3 from URL and default episode title
  assert.deepEqual(result.episodes[2], {
    name: '第 3 集',
    sourceVideoId: 'BV17x411w7KC_p3',
    runtime: 18,
  });
});

test('4. Bilibili 合集 (collection/season) maps entries with BV ids as sourceVideoId', async () => {
  const execFn: YtdlpExecFn = async () => ({
    stdout: JSON.stringify(FIXTURE_BILI_COLLECTION),
    stderr: '',
  });

  const result = await resolveLinkMetadata(
    'https://space.bilibili.com/37754047/lists/1853488?type=season',
    { lookupFn: mockPublicDns, fetchFn: mockFetch, execFn }
  );

  assert.equal(result.kind, 'playlist');
  assert.equal(result.title, '合集·独立游戏深度评测');
  assert.equal(
    result.posterUrl,
    'https://archive.biliimg.com/bfs/archive/719f0dbcf4c307c85a95b84a6b2aeebec9341081.jpg'
  );
  assert.equal(result.episodes.length, 2);
  assert.equal(result.episodes[0]?.sourceVideoId, 'BV1hZ4y1h7PV');
  assert.equal(result.episodes[0]?.name, '第一期：星际拓荒 Outer Wilds');
  assert.equal(result.episodes[1]?.sourceVideoId, 'BV1Ps4y1R7uq');
});

test('5. Bilibili bangumi returns { kind: "tmdb-suggestion", title } by default, and playlist when forceImport is true', async () => {
  const execFn: YtdlpExecFn = async () => ({
    stdout: JSON.stringify(FIXTURE_BILI_BANGUMI),
    stderr: '',
  });

  const suggestion = await resolveLinkMetadata('https://www.bilibili.com/bangumi/play/ss34415', {
    lookupFn: mockPublicDns,
    fetchFn: mockFetch,
    execFn,
  });

  assert.equal(suggestion.kind, 'tmdb-suggestion');
  assert.equal(suggestion.title, '请问您今天要来点兔子吗？BLOOM');
  assert.equal(suggestion.episodes.length, 2);

  const forced = await resolveLinkMetadata('https://www.bilibili.com/bangumi/play/ss34415', {
    lookupFn: mockPublicDns,
    fetchFn: mockFetch,
    execFn,
    forceImport: true,
  });
  assert.equal(forced.kind, 'playlist');
  assert.equal(forced.title, '请问您今天要来点兔子吗？BLOOM');
});

test('6. Refresh playlist appends only new entries by sourceVideoId without altering existing episode keys or watched progress', async () => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  try {
    const titleId = 'url_test_playlist';
    const now = 1700000000000;
    repo.putTitle(titleId, {
      title: {
        id: titleId,
        source: 'url',
        sourceId: 'https://space.bilibili.com/37754047/lists/1853488?type=season',
        mediaType: 'other',
        names: { original: '合集·独立游戏深度评测', zh: '合集·独立游戏深度评测' },
        displayLang: null,
        year: 2025,
        runtimeMin: 25,
        genres: [],
        posterPath: null,
        backdropPath: null,
        overview: { zh: '' },
        showStatus: 'Ended',
        externalIds: {},
        ratings: {},
        manualState: null,
        playthroughs: [{ id: 'p1', number: 1, startedAt: now }],
        activePlaythroughId: 'p1',
        resume: { episodeKey: 's1e2', seconds: 320, updatedAt: now },
        metaFetchedAt: now,
        addedAt: now,
        updatedAt: now,
        lastActivityAt: now,
      },
      seasons: [
        {
          seasonNumber: 1,
          name: '第 1 季',
          episodes: [
            {
              number: 1,
              key: 's1e1',
              name: '第一期：星际拓荒 Outer Wilds (用户已改名)',
              airDate: '2020-01-01',
              runtime: 25,
              stillPath: null,
              overview: {},
              sourceVideoId: 'BV1hZ4y1h7PV',
            },
            {
              number: 2,
              key: 's1e2',
              name: '第二期：极乐迪斯科 Disco Elysium',
              airDate: '2020-01-01',
              runtime: 30,
              stillPath: null,
              overview: {},
              sourceVideoId: 'BV1Ps4y1R7uq',
            },
          ],
        },
      ],
      progress: {
        p1: {
          playthroughId: 'p1',
          watched: { s1e1: now },
        },
      },
    });

    // Refresh returns 2 existing + 2 brand new entries
    const refreshRes = repo.appendPlaylistEpisodes(
      titleId,
      [
        { name: '第一期：星际拓荒 Outer Wilds', sourceVideoId: 'BV1hZ4y1h7PV', runtime: 25 },
        { name: '第二期：极乐迪斯科 Disco Elysium', sourceVideoId: 'BV1Ps4y1R7uq', runtime: 30 },
        { name: '第三期：空洞骑士 Hollow Knight', sourceVideoId: 'BV1NewEp003', runtime: 28 },
        { name: '第四期：蔚蓝 Celeste', sourceVideoId: 'BV1NewEp004', runtime: 22 },
      ],
      now + 5000
    );

    assert.equal(refreshRes.addedCount, 2);
    const updatedS1 = refreshRes.upserts.seasonsByTitle?.[titleId]?.[0];
    assert.ok(updatedS1);
    assert.equal(updatedS1.episodes.length, 4);

    // Existing episodes 1 and 2 keep their exact keys and custom names
    assert.equal(updatedS1.episodes[0]?.key, 's1e1');
    assert.equal(updatedS1.episodes[0]?.name, '第一期：星际拓荒 Outer Wilds (用户已改名)');
    assert.equal(updatedS1.episodes[0]?.sourceVideoId, 'BV1hZ4y1h7PV');
    assert.equal(updatedS1.episodes[1]?.key, 's1e2');
    assert.equal(updatedS1.episodes[1]?.sourceVideoId, 'BV1Ps4y1R7uq');

    // New episodes appended at the end as s1e3 and s1e4
    assert.equal(updatedS1.episodes[2]?.key, 's1e3');
    assert.equal(updatedS1.episodes[2]?.number, 3);
    assert.equal(updatedS1.episodes[2]?.name, '第三期：空洞骑士 Hollow Knight');
    assert.equal(updatedS1.episodes[2]?.sourceVideoId, 'BV1NewEp003');
    assert.equal(updatedS1.episodes[3]?.key, 's1e4');
    assert.equal(updatedS1.episodes[3]?.number, 4);
    assert.equal(updatedS1.episodes[3]?.name, '第四期：蔚蓝 Celeste');
    assert.equal(updatedS1.episodes[3]?.sourceVideoId, 'BV1NewEp004');

    // Watched progress on s1e1 and resume on s1e2 are completely untouched
    const stateAfter = repo.getState();
    assert.deepEqual(stateAfter.progressByTitle[titleId]?.p1?.watched, { s1e1: now });
    assert.deepEqual(stateAfter.titles[titleId]?.resume, {
      episodeKey: 's1e2',
      seconds: 320,
      updatedAt: now,
    });
  } finally {
    repo.close();
  }
});

test('7. yt-dlp missing (ENOENT) falls back to Open Graph with warning notice and quote/entity decoding', async () => {
  const execMissing: YtdlpExecFn = async (file) => {
    throw new YtdlpNotInstalledError(file);
  };

  const ogResult = await resolveLinkMetadata('https://example.com/movies/solaris', {
    lookupFn: mockPublicDns,
    fetchFn: mockFetch,
    execFn: execMissing,
  });

  assert.equal(ogResult.fallbackUsed, 'og');
  assert.equal(ogResult.warning, YTDLP_MISSING_WARNING);
  assert.equal(ogResult.title, "飞向太空 Solaris's & Co. 🎬");
  assert.equal(ogResult.overview, '塔可夫斯基 "科幻" 经典');
  assert.equal(ogResult.posterUrl, 'https://example.com/assets/posters/solaris.jpg');

  const hugeResult = await resolveLinkMetadata('https://example.com/huge', {
    lookupFn: mockPublicDns,
    fetchFn: mockFetch,
    execFn: execMissing,
  });
  assert.equal(hugeResult.title, 'Huge Page Title');
  assert.equal(hugeResult.posterUrl, 'https://example.com/relative/poster.png');
  assert.equal(hugeResult.warning, YTDLP_MISSING_WARNING);
});

test('8. yt-dlp timeout falls back to Open Graph, and to manual seed if Open Graph also fails', async () => {
  const execTimeout: YtdlpExecFn = async () => {
    throw new YtdlpExecutionError('yt-dlp 解析超时 (30s)', 'YTDLP_TIMEOUT');
  };

  const ogFallback = await resolveLinkMetadata('https://example.com/movies/solaris', {
    lookupFn: mockPublicDns,
    fetchFn: mockFetch,
    execFn: execTimeout,
  });
  assert.equal(ogFallback.fallbackUsed, 'og');
  assert.equal(ogFallback.warning, undefined);
  assert.equal(ogFallback.title, "飞向太空 Solaris's & Co. 🎬");

  const manualFallback = await resolveLinkMetadata('https://example.com/unlisted-video-404', {
    lookupFn: mockPublicDns,
    fetchFn: mockFetch,
    execFn: execTimeout,
  });
  assert.equal(manualFallback.fallbackUsed, 'manual');
  assert.equal(manualFallback.title, 'example.com');
  assert.equal(manualFallback.sourceUrl, 'https://example.com/unlisted-video-404');
});

test('9. Share-text URL extraction and long sourceUrl preservation (up to 2048 chars, no 120-char truncation)', async () => {
  const shareText =
    '【这就是全网吹的1000以内音质吊打的oppo enco x3啊？-哔哩哔哩】 https://b23.tv/AbCdEf 快来看！';
  assert.equal(extractFirstHttpUrl(shareText), 'https://b23.tv/AbCdEf');

  const longQuery = 'a'.repeat(400);
  const longUrl = `https://www.bilibili.com/video/BV1aFXaYmEFt/?share_token=${longQuery}`;
  assert.ok(longUrl.length > 440);

  const execFn: YtdlpExecFn = async (_file, args) => {
    const passedUrl = args[args.length - 1];
    return {
      stdout: JSON.stringify({
        ...FIXTURE_BILI_SINGLE_BV,
        webpage_url: passedUrl,
      }),
      stderr: '',
    };
  };

  const result = await resolveLinkMetadata(`【分享视频】 ${longUrl}`, {
    lookupFn: mockPublicDns,
    fetchFn: mockFetch,
    execFn,
  });

  assert.equal(result.title, '这就是全网吹的1000以内音质吊打的oppo enco x3啊？');
  assert.equal(result.sourceUrl, longUrl);
  assert.ok(result.sourceUrl.length > 440);
});

test('10. Contract test: every path in src/data/api.ts exists on the Express server, and no component calls apiJson with raw paths', () => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  try {
    const app = createApp({ repo, setupCode: 'contract-test-code' });

    // Extract registered routes from Express 4 router stack
    const registeredRoutes: Array<{ method: string; path: string; regex: RegExp }> = [];
    const stack = (app as unknown as { _router?: { stack?: Array<{ route?: { path: string; methods: Record<string, boolean> }; regexp?: RegExp }> } })._router?.stack || [];
    for (const layer of stack) {
      if (layer.route && layer.route.path) {
        const routePath = layer.route.path;
        // Convert Express `:param` segments into regex matching encoded path segments
        const pattern = '^' + routePath.replace(/:[^/]+/g, '[^/?]+') + '$';
        const regex = new RegExp(pattern);
        for (const [m, enabled] of Object.entries(layer.route.methods)) {
          if (enabled) {
            registeredRoutes.push({ method: m.toUpperCase(), path: routePath, regex });
          }
        }
      }
    }

    const apiFilePath = path.resolve(import.meta.dirname, '../../src/data/api.ts');
    const apiSource = fs.readFileSync(apiFilePath, 'utf-8');

    // Match all `/api/...` paths in src/data/api.ts
    const pathMatches = [...apiSource.matchAll(/['"`](\/api\/[^'"`?]+)(?:\?[^'"`]*)?['"`]/g)];
    assert.ok(pathMatches.length >= 15, 'Should find all /api/* paths in src/data/api.ts');

    for (const m of pathMatches) {
      const rawTemplate = m[1]!;
      // Replace template expressions `${...}` with a sample path segment
      const concretePath = rawTemplate.replace(/\$\{[^}]+\}/g, '123');
      const matched = registeredRoutes.some((r) => r.regex.test(concretePath));
      assert.ok(
        matched,
        `Path "${rawTemplate}" (concrete: "${concretePath}") in src/data/api.ts is not registered on the Express server!`
      );
    }

    // Verify no file in src/ outside src/data/api.ts calls apiJson
    const srcRoot = path.resolve(import.meta.dirname, '../../src');
    const walkFiles = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          out.push(...walkFiles(full));
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
          out.push(full);
        }
      }
      return out;
    };

    for (const file of walkFiles(srcRoot)) {
      if (path.resolve(file) === apiFilePath) continue;
      const content = fs.readFileSync(file, 'utf-8');
      assert.equal(
        /\bapiJson\b/.test(content),
        false,
        `File ${path.relative(srcRoot, file)} must not reference apiJson directly; use typed functions from src/data/api.ts`
      );
    }
  } finally {
    repo.close();
  }
});

test('decodeHtmlEntities and extractMetaContent handle quotes and decimal/hex entities', () => {
  assert.equal(decodeHtmlEntities('A &amp; B &#39;C&#39; &#65; &#x42;'), "A & B 'C' A B");
  const html = `<meta property="og:title" content="It's &quot;Great&quot; &#x2728;"><meta content='Single "Quoted" Value' property='og:description'>`;
  assert.equal(extractMetaContent(html, 'og:title'), 'It\'s "Great" ✨');
  assert.equal(extractMetaContent(html, 'og:description'), 'Single "Quoted" Value');
});

test('13. buildYtdlpArgs includes --use-extractors default,-generic and getYtdlpBinaryPath resolves /opt/yt-dlp/yt-dlp when YTDLP_PATH is empty', async () => {
  const { buildYtdlpArgs, getYtdlpBinaryPath } = await import('./ytdlp.ts');
  const { parseExpectedSha256 } = await import('../scripts/setup-ytdlp.ts');

  const args = buildYtdlpArgs('https://example.com/video');
  const idx = args.indexOf('--use-extractors');
  assert.ok(idx !== -1, 'args must include --use-extractors');
  assert.equal(args[idx + 1], 'default,-generic');
  assert.equal(args[args.length - 2], '--');
  assert.equal(args[args.length - 1], 'https://example.com/video');

  const localBin = path.resolve(process.cwd(), '.bin', 'yt-dlp');
  const prevEnv = process.env.YTDLP_PATH;
  try {
    // An empty or whitespace-only YTDLP_PATH still resolves to /opt/yt-dlp/yt-dlp when that file exists
    process.env.YTDLP_PATH = '';
    assert.equal(
      getYtdlpBinaryPath({
        checkExecutable: (p) => p === '/opt/yt-dlp/yt-dlp',
      }),
      '/opt/yt-dlp/yt-dlp'
    );

    process.env.YTDLP_PATH = '   ';
    assert.equal(
      getYtdlpBinaryPath({
        checkExecutable: (p) => p === '/opt/yt-dlp/yt-dlp',
      }),
      '/opt/yt-dlp/yt-dlp'
    );

    // Falls back to ./.bin/yt-dlp when /opt/yt-dlp/yt-dlp is absent
    assert.equal(
      getYtdlpBinaryPath({
        checkExecutable: (p) => p === localBin,
      }),
      localBin
    );

    // Falls back to yt-dlp on PATH when neither file exists
    assert.equal(
      getYtdlpBinaryPath({
        checkExecutable: () => false,
      }),
      'yt-dlp'
    );

    process.env.YTDLP_PATH = '/custom/yt-dlp';
    assert.equal(getYtdlpBinaryPath(), '/custom/yt-dlp');
  } finally {
    if (prevEnv === undefined) {
      delete process.env.YTDLP_PATH;
    } else {
      process.env.YTDLP_PATH = prevEnv;
    }
  }

  const sampleSums = [
    '1111111111111111111111111111111111111111111111111111111111111111  yt-dlp',
    '767ba9dce7052aa196f8b12652f433d76de128ba168966fa84b6394d5e6c6795  yt-dlp_linux',
    '2222222222222222222222222222222222222222222222222222222222222222 *yt-dlp_linux_aarch64',
  ].join('\n');
  assert.equal(
    parseExpectedSha256(sampleSums, 'yt-dlp_linux'),
    '767ba9dce7052aa196f8b12652f433d76de128ba168966fa84b6394d5e6c6795'
  );
  assert.equal(
    parseExpectedSha256(sampleSums, 'yt-dlp_linux_aarch64'),
    '2222222222222222222222222222222222222222222222222222222222222222'
  );
  assert.equal(parseExpectedSha256(sampleSums, 'nonexistent'), null);
});


