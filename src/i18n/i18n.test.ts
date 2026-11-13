import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../server/app.ts';
import { TrackerRepository } from '../../server/db/repository.ts';
import { fetchTmdbTitleDetails } from '../../server/providers/tmdb.ts';
import { en } from './messages/en.ts';
import { zhCN } from './messages/zh-CN.ts';

function collectKeys(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [prefix];
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v, next));
    } else {
      keys.push(next);
    }
  }
  return keys.sort();
}

function collectCatalogValues(obj: unknown, pathPrefix = ''): Array<{ key: string; value: string }> {
  if (!obj || typeof obj !== 'object') return [];
  const results: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const next = pathPrefix ? `${pathPrefix}.${k}` : k;
    if (typeof v === 'string') {
      results.push({ key: next, value: v });
    } else if (typeof v === 'function') {
      const sample = (v as (...args: unknown[]) => string)('Sample', 2, '10:00');
      results.push({ key: next, value: String(sample) });
    } else if (v && typeof v === 'object') {
      results.push(...collectCatalogValues(v, next));
    }
  }
  return results;
}

describe('B10 i18n, bilingual metadata, server error codes & migration tests', () => {
  it('1. zh-CN and en catalogs have identical keys', () => {
    const zhKeys = collectKeys(zhCN);
    const enKeys = collectKeys(en);
    expect(enKeys).toEqual(zhKeys);
  });

  it('2. en catalog contains no CJK characters (except native language selector label "简体中文")', () => {
    const cjkRegex = /[\u4e00-\u9fff]/;
    const allowedCjkKeys = new Set([
      'settings.uiLang.zhCN', // Language selector native name "简体中文"
    ]);
    const values = collectCatalogValues(en);
    const violations = values.filter((item) => !allowedCjkKeys.has(item.key) && cjkRegex.test(item.value));
    expect(violations).toEqual([]);
  });

  it('3. no CJK string literals in src/**/*.ts(x) or server/**/*.ts outside src/i18n, tests and seed fixtures', () => {
    const rootDir = path.resolve(import.meta.dirname, '../..');
    const cjkRegex = /[\u4e00-\u9fff]/;

    function walkTsFiles(dir: string): string[] {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'i18n' || entry.name === 'scripts' || entry.name === 'node_modules') {
            continue;
          }
          out.push(...walkTsFiles(full));
        } else if (
          entry.isFile() &&
          /\.(ts|tsx)$/.test(entry.name) &&
          !entry.name.endsWith('.test.ts') &&
          !entry.name.endsWith('.test.tsx')
        ) {
          out.push(full);
        }
      }
      return out;
    }

    const files = [...walkTsFiles(path.join(rootDir, 'src')), ...walkTsFiles(path.join(rootDir, 'server'))];

    const violations: Array<{ file: string; line: number; text: string }> = [];
    for (const file of files) {
      const rel = path.relative(rootDir, file);
      const lines = fs.readFileSync(file, 'utf-8').split('\n');
      lines.forEach((lineText, idx) => {
        const stripped = lineText.replace(/\/\/.*$/, '');
        if (cjkRegex.test(stripped)) {
          violations.push({ file: rel, line: idx + 1, text: lineText.trim() });
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('4. server error responses carry stable error codes', async () => {
    const repo = new TrackerRepository({ dbPath: ':memory:' });
    repo.setStoredPasswordHash(
      'scrypt:00112233445566778899aabbccddeeff:00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
      Date.now(),
    );
    const app = createApp({ repo, setupCode: 'test-setup-code' });
    const server = app.listen(0);
    try {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const baseUrl = `http://127.0.0.1:${port}`;

      // Unauthenticated request -> UNAUTHENTICATED
      const unauthRes = await fetch(`${baseUrl}/api/state`);
      expect(unauthRes.status).toBe(401);
      const unauthBody = (await unauthRes.json()) as { code: string; message: string };
      expect(unauthBody.code).toBe('UNAUTHENTICATED');

      // Wrong password -> WRONG_PASSWORD
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: baseUrl,
        },
        body: JSON.stringify({ password: 'wrong-password-123' }),
      });
      expect(loginRes.status).toBe(401);
      const loginBody = (await loginRes.json()) as { code: string; message: string };
      expect(loginBody.code).toBe('WRONG_PASSWORD');
    } finally {
      server.close();
      repo.close();
    }
  });

  it('5. TMDB mapping fetches and stores both zh-CN and en-US names, overviews, season/episode localized text, and genreIds', async () => {
    const prevToken = process.env.TMDB_READ_TOKEN;
    process.env.TMDB_READ_TOKEN = 'mock-tmdb-token';
    try {
      const mockFetch: typeof fetch = async (input) => {
        const url = String(input);
        if (url.includes('/tv/95396?') && url.includes('language=zh-CN')) {
          return new Response(
            JSON.stringify({
              id: 95396,
              name: '人生切割术',
              original_name: 'Severance',
              overview: '中文剧情简介',
              first_air_date: '2022-02-18',
              episode_run_time: [50],
              status: 'Returning Series',
              poster_path: '/zh_poster.jpg',
              backdrop_path: '/backdrop.jpg',
              vote_average: 8.4,
              vote_count: 1500,
              genres: [
                { id: 18, name: '剧情' },
                { id: 10765, name: 'Sci-Fi & Fantasy' },
              ],
              external_ids: { imdb_id: 'tt11280740' },
              seasons: [{ season_number: 1, name: '第 1 季', episode_count: 2 }],
            }),
            { status: 200 },
          );
        }
        if (url.includes('/tv/95396?') && url.includes('language=en-US')) {
          return new Response(
            JSON.stringify({
              id: 95396,
              name: 'Severance',
              original_name: 'Severance',
              overview: 'English plot overview',
              first_air_date: '2022-02-18',
              episode_run_time: [50],
              status: 'Returning Series',
              poster_path: '/en_poster.jpg',
              backdrop_path: '/backdrop.jpg',
              vote_average: 8.4,
              vote_count: 1500,
              genres: [
                { id: 18, name: 'Drama' },
                { id: 10765, name: 'Sci-Fi & Fantasy' },
              ],
              seasons: [{ season_number: 1, name: 'Season 1', episode_count: 2 }],
            }),
            { status: 200 },
          );
        }
        if (url.includes('/tv/95396/season/1?') && url.includes('language=zh-CN')) {
          return new Response(
            JSON.stringify({
              season_number: 1,
              name: '第 1 季',
              episodes: [
                {
                  episode_number: 1,
                  name: '关于地狱的好消息',
                  air_date: '2022-02-18',
                  runtime: 57,
                  still_path: '/s1e1.jpg',
                  overview: '第一集中文简介',
                },
                {
                  episode_number: 2,
                  name: '第 2 集',
                  air_date: '2022-02-18',
                  runtime: 47,
                  still_path: null,
                  overview: '',
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (url.includes('/tv/95396/season/1?') && url.includes('language=en-US')) {
          return new Response(
            JSON.stringify({
              season_number: 1,
              name: 'Season 1',
              episodes: [
                {
                  episode_number: 1,
                  name: 'Good News About Hell',
                  air_date: '2022-02-18',
                  runtime: 57,
                  still_path: '/s1e1.jpg',
                  overview: 'Episode 1 English overview',
                },
                {
                  episode_number: 2,
                  name: 'Episode 2',
                  air_date: '2022-02-18',
                  runtime: 47,
                  still_path: null,
                  overview: '',
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response('Not Found', { status: 404 });
      };

      const { title, seasons } = await fetchTmdbTitleDetails('tv', '95396', { fetchFn: mockFetch });
      expect(title.names).toEqual({
        original: 'Severance',
        zh: '人生切割术',
        en: 'Severance',
      });
      expect(title.overview).toEqual({
        zh: '中文剧情简介',
        en: 'English plot overview',
      });
      expect(title.genreIds).toEqual([18, 10765]);
      expect(seasons).toHaveLength(1);
      // Generic season name ("第 1 季" / "Season 1") is normalized to null
      expect(seasons[0].name).toBeNull();
      // Episode 1 has real bilingual names
      expect(seasons[0].episodes[0].name).toEqual({
        zh: '关于地狱的好消息',
        en: 'Good News About Hell',
      });
      expect(seasons[0].episodes[0].overview).toEqual({
        zh: '第一集中文简介',
        en: 'Episode 1 English overview',
      });
      // Episode 2 had generic names ("第 2 集" / "Episode 2") -> normalized to null
      expect(seasons[0].episodes[1].name).toBeNull();
    } finally {
      if (prevToken === undefined) {
        delete process.env.TMDB_READ_TOKEN;
      } else {
        process.env.TMDB_READ_TOKEN = prevToken;
      }
    }
  });

  it('6. migration 002 nulls generic season/episode labels and splits uploader prefix out of link-import overviews', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhenji-mig002-test-'));
    const dbPath = path.join(tmpDir, 'tracker.db');
    try {
      new TrackerRepository({ dataDir: tmpDir, migrateTo: 1 }).close();
      const db = new DatabaseSync(dbPath);

      const legacyTitle = {
        source: 'url',
        sourceId: 'https://www.youtube.com/watch?v=abc',
        mediaType: 'other',
        names: { original: 'Test Video', zh: 'Test Video' },
        displayLang: null,
        year: 2024,
        runtimeMin: 10,
        genres: [],
        posterPath: null,
        backdropPath: null,
        overview: { zh: '作者：3Blue1Brown · 线性代数的本质合集' },
        showStatus: 'Ended',
        externalIds: {},
        ratings: {},
        manualState: null,
        playthroughs: [{ id: 'p1', number: 1, startedAt: 1000 }],
        activePlaythroughId: 'p1',
        resume: null,
        metaFetchedAt: 1000,
        addedAt: 1000,
        updatedAt: 1000,
        lastActivityAt: 1000,
      };
      db.prepare('INSERT INTO titles (id, data, added_at, updated_at) VALUES (?, ?, ?, ?)').run(
        'url_1',
        JSON.stringify(legacyTitle),
        1000,
        1000,
      );

      const legacySeason = {
        seasonNumber: 1,
        name: '第 1 季',
        episodes: [
          {
            number: 1,
            key: 's1e1',
            name: '第 1 集',
            airDate: '2024-01-01',
            runtime: 10,
            stillPath: null,
            overview: {},
          },
          {
            number: 2,
            key: 's1e2',
            name: 'Custom Episode Title',
            airDate: '2024-01-02',
            runtime: 12,
            stillPath: null,
            overview: {},
          },
        ],
      };
      db.prepare('INSERT INTO seasons (title_id, season_number, data) VALUES (?, ?, ?)').run(
        'url_1',
        1,
        JSON.stringify(legacySeason),
      );
      db.close();

      // Opening TrackerRepository runs migrations 002, 003, and 004 automatically
      const db2 = new DatabaseSync(dbPath);
      const legacyMovie = {
        source: 'tmdb',
        sourceId: '438631',
        mediaType: 'movie',
        names: { original: 'Dune', zh: '沙丘' },
        displayLang: null,
        year: 2021,
        runtimeMin: 155,
        genres: [],
        posterPath: 'https://image.tmdb.org/t/p/w500/zh_only.jpg',
        backdropPath: null,
        overview: { zh: '简介' },
        showStatus: 'Released',
        externalIds: {},
        ratings: {},
        manualState: null,
        playthroughs: [{ id: 'p1', number: 1, startedAt: 1000 }],
        activePlaythroughId: 'p1',
        resume: null,
        metaFetchedAt: 1000,
        addedAt: 1000,
        updatedAt: 1000,
        lastActivityAt: 1000,
      };
      db2
        .prepare('INSERT INTO titles (id, data, added_at, updated_at) VALUES (?, ?, ?, ?)')
        .run('tmdb_movie_438631', JSON.stringify(legacyMovie), 1000, 1000);
      db2.close();

      const repo = new TrackerRepository({ dataDir: tmpDir });
      const state = repo.getState();
      const migratedTitle = state.titles['url_1'];
      expect(migratedTitle?.uploader).toBe('3Blue1Brown');
      expect(migratedTitle?.overview.zh).toBe('线性代数的本质合集');
      expect(migratedTitle?.releaseDate).toBe('2024-01-01');
      expect(migratedTitle?.posters).toBeUndefined();

      // Migration 004 removes posters when posters.en === posters.zh and resets synthetic ${year}-01-01 releaseDate to null
      const migratedMovie = state.titles['tmdb_movie_438631'];
      expect(migratedMovie?.posters).toBeUndefined();
      expect(migratedMovie?.releaseDate).toBeNull();

      const migratedSeasons = state.seasonsByTitle['url_1'];
      expect(migratedSeasons?.[0]?.name).toBeNull();
      expect(migratedSeasons?.[0]?.episodes[0]?.name).toBeNull();
      expect(migratedSeasons?.[0]?.episodes[1]?.name).toEqual({
        zh: 'Custom Episode Title',
      });
      repo.close();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('7. TMDB images selection fills posters.zh/en only from images.posters with iso_639_1 zh/en and keeps detail.poster_path only as defaultPosterPath', async () => {
    const prevToken = process.env.TMDB_READ_TOKEN;
    process.env.TMDB_READ_TOKEN = 'mock-tmdb-token';
    try {
      const mockFetch: typeof fetch = async (input) => {
        const url = String(input);
        if (url.includes('/movie/438631?') && url.includes('language=zh-CN')) {
          return new Response(
            JSON.stringify({
              id: 438631,
              title: '沙丘',
              original_title: 'Dune',
              overview: '中文简介',
              release_date: '2021-10-22',
              runtime: 155,
              status: 'Released',
              poster_path: '/zh_default.jpg',
              backdrop_path: '/default_bd.jpg',
              genres: [{ id: 878, name: '科幻' }],
              external_ids: { imdb_id: 'tt1160419' },
              images: {
                posters: [
                  { file_path: '/zh_tw.jpg', iso_639_1: 'zh', iso_3166_1: 'TW', vote_average: 9.0, vote_count: 10 },
                  { file_path: '/zh_cn.jpg', iso_639_1: 'zh', iso_3166_1: 'CN', vote_average: 7.5, vote_count: 5 },
                  { file_path: '/en_low.jpg', iso_639_1: 'en', iso_3166_1: 'US', vote_average: 6.0, vote_count: 4 },
                  { file_path: '/en_high.jpg', iso_639_1: 'en', iso_3166_1: 'US', vote_average: 8.5, vote_count: 12 },
                  { file_path: '/clean.jpg', iso_639_1: null, iso_3166_1: null, vote_average: 8.0, vote_count: 8 },
                ],
                backdrops: [
                  { file_path: '/en_bd.jpg', iso_639_1: 'en', iso_3166_1: 'US', vote_average: 9.5, vote_count: 20 },
                  {
                    file_path: '/textless_bd.jpg',
                    iso_639_1: null,
                    iso_3166_1: null,
                    vote_average: 7.0,
                    vote_count: 5,
                  },
                ],
              },
            }),
            { status: 200 },
          );
        }
        if (url.includes('/movie/438631?') && url.includes('language=en-US')) {
          return new Response(
            JSON.stringify({
              id: 438631,
              title: 'Dune',
              original_title: 'Dune',
              overview: 'English overview',
              release_date: '2021-10-22',
              runtime: 155,
              status: 'Released',
              poster_path: '/en_default.jpg',
              backdrop_path: '/default_bd.jpg',
              genres: [{ id: 878, name: 'Science Fiction' }],
            }),
            { status: 200 },
          );
        }
        if (url.includes('/movie/999999?') && url.includes('language=zh-CN')) {
          return new Response(
            JSON.stringify({
              id: 999999,
              title: '无语言海报电影',
              original_title: 'Fallback Only Movie',
              overview: '简介',
              release_date: '2022-05-10',
              runtime: 100,
              status: 'Released',
              poster_path: '/fallback_default.jpg',
              backdrop_path: null,
              genres: [],
              images: { posters: [], backdrops: [] },
            }),
            { status: 200 },
          );
        }
        if (url.includes('/movie/999999?') && url.includes('language=en-US')) {
          return new Response(
            JSON.stringify({
              id: 999999,
              title: 'Fallback Only Movie',
              original_title: 'Fallback Only Movie',
              overview: 'Overview',
              release_date: '2022-05-10',
              runtime: 100,
              status: 'Released',
              poster_path: '/fallback_en.jpg',
              backdrop_path: null,
              genres: [],
            }),
            { status: 200 },
          );
        }
        return new Response('Not Found', { status: 404 });
      };

      const { title } = await fetchTmdbTitleDetails('movie', '438631', { fetchFn: mockFetch });
      expect(title.releaseDate).toBe('2021-10-22');
      expect(title.posters).toEqual({
        zh: '/zh_cn.jpg',
        en: '/en_high.jpg',
        textless: '/clean.jpg',
      });
      expect(title.backdropPath).toBe('/textless_bd.jpg');

      // When images.posters has no iso_639_1 'zh' or 'en' entries, posters.zh and posters.en are not filled from detail.poster_path
      const { title: fallbackTitle } = await fetchTmdbTitleDetails('movie', '999999', {
        fetchFn: mockFetch,
      });
      expect(fallbackTitle.posters).toEqual({});
      expect(fallbackTitle.posterPath).toBe('/fallback_default.jpg');
    } finally {
      if (prevToken === undefined) {
        delete process.env.TMDB_READ_TOKEN;
      } else {
        process.env.TMDB_READ_TOKEN = prevToken;
      }
    }
  });

  it('English counts use the singular for one', () => {
    expect(en.library.countLabel(1)).toBe('1 title');
    expect(en.library.countLabel(21)).toBe('21 titles');
    expect(en.lists.countLabel(1)).toBe('1 list');
    expect(en.lists.countLabel(0)).toBe('0 lists');
    expect(en.lists.totalTitlesLabel('1')).toBe('1 title');
    expect(en.upstream.counts(1, 0)).toBe('1 watched mark mapped · 0 retained in the archive');
    expect(en.upstream.archivedCount(2)).toBe('2 watched marks retained for missing episodes');
    expect(en.upstream.skippedEntries(1)).toBe('Skipped 1 live or upcoming entry.');
    expect(en.detail.menu.refreshPlaylistAddedToast(1)).toBe('Playlist refreshed (1 new episode)');
    expect(en.search.linkImport.playlistPreviewLabel(1)).toBe('1 episode');
  });
});
