import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { generateKeyBetween } from 'fractional-indexing';
import { makeEpisodeKey } from '../../src/domain/progress.ts';
import type { ProgressDoc, SeasonDoc, TitleDoc } from '../../src/domain/types.ts';
import { TrackerRepository } from '../db/repository.ts';
import { fetchTmdbTitleDetails, isTmdbConfigured } from '../providers/tmdb.ts';
import {
  buildFallbackTitleAndSeasons,
  DEMO_TMDB_SPECS,
  type DemoTitleSpec,
} from './seed-demo-fixtures.ts';

async function resolveDemoTitle(
  spec: DemoTitleSpec,
  now: number
): Promise<{ title: TitleDoc; seasons: SeasonDoc[] }> {
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
          ratings: { ...spec.ratings, ...fetched.title.ratings, fetchedAt: now },
        },
        seasons:
          fetched.seasons.length > 0
            ? fetched.seasons
            : buildFallbackTitleAndSeasons(spec, now).seasons,
      };
    } catch (err) {
      console.warn(
        `[seed-demo] TMDB live fetch failed for ${spec.mediaType}/${spec.sourceId}, using fixture:`,
        err instanceof Error ? err.message : err
      );
    }
  }
  return buildFallbackTitleAndSeasons(spec, now);
}

function buildEpisodeMap(
  seasons: SeasonDoc[],
  predicate: (seasonNumber: number, episodeNumber: number) => boolean,
  timestampBase: number
): Record<string, number> {
  const watched: Record<string, number> = {};
  let step = 0;
  for (const s of seasons) {
    if (s.seasonNumber <= 0) continue;
    for (const ep of s.episodes) {
      if (predicate(s.seasonNumber, ep.number)) {
        watched[ep.key] = timestampBase + step * 3_600_000;
        step++;
      }
    }
  }
  return watched;
}

