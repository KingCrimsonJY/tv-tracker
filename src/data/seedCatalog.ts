import type { ProgressDoc, SeasonDoc, TitleDoc, WatchListDoc, ListEntryDoc } from '../domain/types.ts';

function makeCinemaSvgDataUri(config: {
  width: number;
  height: number;
  bgStart: string;
  bgEnd: string;
  accent: string;
  titleZh: string;
  subtitleEn: string;
  year: number;
  badge: string;
}): string {
  const { width, height, bgStart, bgEnd, accent, subtitleEn, badge } = config;
  const isLandscape = width > height;
  const cx = isLandscape ? width * 0.68 : width * 0.5;
  const cy = isLandscape ? height * 0.42 : height * 0.42;
  const rBase = Math.min(width, height);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgStart}" />
        <stop offset="100%" stop-color="${bgEnd}" />
      </linearGradient>
      <radialGradient id="glow" cx="${isLandscape ? '68%' : '50%'}" cy="38%" r="62%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.38" />
        <stop offset="55%" stop-color="${accent}" stop-opacity="0.1" />
        <stop offset="100%" stop-color="${bgEnd}" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="scrim" x1="0%" y1="35%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#09090b" stop-opacity="0" />
        <stop offset="100%" stop-color="#09090b" stop-opacity="0.82" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)" />
    <rect width="${width}" height="${height}" fill="url(#glow)" />
    <g stroke="${accent}" stroke-opacity="0.22" stroke-width="1.5" fill="none">
      <circle cx="${cx}" cy="${cy}" r="${rBase * 0.31}" />
      <circle cx="${cx}" cy="${cy}" r="${rBase * 0.21}" stroke-dasharray="6 6" />
      <circle cx="${cx}" cy="${cy}" r="${rBase * 0.11}" fill="${accent}" fill-opacity="0.08" />
      <line x1="0" y1="${cy}" x2="${width}" y2="${cy}" stroke-opacity="0.1" />
      <line x1="${cx}" y1="0" x2="${cx}" y2="${height}" stroke-opacity="0.1" />
    </g>
    <rect width="${width}" height="${height}" fill="url(#scrim)" />
    ${
      !isLandscape
        ? `<g transform="translate(36, 46)">
            <text x="0" y="0" fill="${accent}" fill-opacity="0.85" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="600" letter-spacing="2.5">${badge}</text>
            <text x="0" y="22" fill="#a1a1aa" fill-opacity="0.65" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="500" letter-spacing="1.5">${subtitleEn}</text>
          </g>`
        : ''
    }
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export interface CatalogItem {
  tmdbId: string;
  mediaType: 'movie' | 'tv';
  title: TitleDoc;
  seasons: SeasonDoc[];
}

