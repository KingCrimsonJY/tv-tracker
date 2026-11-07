import 'dotenv/config';
import { createDemoDirectory } from './demoDirectory.ts';
import fs from 'node:fs';
import path from 'node:path';
import { generateKeyBetween } from 'fractional-indexing';
import {
  computeTitleState,
  toLocalDateString,
  makeEpisodeKey,
} from '../../src/domain/progress.ts';
import type { ProgressDoc, SeasonDoc, TitleDoc } from '../../src/domain/types.ts';
import { TrackerRepository } from '../db/repository.ts';
import { fetchTmdbTitleDetails, isTmdbConfigured } from '../providers/tmdb.ts';
import { mapYtdlpJsonToLinkResult } from '../providers/ytdlp.ts';
import {
  buildFallbackTitleAndSeasons,
  DEMO_TMDB_SPECS,
  type DemoTitleSpec,
} from './seed-demo-fixtures.ts';

async function resolveDemoTitle(
  spec: DemoTitleSpec,
  now: number
): Promise<{ title: TitleDoc; seasons: SeasonDoc[] }> {
  const fallback = buildFallbackTitleAndSeasons(spec, now);
  if (isTmdbConfigured()) {
    try {
      const fetched = await fetchTmdbTitleDetails(spec.mediaType, spec.sourceId);
      return {
        title: {
          ...fetched.title,
          externalIds: {
            ...fetched.title.externalIds,
            imdb: fetched.title.externalIds.imdb || spec.imdbId,
          },
          ratings: { ...fallback.title.ratings, ...fetched.title.ratings, fetchedAt: now },
        },
        seasons:
          fetched.seasons.length > 0
            ? fetched.seasons
            : fallback.seasons,
      };
    } catch (err) {
      console.warn(
        `[seed-demo] TMDB live fetch failed for ${spec.mediaType}/${spec.sourceId}, using fixture:`,
        err instanceof Error ? err.message : err
      );
    }
  }
  return fallback;
}

function buildEpisodeMap(
  seasons: SeasonDoc[],
  predicate: (seasonNumber: number, episodeNumber: number, airDate: string | null) => boolean,
  timestampBase: number
): Record<string, number> {
  const watched: Record<string, number> = {};
  let step = 0;
  for (const s of seasons) {
    if (s.seasonNumber <= 0) continue;
    for (const ep of s.episodes) {
      if (predicate(s.seasonNumber, ep.number, ep.airDate)) {
        watched[ep.key] = timestampBase + step * 3_600_000;
        step++;
      }
    }
  }
  return watched;
}

function loadYtdlpFixture(filename: string, inputUrl: string) {
  const fixturePath = path.resolve(import.meta.dirname, 'fixtures', filename);
  const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
  return mapYtdlpJsonToLinkResult(raw, inputUrl);
}