async function main() {
  const targetDir = path.resolve(process.env.DATA_DIR || './data-demo');
  const prodDataDir = path.resolve('./data');
  if (targetDir === prodDataDir) {
    console.error('Refusing to run seed:demo against ./data. Use DATA_DIR=./data-demo.');
    process.exit(1);
  }

  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }

  const repo = new TrackerRepository({ dataDir: targetDir });
  const now = Date.now();
  const dayMs = 86_400_000;

  console.log(`[seed-demo] Seeding demo database in ${targetDir} ...`);

  for (const spec of DEMO_TMDB_SPECS) {
    const { title, seasons } = await resolveDemoTitle(spec, now);
    const id = title.id;

    if (id === 'tmdb_tv_95396') {
      // Severance: 观看中 with resume time 42:15 on S2E5 (S1 all + S2 E1-E4 watched)
      const watched = buildEpisodeMap(
        seasons,
        (s, e) => s === 1 || (s === 2 && e <= 4),
        now - 10 * dayMs
      );
      repo.putTitle(id, {
        title: {
          ...title,
          resume: { episodeKey: 's2e5', seconds: 42 * 60 + 15, updatedAt: now - 3600_000 },
          addedAt: now - 25 * dayMs,
          updatedAt: now - 3600_000,
          lastActivityAt: now - 3600_000,
        },
        seasons,
        progress: { p1: { playthroughId: 'p1', watched } },
      });
    } else if (id === 'tmdb_tv_136315') {
      // The Bear: 观看中 + 有新集 (S1 & S2 watched before S3 aired in 2024-06)
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
    } else if (id === 'tmdb_tv_125988') {
      // Silo: 已追平 (All aired countable episodes watched, Returning Series)
      const watched = buildEpisodeMap(seasons, () => true, now - 14 * dayMs);
      repo.putTitle(id, {
        title: {
          ...title,
          addedAt: now - 30 * dayMs,
          updatedAt: now - 3 * dayMs,
          lastActivityAt: now - 3 * dayMs,
        },
        seasons,
        progress: { p1: { playthroughId: 'p1', watched } },
      });
    } else if (id === 'tmdb_tv_1396') {
      // Breaking Bad: 二刷中 (Playthrough 1 completed, Playthrough 2 watching S2E4 at 28:40)
      const p1Watched = buildEpisodeMap(seasons, () => true, now - 180 * dayMs);
      const p2Watched = buildEpisodeMap(
        seasons,
        (s, e) => s === 1 || (s === 2 && e <= 3),
        now - 7 * dayMs
      );
      repo.putTitle(id, {
        title: {
          ...title,
          playthroughs: [
            {
              id: 'p1',
              number: 1,
              startedAt: now - 200 * dayMs,
              completedAt: now - 150 * dayMs,
            },
            {
              id: 'p2',
              number: 2,
              startedAt: now - 7 * dayMs,
            },
          ],
          activePlaythroughId: 'p2',
          resume: { episodeKey: 's2e4', seconds: 28 * 60 + 40, updatedAt: now - 12 * 3600_000 },
          addedAt: now - 200 * dayMs,
          updatedAt: now - 12 * 3600_000,
          lastActivityAt: now - 12 * 3600_000,
        },
        seasons,
        progress: {
          p1: { playthroughId: 'p1', watched: p1Watched },
          p2: { playthroughId: 'p2', watched: p2Watched },
        },
      });
    } else if (id === 'tmdb_tv_87108' || id === 'tmdb_tv_94605') {
      // Chernobyl & Arcane: 已看完
      const watched = buildEpisodeMap(seasons, () => true, now - 45 * dayMs);
      repo.putTitle(id, {
        title: {
          ...title,
          playthroughs: [
            {
              id: 'p1',
              number: 1,
              startedAt: now - 50 * dayMs,
              completedAt: now - 40 * dayMs,
            },
          ],
          addedAt: now - 50 * dayMs,
          updatedAt: now - 40 * dayMs,
          lastActivityAt: now - 40 * dayMs,
        },
        seasons,
        progress: { p1: { playthroughId: 'p1', watched } },
      });
    } else if (id === 'tmdb_movie_693134') {
      // Dune: Part Two: 观看中 with resume time 1:18:20
      repo.putTitle(id, {
        title: {
          ...title,
          resume: { episodeKey: null, seconds: 78 * 60 + 20, updatedAt: now - 6 * 3600_000 },
          addedAt: now - 5 * dayMs,
          updatedAt: now - 6 * 3600_000,
          lastActivityAt: now - 6 * 3600_000,
        },
        seasons: [],
        progress: { p1: { playthroughId: 'p1', watched: {} } },
      });
    } else if (
      id === 'tmdb_movie_872585' ||
      id === 'tmdb_movie_157336' ||
      [
        'tmdb_movie_1726',
        'tmdb_movie_1771',
        'tmdb_movie_24428',
        'tmdb_movie_100402',
        'tmdb_movie_118340',
        'tmdb_movie_99861',
      ].includes(id)
    ) {
      // Completed movies (Oppenheimer, Interstellar, and first 6 MCU movies)
      const watchedAt = now - 20 * dayMs;
      repo.putTitle(id, {
        title: {
          ...title,
          playthroughs: [
            { id: 'p1', number: 1, startedAt: watchedAt, completedAt: watchedAt },
          ],
          addedAt: watchedAt - 5 * dayMs,
          updatedAt: watchedAt,
          lastActivityAt: watchedAt,
        },
        seasons: [],
        progress: { p1: { playthroughId: 'p1', watched: {}, movieWatchedAt: watchedAt } },
      });
    } else {
      // Unwatched titles (Spider-Verse, Anatomy of a Fall, Fallout, and remaining 4 MCU movies)
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

  // Add 1 custom item (Bilibili series: 我的三体：章北海传)
  const customId = 'custom_bilibili_threebody';
  const customSeasons: SeasonDoc[] = [
    {
      seasonNumber: 1,
      name: '第 1 季',
      episodes: Array.from({ length: 9 }, (_, idx) => ({
        number: idx + 1,
        key: makeEpisodeKey(1, idx + 1),
        name: `第 ${idx + 1} 章`,
        airDate: '2020-01-21',
        runtime: 28,
        stillPath: 'https://image.tmdb.org/t/p/w300/8sNiAPPYU14PUepFNeSNGUTiHW.jpg',
        overview: { zh: '' },
      })),
    },
  ];
  const customWatched: Record<string, number> = {};
  for (let i = 1; i <= 6; i++) {
    customWatched[makeEpisodeKey(1, i)] = now - (10 - i) * dayMs;
  }
  const customProgress: Record<string, ProgressDoc> = {
    p1: { playthroughId: 'p1', watched: customWatched },
  };
  repo.putTitle(customId, {
    title: {
      id: customId,
      source: 'url',
      sourceId: 'https://www.bilibili.com/bangumi/media/md28223051',
      mediaType: 'tv',
      names: {
        original: '我的三体之章北海传',
        zh: '我的三体之章北海传',
        en: 'My Three Body: Legend of Zhang Beihai',
      },
      displayLang: null,
      year: 2020,
      runtimeMin: 28,
      genres: ['科幻', '动画'],
      posterPath: 'https://image.tmdb.org/t/p/w500/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/w1280/8sNiAPPYU14PUepFNeSNGUTiHW.jpg',
      overview: {
        zh: '故事发生在从近未来到两百年后的历史跨度上，地球文明被三体用智子锁死后，人类组建太空舰队，章北海在危机纪元中坚定执行深空战略。',
      },
      showStatus: 'Ended',
      externalIds: {},
      ratings: {},
      manualState: null,
      playthroughs: [{ id: 'p1', number: 1, startedAt: now - 12 * dayMs }],
      activePlaythroughId: 'p1',
      resume: { episodeKey: 's1e7', seconds: 16 * 60 + 45, updatedAt: now - 18 * 3600_000 },
      metaFetchedAt: now,
      addedAt: now - 12 * dayMs,
      updatedAt: now - 18 * 3600_000,
      lastActivityAt: now - 18 * 3600_000,
    },
    seasons: customSeasons,
    progress: customProgress,
  });

  // Create Ordered List: "漫威观影顺序" (10 entries)
  const mcuListId = 'list_marvel_order';
  const mcuListRank = generateKeyBetween(null, null);
  repo.putList(mcuListId, {
    name: '漫威观影顺序',
    description: '漫威无限传奇阶段核心作品观看顺序，自动高亮下一部待看',
    kind: 'ordered',
    pinned: true,
    rank: mcuListRank,
    collectionSort: 'added',
    createdAt: now - 25 * dayMs,
  });

  const mcuTitleIds = [
    'tmdb_movie_1726',
    'tmdb_movie_1771',
    'tmdb_movie_24428',
    'tmdb_movie_100402',
    'tmdb_movie_118340',
    'tmdb_movie_99861',
    'tmdb_movie_271110',
    'tmdb_movie_284054',
    'tmdb_movie_299536',
    'tmdb_movie_299534',
  ];
  let prevRank: string | null = null;
  for (let i = 0; i < mcuTitleIds.length; i++) {
    const rank = generateKeyBetween(prevRank, null);
    prevRank = rank;
    repo.putListEntry(mcuListId, `entry_mcu_${i + 1}`, {
      titleId: mcuTitleIds[i]!,
      rank,
      addedAt: now - (25 - i) * dayMs,
    });
  }

  // Create Collection List: "想看"
  const watchlistId = 'list_watchlist_collection';
  const watchlistRank = generateKeyBetween(mcuListRank, null);
  repo.putList(watchlistId, {
    name: '想看',
    description: '近期口碑佳作与周末待看片单',
    kind: 'collection',
    pinned: false,
    rank: watchlistRank,
    collectionSort: 'added',
    createdAt: now - 15 * dayMs,
  });

  const watchlistTitleIds = [
    'tmdb_movie_569094',
    'tmdb_movie_915935',
    'tmdb_tv_106379',
    'tmdb_movie_271110',
  ];
  let wPrevRank: string | null = null;
  for (let i = 0; i < watchlistTitleIds.length; i++) {
    const rank = generateKeyBetween(wPrevRank, null);
    wPrevRank = rank;
    repo.putListEntry(watchlistId, `entry_watch_${i + 1}`, {
      titleId: watchlistTitleIds[i]!,
      rank,
      addedAt: now - (10 - i) * dayMs,
    });
  }

  repo.close();
  console.log(
    `[seed-demo] Done! Seeded ${DEMO_TMDB_SPECS.length + 1} titles and 2 lists in ${targetDir}.`
  );
}

main().catch((err) => {
  console.error('[seed-demo] Failed:', err);
  process.exit(1);
});