export const SEED_CATALOG: CatalogItem[] = [
  {
    tmdbId: '95396',
    mediaType: 'tv',
    title: {
      id: 'tmdb_tv_95396',
      source: 'tmdb',
      sourceId: '95396',
      mediaType: 'tv',
      names: {
        original: 'Severance',
        zh: '人生切割术',
        en: 'Severance',
      },
      displayLang: null,
      year: 2022,
      runtimeMin: 50,
      genres: ['剧情', '悬疑', '科幻'],
      posterPath: 'https://image.tmdb.org/t/p/w500/s69hd1WlHYuE4XmAlIm7iAIhuTo.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/w1280/ixgFmf1X59PUZam2qbAfskx2gQr.jpg',
      overview: {
        zh: '马克领导着卢蒙工业的一支办公室团队，这里的员工都接受了“记忆切割”手术，将工作记忆与个人生活记忆彻底分离。当一位神秘同事出现在工作之外时，一场揭示工作真相的旅程就此展开。',
        en: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.',
      },
      showStatus: 'Returning Series',
      externalIds: { imdb: 'tt11280740', douban: '34894753' },
      ratings: {
        imdb: '8.7',
        imdbVotes: '245,000',
        rottenTomatoes: '97%',
        metacritic: '83',
        douban: '9.1',
        fetchedAt: 1730100000000,
      },
      manualState: null,
      playthroughs: [{ id: 'p1', number: 1, startedAt: 1730000000000 }],
      activePlaythroughId: 'p1',
      resume: {
        episodeKey: 's2e2',
        seconds: 2535, // 42:15
        updatedAt: 1730100000000,
      },
      metaFetchedAt: 1730100000000,
      addedAt: 1730000000000,
      updatedAt: 1730100000000,
      lastActivityAt: 1730100000000,
    },
    seasons: [
      {
        seasonNumber: 0,
        name: '特别篇',
        episodes: [
          {
            number: 1,
            key: 's0e1',
            name: '卢蒙员工入职指南',
            airDate: '2022-02-10',
            runtime: 12,
            stillPath: null,
            overview: { zh: '卢蒙工业内部培训短片与幕后访谈。' },
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
            name: '关于地狱的好消息',
            airDate: '2022-02-18',
            runtime: 57,
            stillPath: null,
            overview: { zh: '马克被提拔为宏观数据精检部门主管，负责指导新员工海莉。' },
          },
          {
            number: 2,
            key: 's1e2',
            name: '半环路',
            airDate: '2022-02-18',
            runtime: 47,
            stillPath: null,
            overview: { zh: '团队协助海莉适应新工作；外面的马克与前同事佩蒂秘密会面。' },
          },
          {
            number: 3,
            key: 's1e3',
            name: '永恒之中',
            airDate: '2022-02-25',
            runtime: 51,
            stillPath: null,
            overview: { zh: '海莉试图向外界传递辞职请求，而马克带领团队参观永恒之翼展厅。' },
          },
          {
            number: 4,
            key: 's1e4',
            name: '你就是你',
            airDate: '2022-03-04',
            runtime: 46,
            stillPath: null,
            overview: { zh: '欧文在办公室发现一本遗落的外界书籍，海莉采取极端手段抗议。' },
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
            name: '你好，科贝尔女士',
            airDate: '2025-01-17',
            runtime: 54,
            stillPath: null,
            overview: { zh: '加班应急机制被触发后，马克重返切割层寻找失踪的队友。' },
          },
          {
            number: 2,
            key: 's2e2',
            name: '再见，塞尔维格夫人',
            airDate: '2025-01-24',
            runtime: 49,
            stillPath: null,
            overview: { zh: '外界对卢蒙工业的调查升级，切割层内部迎来了意想不到的新变动。' },
          },
          {
            number: 3,
            key: 's2e3',
            name: '暗室低语',
            airDate: '2025-01-31',
            runtime: 52,
            stillPath: null,
            overview: { zh: '迪伦与欧文拼凑出通往测试层走廊的地图线索。' },
          },
          {
            number: 4,
            key: 's2e4',
            name: '凛冬荒原（未播）',
            airDate: '2027-03-15',
            runtime: 55,
            stillPath: null,
            overview: { zh: '团队迎来首次户外团建测试。' },
          },
        ],
      },
    ],
  },
  {
    tmdbId: '136315',
    mediaType: 'tv',
    title: {
      id: 'tmdb_tv_136315',
      source: 'tmdb',
      sourceId: '136315',
      mediaType: 'tv',
      names: {
        original: 'The Bear',
        zh: '大熊餐厅',
        en: 'The Bear',
      },
      displayLang: null,
      year: 2022,
      runtimeMin: 34,
      genres: ['剧情', '喜剧'],
      posterPath: 'https://image.tmdb.org/t/p/w500/7y1ibpkTwlKYrxFbq3lh2RgIB1k.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/w1280/aJtG4txtmiRHwAAqENQHZvBs6kY.jpg',
      overview: {
        zh: '年轻的高级餐厅主厨卡米回到芝加哥接手家族经营的意大利牛肉三明治小店，在混乱的后厨与债务压力中努力重塑团队与自我。',
        en: 'A young chef from the fine dining world returns to Chicago to run his family sandwich shop.',
      },
      showStatus: 'Returning Series',
      externalIds: { imdb: 'tt14452776', douban: '35797769' },
      ratings: {
        imdb: '8.6',
        imdbVotes: '210,000',
        rottenTomatoes: '96%',
        douban: '8.8',
        fetchedAt: 1730000000000,
      },
      manualState: null,
      playthroughs: [{ id: 'p1', number: 1, startedAt: 1720000000000 }],
      activePlaythroughId: 'p1',
      resume: null,
      metaFetchedAt: 1730000000000,
      addedAt: 1720000000000,
      updatedAt: 1725000000000,
      lastActivityAt: 1725000000000,
    },
    seasons: [
      {
        seasonNumber: 1,
        name: '第 1 季',
        episodes: [
          {
            number: 1,
            key: 's1e1',
            name: '系统',
            airDate: '2022-06-23',
            runtime: 29,
            stillPath: null,
            overview: { zh: '卡米试图在老旧的牛肉三明治店引入法式后厨旅制，遭到老员工抵触。' },
          },
          {
            number: 2,
            key: 's1e2',
            name: '双手',
            airDate: '2022-06-23',
            runtime: 30,
            stillPath: null,
            overview: { zh: '卫生检查员突然造访暴露了餐厅的多重隐患。' },
          },
          {
            number: 3,
            key: 's1e3',
            name: '旅队',
            airDate: '2022-06-23',
            runtime: 25,
            stillPath: null,
            overview: { zh: '卡米将后厨管理权交给悉尼，测试全新的备餐流程。' },
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
            name: '牛肉',
            airDate: '2026-10-25',
            runtime: 33,
            stillPath: null,
            overview: { zh: '团队制定在十二周内将老店改造为高档餐厅的激进计划。' },
          },
          {
            number: 2,
            key: 's2e2',
            name: '意面',
            airDate: '2026-10-28',
            runtime: 32,
            stillPath: null,
            overview: { zh: '悉尼与卡米各自寻找新菜单灵感，装修工程却频频受阻。' },
          },
        ],
      },
    ],
  },
  {
    tmdbId: '693134',
    mediaType: 'movie',
    title: {
      id: 'tmdb_movie_693134',
      source: 'tmdb',
      sourceId: '693134',
      mediaType: 'movie',
      names: {
        original: 'Dune: Part Two',
        zh: '沙丘2',
        en: 'Dune: Part Two',
      },
      displayLang: null,
      year: 2024,
      runtimeMin: 166,
      genres: ['科幻', '冒险'],
      posterPath: 'https://image.tmdb.org/t/p/w500/aYKyogZGZmrdn5QdEzPvViBkkVZ.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/w1280/eZ239CUp1d6OryZEBPnO2n87gMG.jpg',
      overview: {
        zh: '保罗·厄崔迪与契妮和弗雷曼人联手，向毁灭他家族的阴谋者展开复仇。面对一生挚爱与已知宇宙命运之间的抉择，他努力阻止只有他能预见的可怕未来。',
        en: 'Paul Atreides unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family.',
      },
      showStatus: 'Released',
      externalIds: { imdb: 'tt15239678', douban: '35503073' },
      ratings: {
        imdb: '8.5',
        imdbVotes: '520,000',
        rottenTomatoes: '92%',
        metacritic: '79',
        douban: '8.2',
        fetchedAt: 1710010000000,
      },
      manualState: null,
      playthroughs: [{ id: 'p1', number: 1, startedAt: 1710000000000, completedAt: 1710010000000 }],
      activePlaythroughId: 'p1',
      resume: null,
      metaFetchedAt: 1710010000000,
      addedAt: 1710000000000,
      updatedAt: 1710010000000,
      lastActivityAt: 1710010000000,
    },
    seasons: [],
  },
  {
    tmdbId: '872585',
    mediaType: 'movie',
    title: {
      id: 'tmdb_movie_872585',
      source: 'tmdb',
      sourceId: '872585',
      mediaType: 'movie',
      names: {
        original: 'Oppenheimer',
        zh: '奥本海默',
        en: 'Oppenheimer',
      },
      displayLang: null,
      year: 2023,
      runtimeMin: 180,
      genres: ['剧情', '历史'],
      posterPath: 'https://image.tmdb.org/t/p/w500/rsIPinYsOSzTMQgy1cRZwzuMUzs.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/w1280/neeNHeXjMF5fXoCJRsOmkNGC7q.jpg',
      overview: {
        zh: '聚焦美国理论物理学家罗伯特·奥本海默在二战期间领导洛斯阿拉莫斯实验室参与“曼哈顿计划”研制原子弹的历程，以及战后听证会带来的深远冲击。',
        en: 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.',
      },
      showStatus: 'Released',
      externalIds: { imdb: 'tt15398776', douban: '35593344' },
      ratings: {
        imdb: '8.9',
        imdbVotes: '810,000',
        rottenTomatoes: '93%',
        metacritic: '90',
        douban: '8.8',
        fetchedAt: 1729000000000,
      },
      manualState: null,
      playthroughs: [{ id: 'p1', number: 1, startedAt: 1715000000000 }],
      activePlaythroughId: 'p1',
      resume: { episodeKey: null, seconds: 4320, updatedAt: 1729000000000 },
      metaFetchedAt: 1715000000000,
      addedAt: 1715000000000,
      updatedAt: 1729000000000,
      lastActivityAt: 1729000000000,
    },
    seasons: [],
  },
  {
    tmdbId: '100088',
    mediaType: 'tv',
    title: {
      id: 'tmdb_tv_100088',
      source: 'tmdb',
      sourceId: '100088',
      mediaType: 'tv',
      names: {
        original: 'The Last of Us',
        zh: '最后生还者',
        en: 'The Last of Us',
      },
      displayLang: null,
      year: 2023,
      runtimeMin: 58,
      genres: ['剧情', '动作', '科幻'],
      posterPath: 'https://image.tmdb.org/t/p/w500/ydyTjqxZsPlcFSTBNY2INYrmEvk.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/w1280/lY2DhbA7Hy44fAKddr06UrXWWaQ.jpg',
      overview: {
        zh: '在现代文明被真菌感染摧毁二十年后，饱经风霜的幸存者乔尔受雇将14岁的女孩艾莉偷运出高压隔离区。原本看似平常的差事很快演变成一场横跨美国的残酷旅程。',
        en: 'After a global pandemic destroys civilization, a hardened survivor takes charge of a 14-year-old girl who may be humanitys last hope.',
      },
      showStatus: 'Returning Series',
      externalIds: { imdb: 'tt3581920' },
      ratings: { imdb: '8.7', douban: '9.0', fetchedAt: 1718000000000 },
      manualState: null,
      playthroughs: [{ id: 'p1', number: 1, startedAt: 1718000000000 }],
      activePlaythroughId: 'p1',
      resume: null,
      metaFetchedAt: 1718000000000,
      addedAt: 1718000000000,
      updatedAt: 1718000000000,
      lastActivityAt: 1718000000000,
    },
    seasons: [
      {
        seasonNumber: 1,
        name: '第 1 季',
        episodes: [
          {
            number: 1,
            key: 's1e1',
            name: '迷失在黑暗中时',
            airDate: '2023-01-15',
            runtime: 81,
            stillPath: null,
            overview: { zh: '虫草菌爆发二十年后，乔尔与泰丝受火萤组织委托护送少女艾莉。' },
          },
          {
            number: 2,
            key: 's1e2',
            name: '感染者',
            airDate: '2023-01-22',
            runtime: 53,
            stillPath: null,
            overview: { zh: '乔尔、泰丝和艾莉穿越荒废的波士顿历史博物馆。' },
          },
          {
            number: 3,
            key: 's1e3',
            name: '漫长岁月',
            airDate: '2023-01-29',
            runtime: 76,
            stillPath: null,
            overview: { zh: '比尔与弗兰克在末日小镇相互扶持二十年的故事。' },
          },
        ],
      },
    ],
  },
  {
    tmdbId: '157336',
    mediaType: 'movie',
    title: {
      id: 'tmdb_movie_157336',
      source: 'tmdb',
      sourceId: '157336',
      mediaType: 'movie',
      names: {
        original: 'Interstellar',
        zh: '星际穿越',
        en: 'Interstellar',
      },
      displayLang: null,
      year: 2014,
      runtimeMin: 169,
      genres: ['科幻', '剧情', '冒险'],
      posterPath: 'https://image.tmdb.org/t/p/w500/spQm5r317XPNHK1941ChWmqzkZs.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/w1280/8sNiAPPYU14PUepFNeSNGUTiHW.jpg',
      overview: {
        zh: '地球环境急剧恶化，前NASA宇航员库珀与科学家团队穿越土星附近的虫洞，前往遥远星系寻找适合人类延续的新家园。',
        en: 'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel.',
      },
      showStatus: 'Released',
      externalIds: { imdb: 'tt0816692', douban: '1889243' },
      ratings: { imdb: '8.7', douban: '9.4', fetchedAt: 1705000000000 },
      manualState: null,
      playthroughs: [{ id: 'p1', number: 1, startedAt: 1705000000000 }],
      activePlaythroughId: 'p1',
      resume: null,
      metaFetchedAt: 1705000000000,
      addedAt: 1705000000000,
      updatedAt: 1705000000000,
      lastActivityAt: 1705000000000,
    },
    seasons: [],
  },
];

