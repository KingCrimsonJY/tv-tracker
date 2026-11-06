import type { SeasonDoc, TitleDoc } from './types.ts';

export const TODAY = '2026-11-01';

export function makeBaseTvTitle(overrides: Partial<TitleDoc> = {}): TitleDoc {
  return {
    id: 'tmdb_tv_1',
    source: 'tmdb',
    sourceId: '1',
    mediaType: 'tv',
    names: { original: 'Severance', zh: '\u4eba\u751f\u5207\u5272\u672f', en: 'Severance' },
    displayLang: null,
    year: 2022,
    runtimeMin: 50,
    genres: ['Drama', 'Sci-Fi & Fantasy'],
    genreIds: [18, 10765],
    posterPath: '/poster.jpg',
    backdropPath: '/backdrop.jpg',
    overview: { zh: '\u6d4b\u8bd5\u7b80\u4ecb', en: 'Test overview' },
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
      name: null,
      episodes: [
        {
          number: 1,
          key: 's0e1',
          name: { en: 'Behind the Scenes' },
          airDate: '2022-01-01',
          runtime: 20,
          stillPath: null,
          overview: {},
        },
      ],
    },
    {
      seasonNumber: 1,
      name: null,
      episodes: [
        {
          number: 1,
          key: 's1e1',
          name: { en: 'Good News About Hell' },
          airDate: '2022-02-18',
          runtime: 57,
          stillPath: null,
          overview: {},
        },
        {
          number: 2,
          key: 's1e2',
          name: { en: 'Half Loop' },
          airDate: '2022-02-18',
          runtime: 47,
          stillPath: null,
          overview: {},
        },
        {
          number: 3,
          key: 's1e3',
          name: { en: 'In Perpetuity' },
          airDate: '2022-02-25',
          runtime: 51,
          stillPath: null,
          overview: {},
        },
      ],
    },
    {
      seasonNumber: 2,
      name: null,
      episodes: [
        {
          number: 1,
          key: 's2e1',
          name: { en: 'Hello, Ms. Cobel' },
          airDate: '2026-10-10',
          runtime: 50,
          stillPath: null,
          overview: {},
        },
        {
          number: 2,
          key: 's2e2',
          name: { en: 'Goodbye, Mrs. Selvig' },
          airDate: '2026-10-17',
          runtime: 49,
          stillPath: null,
          overview: {},
        },
        {
          number: 3,
          key: 's2e3',
          name: { en: 'Who Is Alive?' },
          airDate: '2026-12-25',
          runtime: 52,
          stillPath: null,
          overview: {},
        },
      ],
    },
  ];
}