async function main() {
  const targetDir = createDemoDirectory();

  const repo = new TrackerRepository({ dataDir: targetDir });
  const now = Date.now();
  const dayMs = 86_400_000;
  const todayStr = toLocalDateString(new Date(now));

  console.log(`[seed-demo] Seeding curated demo database in ${targetDir} ...`);

  const completedMcuIds = new Set([
    'tmdb_movie_1771',
    'tmdb_movie_1726',
    'tmdb_movie_24428',
  ]);

  for (const spec of DEMO_TMDB_SPECS) {
    const { title, seasons } = await resolveDemoTitle(spec, now);
    const id = title.id;

    if (id === 'tmdb_tv_1396') {
      // Breaking Bad: ended, fully watched (已看完)
      const watched = buildEpisodeMap(
        seasons,
        (_s, _e, airDate) => Boolean(airDate && airDate <= todayStr),
        now - 120 * dayMs
      );
      repo.putTitle(id, {
        title: {
          ...title,
          showStatus: 'Ended',
          playthroughs: [
            {
              id: 'p1',
              number: 1,
              startedAt: now - 150 * dayMs,
              completedAt: now - 90 * dayMs,
            },
          ],
          activePlaythroughId: 'p1',
          addedAt: now - 150 * dayMs,
          updatedAt: now - 90 * dayMs,
          lastActivityAt: now - 90 * dayMs,
        },
        seasons,
        progress: { p1: { playthroughId: 'p1', watched } },
      });
    } else if (id === 'tmdb_tv_95396') {
      // Severance: returning series, caught up to the latest aired episode (已追平);
      // if not possible, watching with a resume time (继续 S2E5 42:15)
      const allAiredWatched = buildEpisodeMap(
        seasons,
        (_s, _e, airDate) => Boolean(airDate && airDate <= todayStr),
        now - 14 * dayMs
      );
      const candidateTitle: TitleDoc = {
        ...title,
        addedAt: now - 25 * dayMs,
        updatedAt: now - 2 * dayMs,
        lastActivityAt: now - 2 * dayMs,
      };
      const candidateState = computeTitleState(
        candidateTitle,
        seasons,
        { playthroughId: 'p1', watched: allAiredWatched },
        { includeSpecials: false, todayStr }
      );
      if (candidateState.status === 'caught_up') {
        repo.putTitle(id, {
          title: candidateTitle,
          seasons,
          progress: { p1: { playthroughId: 'p1', watched: allAiredWatched } },
        });
      } else {
        const partialWatched = buildEpisodeMap(
          seasons,
          (s, e) => s === 1 || (s === 2 && e <= 4),
          now - 10 * dayMs
        );
        repo.putTitle(id, {
          title: {
            ...candidateTitle,
            resume: { episodeKey: 's2e5', seconds: 42 * 60 + 15, updatedAt: now - 3600_000 },
          },
          seasons,
          progress: { p1: { playthroughId: 'p1', watched: partialWatched } },
        });
      }
    } else if (id === 'tmdb_tv_136315') {
      // The Bear: watching with 有新集 (S1 & S2 watched before S3 aired in 2024-06)
      const beforeS3 = new Date('2024-05-10T12:00:00Z').getTime();
      const watched = buildEpisodeMap(seasons, (s) => s <= 2, beforeS3 - 10 * dayMs);
      repo.putTitle(id, {
        title: {
          ...title,
          addedAt: beforeS3 - 20 * dayMs,
          updatedAt: now - 2 * dayMs,
          lastActivityAt: now - 2 * dayMs,
        },
        seasons,
        progress: { p1: { playthroughId: 'p1', watched } },
      });
    } else if (id === 'tmdb_movie_129') {
      // Spirited Away: watched once, second watch in progress (二刷中)
      const firstWatchAt = now - 180 * dayMs;
      repo.putTitle(id, {
        title: {
          ...title,
          playthroughs: [
            {
              id: 'p1',
              number: 1,
              startedAt: firstWatchAt,
              completedAt: firstWatchAt,
            },
            {
              id: 'p2',
              number: 2,
              startedAt: now - 2 * dayMs,
            },
          ],
          activePlaythroughId: 'p2',
          resume: { episodeKey: null, seconds: 54 * 60 + 20, updatedAt: now - 4 * 3600_000 },
          addedAt: firstWatchAt - 5 * dayMs,
          updatedAt: now - 4 * 3600_000,
          lastActivityAt: now - 4 * 3600_000,
        },
        seasons: [],
        progress: {
          p1: { playthroughId: 'p1', watched: {}, movieWatchedAt: firstWatchAt },
          p2: { playthroughId: 'p2', watched: {} },
        },
      });
    } else if (id === 'tmdb_tv_209867') {
      // Frieren: Beyond Journey's End: anime added through TMDB, watching (S1 E1-E16 watched, resume on S1E17 14:20)
      const watched = buildEpisodeMap(
        seasons,
        (s, e) => s === 1 && e <= 16,
        now - 12 * dayMs
      );
      repo.putTitle(id, {
        title: {
          ...title,
          resume: { episodeKey: 's1e17', seconds: 14 * 60 + 20, updatedAt: now - 2 * 3600_000 },
          addedAt: now - 20 * dayMs,
          updatedAt: now - 2 * 3600_000,
          lastActivityAt: now - 2 * 3600_000,
        },
        seasons,
        progress: { p1: { playthroughId: 'p1', watched } },
      });
    } else if (completedMcuIds.has(id)) {
      // First 5 MCU movies in story order: 已看完
      const watchedAt = now - 30 * dayMs;
      repo.putTitle(id, {
        title: {
          ...title,
          playthroughs: [{ id: 'p1', number: 1, startedAt: watchedAt, completedAt: watchedAt }],
          addedAt: watchedAt - 5 * dayMs,
          updatedAt: watchedAt,
          lastActivityAt: watchedAt,
        },
        seasons: [],
        progress: { p1: { playthroughId: 'p1', watched: {}, movieWatchedAt: watchedAt } },
      });
    } else {
      // Unwatched titles (remaining 5 MCU movies + Collection "想看" movies)
      repo.putTitle(id, {
        title: {
          ...title,
          addedAt: now - 8 * dayMs,
          updatedAt: now - 8 * dayMs,
          lastActivityAt: now - 8 * dayMs,
        },
        seasons,
        progress: { p1: { playthroughId: 'p1', watched: {} } },
      });
    }
  }

  // Seed link-import item #1: 3Blue1Brown "Essence of linear algebra" YouTube playlist (from fixture JSON)
  const ytLinkResult = loadYtdlpFixture(
    'ytdlp-3b1b-youtube.json',
    'https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab'
  );
  const ytId = 'url_yt_3b1b_linear_algebra';
  const ytSeasons: SeasonDoc[] = [
    {
      seasonNumber: 1,
      name: null,
      episodes: ytLinkResult.episodes.map((ep, idx) => ({
        number: idx + 1,
        key: makeEpisodeKey(1, idx + 1),
        name: ep.name ? { zh: ep.name, en: ep.name } : null,
        airDate: '2016-08-04',
        runtime: ep.runtime ?? null,
        stillPath: ytLinkResult.posterUrl,
        overview: {},
        sourceVideoId: ep.sourceVideoId,
      })),
    },
  ];
  const ytWatched: Record<string, number> = {};
  for (let i = 1; i <= 6; i++) {
    ytWatched[makeEpisodeKey(1, i)] = now - (10 - i) * dayMs;
  }
  const ytProgress: Record<string, ProgressDoc> = {
    p1: { playthroughId: 'p1', watched: ytWatched },
  };
  repo.putTitle(ytId, {
    title: {
      id: ytId,
      source: 'url',
      sourceId: ytLinkResult.sourceUrl,
      uploader: ytLinkResult.uploader ?? null,
      mediaType: 'other',
      names: {
        original: ytLinkResult.title,
        zh: ytLinkResult.title,
        en: ytLinkResult.title,
      },
      displayLang: null,
      year: ytLinkResult.year ?? 2016,
      runtimeMin: 11,
      genres: ['数学', '教程'],
      posterPath: ytLinkResult.posterUrl,
      backdropPath: ytLinkResult.posterUrl,
      overview: { zh: ytLinkResult.overview, en: ytLinkResult.overview },
      showStatus: 'Ended',
      externalIds: {},
      ratings: {},
      manualState: null,
      playthroughs: [{ id: 'p1', number: 1, startedAt: now - 10 * dayMs }],
      activePlaythroughId: 'p1',
      resume: { episodeKey: 's1e7', seconds: 5 * 60 + 40, updatedAt: now - 8 * 3600_000 },
      metaFetchedAt: now,
      addedAt: now - 10 * dayMs,
      updatedAt: now - 8 * 3600_000,
      lastActivityAt: now - 8 * 3600_000,
    },
    seasons: ytSeasons,
    progress: ytProgress,
  });

  // Seed link-import item #2: 3Blue1Brown official Bilibili 合集 "【官方双语】线性代数的本质" (from fixture JSON)
  const biliLinkResult = loadYtdlpFixture(
    'ytdlp-3b1b-bilibili.json',
    'https://space.bilibili.com/88461692/lists/1528924?type=season'
  );
  const biliId = 'url_bili_3b1b_linear_algebra';
  const biliSeasons: SeasonDoc[] = [
    {
      seasonNumber: 1,
      name: null,
      episodes: biliLinkResult.episodes.map((ep, idx) => ({
        number: idx + 1,
        key: makeEpisodeKey(1, idx + 1),
        name: ep.name ? { zh: ep.name, en: ep.name } : null,
        airDate: '2016-08-25',
        runtime: ep.runtime ?? null,
        stillPath: biliLinkResult.posterUrl,
        overview: {},
        sourceVideoId: ep.sourceVideoId,
      })),
    },
  ];
  const biliWatched: Record<string, number> = {};
  for (let i = 1; i <= 9; i++) {
    biliWatched[makeEpisodeKey(1, i)] = now - (14 - i) * dayMs;
  }
  const biliProgress: Record<string, ProgressDoc> = {
    p1: { playthroughId: 'p1', watched: biliWatched },
  };
  repo.putTitle(biliId, {
    title: {
      id: biliId,
      source: 'url',
      sourceId: biliLinkResult.sourceUrl,
      uploader: biliLinkResult.uploader ?? null,
      mediaType: 'other',
      names: {
        original: biliLinkResult.title,
        zh: biliLinkResult.title,
        en: 'Essence of linear algebra (Bilibili Collection)',
      },
      displayLang: null,
      year: biliLinkResult.year ?? 2016,
      runtimeMin: 11,
      genres: ['数学', '双语'],
      posterPath: biliLinkResult.posterUrl,
      backdropPath: biliLinkResult.posterUrl,
      overview: { zh: biliLinkResult.overview },
      showStatus: 'Ended',
      externalIds: {},
      ratings: {},
      manualState: null,
      playthroughs: [{ id: 'p1', number: 1, startedAt: now - 14 * dayMs }],
      activePlaythroughId: 'p1',
      resume: null,
      metaFetchedAt: now,
      addedAt: now - 14 * dayMs,
      updatedAt: now - 5 * dayMs,
      lastActivityAt: now - 5 * dayMs,
    },
    seasons: biliSeasons,
    progress: biliProgress,
  });

  // Create Ordered List: "漫威无限传奇观影顺序" (10 MCU films in story order, first 5 watched)
  const mcuListId = 'list_marvel_order';
  const mcuListRank = generateKeyBetween(null, null);
  repo.putList(mcuListId, {
    name: '漫威无限传奇观影顺序',
    description: '漫威无限传奇阶段核心作品故事时间线观影顺序，自动高亮下一部待看',
    kind: 'ordered',
    pinned: true,
    rank: mcuListRank,
    collectionSort: 'added',
    createdAt: now - 25 * dayMs,
  });

  const mcuTitleIds = [
    'tmdb_movie_1771', // Captain America: The First Avenger (已看完)
    'tmdb_movie_1726', // Iron Man (已看完)
    'tmdb_movie_24428', // The Avengers (已看完)
    'tmdb_movie_100402', // Captain America: The Winter Soldier (已看完)
    'tmdb_movie_118340', // Guardians of the Galaxy (已看完)
    'tmdb_movie_99861', // Avengers: Age of Ultron (下一部待看)
    'tmdb_movie_271110', // Captain America: Civil War (未看)
    'tmdb_movie_284054', // Black Panther (未看)
    'tmdb_movie_299536', // Avengers: Infinity War (未看)
    'tmdb_movie_299534', // Avengers: Endgame (未看)
  ];
  let prevRank: string | null = null;
  for (let i = 0; i < mcuTitleIds.length; i++) {
    const rank = generateKeyBetween(prevRank, null);
    prevRank = rank;
    repo.putListEntry(mcuListId, `entry_mcu_${i + 1}`, {
      titleId: mcuTitleIds[i],
      rank,
      addedAt: now - (25 - i) * dayMs,
    });
  }

  // Create Collection List: "想看" (The Godfather, In the Mood for Love, Parasite, Interstellar)
  const watchlistId = 'list_watchlist_collection';
  const watchlistRank = generateKeyBetween(mcuListRank, null);
  repo.putList(watchlistId, {
    name: '想看',
    description: '影史经典与周末待看佳作片单',
    kind: 'collection',
    pinned: false,
    rank: watchlistRank,
    collectionSort: 'added',
    createdAt: now - 15 * dayMs,
  });

  const watchlistTitleIds = [
    'tmdb_movie_238', // The Godfather
    'tmdb_movie_843', // In the Mood for Love
    'tmdb_movie_496243', // Parasite
    'tmdb_movie_157336', // Interstellar
  ];
  let wPrevRank: string | null = null;
  for (let i = 0; i < watchlistTitleIds.length; i++) {
    const rank = generateKeyBetween(wPrevRank, null);
    wPrevRank = rank;
    repo.putListEntry(watchlistId, `entry_watch_${i + 1}`, {
      titleId: watchlistTitleIds[i],
      rank,
      addedAt: now - (10 - i) * dayMs,
    });
  }

  // Verify each seeded title's TMDB ID / source and computed status at seed time
  const state = repo.getState();
  const expectations: Array<{
    id: string;
    expectedSourceId: string;
    expectedStatuses: Array<ReturnType<typeof computeTitleState>['status']>;
    expectNewEpisodes?: boolean;
    expectRewatching?: boolean;
    label: string;
  }> = [
    {
      id: 'tmdb_tv_1396',
      expectedSourceId: '1396',
      expectedStatuses: ['completed'],
      label: 'Breaking Bad (已看完)',
    },
    {
      id: 'tmdb_tv_95396',
      expectedSourceId: '95396',
      expectedStatuses: ['caught_up', 'watching'],
      label: 'Severance (已追平 / 观看中)',
    },
    {
      id: 'tmdb_tv_136315',
      expectedSourceId: '136315',
      expectedStatuses: ['watching'],
      expectNewEpisodes: true,
      label: 'The Bear (观看中 + 有新集)',
    },
    {
      id: 'tmdb_movie_129',
      expectedSourceId: '129',
      expectedStatuses: ['watching'],
      expectRewatching: true,
      label: 'Spirited Away (二刷中)',
    },
    {
      id: 'tmdb_tv_209867',
      expectedSourceId: '209867',
      expectedStatuses: ['watching'],
      label: "Frieren: Beyond Journey's End (观看中)",
    },
    {
      id: 'tmdb_movie_238',
      expectedSourceId: '238',
      expectedStatuses: ['unwatched'],
      label: 'The Godfather (未看)',
    },
    {
      id: 'tmdb_movie_843',
      expectedSourceId: '843',
      expectedStatuses: ['unwatched'],
      label: 'In the Mood for Love (未看)',
    },
    {
      id: 'tmdb_movie_496243',
      expectedSourceId: '496243',
      expectedStatuses: ['unwatched'],
      label: 'Parasite (未看)',
    },
    {
      id: 'tmdb_movie_157336',
      expectedSourceId: '157336',
      expectedStatuses: ['unwatched'],
      label: 'Interstellar (未看)',
    },
    {
      id: 'url_yt_3b1b_linear_algebra',
      expectedSourceId: 'https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab',
      expectedStatuses: ['watching'],
      label: '3Blue1Brown YouTube Playlist (观看中, 16 episodes)',
    },
    {
      id: 'url_bili_3b1b_linear_algebra',
      expectedSourceId: 'https://space.bilibili.com/88461692/lists/1528924?type=season',
      expectedStatuses: ['watching'],
      label: '3Blue1Brown Bilibili 合集 (观看中, 16 episodes)',
    },
  ];

  for (const exp of expectations) {
    const t = state.titles[exp.id];
    if (!t) {
      throw new Error(`[seed-demo] Verification failed: missing title ${exp.id}`);
    }
    if (t.sourceId !== exp.expectedSourceId) {
      throw new Error(
        `[seed-demo] Verification failed for ${exp.id}: expected sourceId=${exp.expectedSourceId}, got ${t.sourceId}`
      );
    }
    const seasons = state.seasonsByTitle[exp.id] || [];
    const progress = state.progressByTitle[exp.id]?.[t.activePlaythroughId];
    const computed = computeTitleState(t, seasons, progress, {
      includeSpecials: state.settings.includeSpecials,
      todayStr,
    });
    if (!exp.expectedStatuses.includes(computed.status)) {
      throw new Error(
        `[seed-demo] Verification failed for ${exp.id} (${exp.label}): expected status in [${exp.expectedStatuses.join(', ')}], got ${computed.status}`
      );
    }
    if (exp.expectNewEpisodes && !computed.hasNewEpisodes) {
      throw new Error(
        `[seed-demo] Verification failed for ${exp.id} (${exp.label}): expected hasNewEpisodes=true`
      );
    }
    if (exp.expectRewatching && !computed.isRewatching) {
      throw new Error(
        `[seed-demo] Verification failed for ${exp.id} (${exp.label}): expected isRewatching=true`
      );
    }
    console.log(
      `[seed-demo] Verified ${exp.id} (sourceId=${t.sourceId}): status=${computed.status}${
        computed.hasNewEpisodes ? ' [有新集]' : ''
      }${computed.isRewatching ? ' [二刷中]' : ''}`
    );
  }

  repo.close();
  console.log(
    `[seed-demo] Done! Seeded ${Object.keys(state.titles).length} titles and ${
      Object.keys(state.lists).length
    } lists in ${targetDir}.`
  );
}

main().catch((err) => {
  console.error('[seed-demo] Failed:', err);
  process.exit(1);
});