export interface InitialDemoDataset {
  titles: Record<string, TitleDoc>;
  seasonsByTitle: Record<string, SeasonDoc[]>;
  progressByTitle: Record<string, Record<string, ProgressDoc>>;
  lists: Record<string, WatchListDoc>;
  entriesByList: Record<string, ListEntryDoc[]>;
}

export function buildInitialDemoDataset(): InitialDemoDataset {
  const titles: Record<string, TitleDoc> = {};
  const seasonsByTitle: Record<string, SeasonDoc[]> = {};
  const progressByTitle: Record<string, Record<string, ProgressDoc>> = {};

  // Include first 4 items in the library by default
  const initialItems = SEED_CATALOG.slice(0, 4);
  for (const item of initialItems) {
    titles[item.title.id] = structuredClone(item.title);
    seasonsByTitle[item.title.id] = structuredClone(item.seasons);
  }

  // 1. Severance: S1 (4 eps) + S2E1 watched, currently resuming S2E2 at 42:15 -> status 观看中 (Continue Watching)
  progressByTitle['tmdb_tv_95396'] = {
    p1: {
      playthroughId: 'p1',
      watched: {
        s1e1: Date.parse('2026-09-01T12:00:00Z'),
        s1e2: Date.parse('2026-09-02T12:00:00Z'),
        s1e3: Date.parse('2026-09-03T12:00:00Z'),
        s1e4: Date.parse('2026-09-04T12:00:00Z'),
        s2e1: Date.parse('2026-10-01T12:00:00Z'),
      },
    },
  };

  // 2. The Bear: S1 (all 3 eps) watched on 2026-10-10; S2E1 & S2E2 aired on 2026-10-25 & 2026-10-28 -> status 观看中 + 有新集!
  progressByTitle['tmdb_tv_136315'] = {
    p1: {
      playthroughId: 'p1',
      watched: {
        s1e1: Date.parse('2026-10-08T12:00:00Z'),
        s1e2: Date.parse('2026-10-09T12:00:00Z'),
        s1e3: Date.parse('2026-10-10T12:00:00Z'),
      },
    },
  };

  // 3. Dune: Part Two: Completed movie -> 已看完
  progressByTitle['tmdb_movie_693134'] = {
    p1: {
      playthroughId: 'p1',
      watched: {},
      movieWatchedAt: Date.parse('2026-08-20T20:00:00Z'),
    },
  };

  // 4. Oppenheimer: Movie with resume at 1:12:00 (4320s) -> 观看中
  progressByTitle['tmdb_movie_872585'] = {
    p1: {
      playthroughId: 'p1',
      watched: {},
    },
  };

  const lists: Record<string, WatchListDoc> = {
    list_scifi_order: {
      id: 'list_scifi_order',
      name: '硬核科幻必看顺序',
      kind: 'ordered',
      description: '从反乌托邦职场到星际史诗的沉浸式观影路线。',
      pinned: true,
      rank: 'a0',
      collectionSort: 'manual',
      createdAt: 1720000000000,
    },
    list_weekend_picks: {
      id: 'list_weekend_picks',
      name: '周末高分精选合集',
      kind: 'collection',
      description: '适合周末夜晚静心观看的口碑佳作。',
      pinned: false,
      rank: 'a1',
      collectionSort: 'year',
      createdAt: 1721000000000,
    },
  };

  const entriesByList: Record<string, ListEntryDoc[]> = {
    list_scifi_order: [
      {
        id: 'entry_1',
        titleId: 'tmdb_movie_693134', // Dune 2 (已看完)
        rank: 'a0',
        addedAt: 1720000001000,
      },
      {
        id: 'entry_2',
        titleId: 'tmdb_tv_95396', // Severance (观看中 -> highlighted as 下一部!)
        rank: 'a1',
        addedAt: 1720000002000,
      },
      {
        id: 'entry_3',
        titleId: 'tmdb_movie_872585', // Oppenheimer
        rank: 'a2',
        addedAt: 1720000003000,
      },
    ],
    list_weekend_picks: [
      {
        id: 'entry_4',
        titleId: 'tmdb_tv_136315',
        rank: 'a0',
        addedAt: 1721000001000,
      },
      {
        id: 'entry_5',
        titleId: 'tmdb_movie_693134',
        rank: 'a1',
        addedAt: 1721000002000,
      },
      {
        id: 'entry_6',
        titleId: 'tmdb_movie_872585',
        rank: 'a2',
        addedAt: 1721000003000,
      },
      {
        id: 'entry_7',
        titleId: 'tmdb_tv_95396',
        rank: 'a3',
        addedAt: 1721000004000,
      },
    ],
  };

  return {
    titles,
    seasonsByTitle,
    progressByTitle,
    lists,
    entriesByList,
  };
}
