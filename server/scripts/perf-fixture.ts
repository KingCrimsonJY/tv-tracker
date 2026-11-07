import type { EpisodeMeta, SeasonDoc, TitleDoc } from '../../src/domain/types.ts';
import type { TrackerRepository } from '../db/repository.ts';

export const PERF_TITLE_COUNT = 300;
export const PERF_LONG_TITLE = 'url_perf_564';
export const PERF_FIRST_TITLE = 'tmdb_tv_1000';

// Deterministic, varied bilingual text: realistic payload sizes without upstream requests.
const words =
  'journey harbor family discovery mountain secret friendship winter city memory summer promise visitor tomorrow shadow river school return letter garden distant future morning festival courage village hidden station choice reunion'.split(
    ' ',
  );
const phrases = [
  '城市的清晨',
  '久别的朋友',
  '未知的旅程',
  '家庭的回忆',
  '山间的约定',
  '新的线索',
  '冬日的港口',
  '失落的信件',
  '等待的明天',
  '勇敢的选择',
  '遥远的故乡',
  '意外的重逢',
  '独自的寻找',
  '安静的街道',
  '夏天的故事',
  '彼此的秘密',
];
function overview(seed: number) {
  let state = seed + 1;
  const next = (size: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state >>> 10) % size;
  };
  return {
    en: Array.from({ length: 42 }, () => words[next(words.length)]).join(' ') + '.',
    zh: Array.from({ length: 28 }, () => phrases[next(phrases.length)]).join('，') + '。',
  };
}

export function seedPerfFixture(repo: TrackerRepository, now = Date.now()) {
  for (let index = 0; index < PERF_TITLE_COUNT; index++) {
    const movie = index >= 288;
    const id = index === 287 ? PERF_LONG_TITLE : movie ? `tmdb_movie_${1000 + index}` : `tmdb_tv_${1000 + index}`;
    const count = movie ? 0 : index === 287 ? 564 : index === 286 ? 150 : 40;
    const episodes: EpisodeMeta[] = Array.from({ length: count }, (_, offset) => {
      const number = offset + 1;
      return {
        key: `s1e${number}`,
        number,
        tmdbEpisodeId: index * 1000 + number,
        name: {
          en: `Episode ${number}: ${words[(index + offset) % words.length]}`,
          zh: `第 ${number} 集：${phrases[(index + offset) % phrases.length]}`,
        },
        airDate: new Date(Date.UTC(2022, 0, 1 + offset * 7)).toISOString().slice(0, 10),
        runtime: 24 + (number % 30),
        stillPath: `/perf-assets/icon.svg?still=${index}-${number}`,
        overview: overview(index * 1000 + number),
        ...(index === 287 ? { sourceVideoId: `BVperf${number}` } : {}),
      };
    });
    // Every fixture episode has aired, including the long Bilibili archive.
    for (const episode of episodes)
      episode.airDate = '2024-' + String(1 + (episode.number % 12)).padStart(2, '0') + '-01';
    const seasons: SeasonDoc[] = movie ? [] : [{ seasonNumber: 1, name: null, episodes }];
    const title: TitleDoc = {
      id,
      source: index === 287 ? 'url' : 'tmdb',
      sourceId: index === 287 ? 'https://space.bilibili.com/1/lists/1?type=series' : String(1000 + index),
      mediaType: movie ? 'movie' : index === 287 ? 'other' : 'tv',
      names: {
        original: index === 287 ? 'Long archive' : `Series ${String(index).padStart(3, '0')}`,
        en: index === 287 ? 'Long archive' : `Series ${String(index).padStart(3, '0')}`,
        zh: index === 287 ? '长篇合集' : `影视作品 ${index}`,
      },
      displayLang: null,
      year: 2024,
      runtimeMin: movie ? 118 : 30,
      genres: ['Drama'],
      genreIds: [18],
      posterPath: `/perf-assets/icon.svg?poster=${index}`,
      backdropPath: `/perf-assets/icon.svg?backdrop=${index}`,
      overview: overview(index),
      showStatus: 'Ended',
      externalIds: {},
      ratings: { tmdb: '8.1', fetchedAt: now },
      manualState: null,
      playthroughs: [{ id: 'p1', number: 1, startedAt: now }],
      activePlaythroughId: 'p1',
      resume: null,
      metaFetchedAt: now,
      addedAt: now - index * 1000,
      updatedAt: now,
      lastActivityAt: now - index * 1000,
    };
    const watched = index < 6 ? Object.fromEntries(episodes.slice(0, 10).map((episode) => [episode.key, now])) : {};
    repo.putTitle(id, { title, seasons, progress: { p1: { playthroughId: 'p1', watched } } });
  }
  repo.patchSettings({
    uiLang: 'en',
    homeSections: [
      { id: 'continue_watching', enabled: true },
      { id: 'new_episodes', enabled: true },
      { id: 'pinned_lists', enabled: true },
      { id: 'recently_added', enabled: true },
      { id: 'watchlist', enabled: false },
    ],
  });
}
