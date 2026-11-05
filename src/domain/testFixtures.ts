import type { SeasonDoc, TitleDoc } from './types.ts';

export const TODAY = '2026-11-01';

export function makeBaseTvTitle(overrides: Partial<TitleDoc> = {}): TitleDoc {
  return {
    id: 'tmdb_tv_1',
    source: 'tmdb',
    sourceId: '1',
    mediaType: 'tv',
    names: { original: 'Severance', zh: '人生切割术', en: 'Severance' },
    displayLang: null,
    year: 2022,
    runtimeMin: 50,
    genres: ['剧情', '科幻'],
    posterPath: '/poster.jpg',
    backdropPath: '/backdrop.jpg',
    overview: { zh: '测试简介' },
    showStatus: 'Returning Series',
    externalIds: {},
    ratings: {},
    manualState: null,
    playthroughs: [{ id: 'p1', number: 1, startedAt: 1700000000000 }],
    activePlaythroughId: 'p1',
    resume: null,
    metaFetchedAt: 1700000000000,
    addedAt: 1700000000000,
    updatedAt: 1700000000000,
    lastActivityAt: 1700000000000,
    ...overrides,
  };
}

export function makeSampleSeasons(): SeasonDoc[] {
  return [
    {
      seasonNumber: 0,
      name: '特别篇',
      episodes: [
        {
          number: 1,
          key: 's0e1',
          name: '幕后特辑',
          airDate: '2022-01-01',
          runtime: 20,
          stillPath: null,
          overview: {},
        },
      ],
    },
    {
      seasonNumber: 1,
      name: '第 1 季',
      episodes: [
        {
          number: 1,
          key: 's1e1',
          name: '好消息关于地狱',
          airDate: '2022-02-18',
          runtime: 57,
          stillPath: null,
          overview: {},
        },
        {
          number: 2,
          key: 's1e2',
          name: '半环路',
          airDate: '2022-02-18',
          runtime: 47,
          stillPath: null,
          overview: {},
        },
        {
          number: 3,
          key: 's1e3',
          name: '永恒之中',
          airDate: '2022-02-25',
          runtime: 51,
          stillPath: null,
          overview: {},
        },
      ],
    },
    {
      seasonNumber: 2,
      name: '第 2 季',
      episodes: [
        {
          number: 1,
          key: 's2e1',
          name: '回归',
          airDate: '2026-10-10',
          runtime: 50,
          stillPath: null,
          overview: {},
        },
        {
          number: 2,
          key: 's2e2',
          name: '走廊',
          airDate: '2026-10-17',
          runtime: 49,
          stillPath: null,
          overview: {},
        },
        {
          number: 3,
          key: 's2e3',
          name: '未来一集（未播）',
          airDate: '2026-12-25',
          runtime: 52,
          stillPath: null,
          overview: {},
        },
      ],
    },
  ];
}
