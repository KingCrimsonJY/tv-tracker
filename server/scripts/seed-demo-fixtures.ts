import { makeEpisodeKey } from '../../src/domain/progress.ts';
import type { EpisodeMeta, Ratings, SeasonDoc, TitleDoc } from '../../src/domain/types.ts';
import { tmdbImageUrl } from '../providers/tmdb.ts';

export interface DemoTitleSpec {
  mediaType: 'movie' | 'tv';
  sourceId: string;
  zhName: string;
  originalName: string;
  enName: string;
  year: number;
  runtimeMin: number;
  genres: string[];
  posterHash: string;
  backdropHash: string;
  showStatus: string | null;
  imdbId: string;
  doubanId: string;
  ratings: Omit<Ratings, 'fetchedAt'>;
  overviewZh: string;
  seasons?: Array<{
    seasonNumber: number;
    name: string;
    episodes: Array<{
      number: number;
      name: string;
      airDate: string;
      runtime: number;
      stillHash?: string;
      overview?: string;
    }>;
  }>;
}

function genEpisodes(
  count: number,
  startDate: string,
  runtime: number,
  names?: string[],
  stills?: string[]
) {
  const baseMs = new Date(`${startDate}T00:00:00Z`).getTime();
  return Array.from({ length: count }, (_, idx) => ({
    number: idx + 1,
    name: names?.[idx] || `第 ${idx + 1} 集`,
    airDate: new Date(baseMs + idx * 7 * 86_400_000).toISOString().slice(0, 10),
    runtime,
    stillHash: stills?.[idx],
  }));
}

const SEV_S1_NAMES = [
  '关于地狱的好消息', '半环路', '永恒之中', '你就是你', '光学与设计部的残酷野蛮',
  '捉迷藏', '挑衅性爵士乐', '晚饭吃什么？', '我们就是我们',
];
const SEV_S2_NAMES = [
  '你好，科贝尔女士', '再见，塞尔维格太太', '谁还活着？', '哀伤之谷', '特洛伊木马',
  '阿提拉', '奇卡海牙', '甜蜜的硫酸盐', '下班后', '冷港',
];
const SEV_S2_STILLS = [
  '/a97vNY8Knu45FLQib0uQZ2VReLy.jpg', '/wjlSkqMoLngSO6fv2Ajt2CIeCSi.jpg',
  '/j4AUAq1XJOBmfXsLphZzsCz6pZs.jpg', '/mioOOhTaShLd1MPKsmfirbe9AwI.jpg',
  '/7Gw2DWAbhsBREKFbM2S0h5sD0tL.jpg', '/l9CC3onLMDBDKxs6Ie0yIWI8VmC.jpg',
  '/dmzBzYcEtjOYJO46p7kyRmYrHZu.jpg', '/piWjCKARsSkmr9kMKHZ5ynengj3.jpg',
  '/2RJaWjY4dD5s7jpdo2aGeSLmtI3.jpg', '/gXUvGwpZxrpqMRouxM7yI28lgNa.jpg',
];

function movieSpec(
  sourceId: string,
  zhName: string,
  originalName: string,
  year: number,
  runtimeMin: number,
  genres: string[],
  posterHash: string,
  backdropHash: string,
  imdbId: string,
  doubanId: string,
  ratings: Omit<Ratings, 'fetchedAt'>,
  overviewZh: string
): DemoTitleSpec {
  return {
    mediaType: 'movie',
    sourceId,
    zhName,
    originalName,
    enName: originalName,
    year,
    runtimeMin,
    genres,
    posterHash,
    backdropHash,
    showStatus: 'Released',
    imdbId,
    doubanId,
    ratings,
    overviewZh,
  };
}

export const DEMO_TMDB_SPECS: DemoTitleSpec[] = [
  {
    mediaType: 'tv',
    sourceId: '95396',
    zhName: '人生切割术',
    originalName: 'Severance',
    enName: 'Severance',
    year: 2022,
    runtimeMin: 50,
    genres: ['剧情', '悬疑', '科幻'],
    posterHash: '/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg',
    backdropHash: '/ixgFmf1X59PUZam2qbAfskx2gQr.jpg',
    showStatus: 'Returning Series',
    imdbId: 'tt11280740',
    doubanId: '34894753',
    ratings: { douban: '9.1', imdb: '8.7', rottenTomatoes: '97%', metacritic: '84' },
    overviewZh:
      '马克领导着卢蒙工业的一支办公室团队，这里的员工都接受了“记忆切割”手术，工作记忆与个人生活记忆被彻底分离。当一位神秘同事出现在办公室外时，揭示工作真相的旅程就此展开。',
    seasons: [
      { seasonNumber: 1, name: '第 1 季', episodes: genEpisodes(9, '2022-02-18', 48, SEV_S1_NAMES) },
      { seasonNumber: 2, name: '第 2 季', episodes: genEpisodes(10, '2025-01-17', 52, SEV_S2_NAMES, SEV_S2_STILLS) },
    ],
  },
  {
    mediaType: 'tv',
    sourceId: '136315',
    zhName: '大熊餐厅',
    originalName: 'The Bear',
    enName: 'The Bear',
    year: 2022,
    runtimeMin: 34,
    genres: ['剧情', '喜剧'],
    posterHash: '/eKfVzzEazSIjJMrw9ADa2x8ksLz.jpg',
    backdropHash: '/aJtG4txtmiRHwAAqENQHZvBs6kY.jpg',
    showStatus: 'Returning Series',
    imdbId: 'tt14452776',
    doubanId: '35797791',
    ratings: { douban: '8.8', imdb: '8.5', rottenTomatoes: '96%', metacritic: '88' },
    overviewZh:
      '年轻的主厨卡米来自高级餐饮界，在哥哥去世后回到芝加哥接管家族的三明治小店。他在应对沉重债务、简陋厨房与脾气暴躁的厨师团队时，努力改造餐厅并治愈自我。',
    seasons: [
      { seasonNumber: 1, name: '第 1 季', episodes: genEpisodes(8, '2022-06-23', 30) },
      { seasonNumber: 2, name: '第 2 季', episodes: genEpisodes(10, '2023-06-22', 35) },
      { seasonNumber: 3, name: '第 3 季', episodes: genEpisodes(10, '2024-06-26', 34) },
    ],
  },
  {
    mediaType: 'tv',
    sourceId: '125988',
    zhName: '羊毛战记',
    originalName: 'Silo',
    enName: 'Silo',
    year: 2023,
    runtimeMin: 50,
    genres: ['科幻', '剧情', '悬疑'],
    posterHash: '/r2QXomqKjkKHVtYGGtkf2l2Y7go.jpg',
    backdropHash: '/4XccmjsOmQZw8S2iW1wvlvmb5v1.jpg',
    showStatus: 'Returning Series',
    imdbId: 'tt14688458',
    doubanId: '35465134',
    ratings: { douban: '8.1', imdb: '8.1', rottenTomatoes: '92%', metacritic: '75' },
    overviewZh:
      '在被荒芜与剧毒笼罩的未来世界，成千上万名幸存者居住在深入地下百余层的巨大筒仓中。工程师朱丽叶在调查亲人死因时，逐渐揭开筒仓背后深藏的惊人秘密。',
    seasons: [
      { seasonNumber: 1, name: '第 1 季', episodes: genEpisodes(10, '2023-05-05', 49) },
      { seasonNumber: 2, name: '第 2 季', episodes: genEpisodes(10, '2024-11-15', 50) },
    ],
  },
  {
    mediaType: 'tv',
    sourceId: '1396',
    zhName: '绝命毒师',
    originalName: 'Breaking Bad',
    enName: 'Breaking Bad',
    year: 2008,
    runtimeMin: 47,
    genres: ['剧情', '犯罪'],
    posterHash: '/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg',
    backdropHash: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
    showStatus: 'Ended',
    imdbId: 'tt0903747',
    doubanId: '2373195',
    ratings: { douban: '9.6', imdb: '9.5', rottenTomatoes: '96%', metacritic: '87' },
    overviewZh:
      '新墨西哥州的高中化学老师沃尔特·怀特被诊断出患有晚期肺癌，为了给家人留下足够的生活保障，他与曾经的学生杰西·平克曼联手制售高纯度冰毒，一步步滑向犯罪深渊。',
    seasons: [
      { seasonNumber: 1, name: '第 1 季', episodes: genEpisodes(7, '2008-01-20', 48) },
      { seasonNumber: 2, name: '第 2 季', episodes: genEpisodes(13, '2009-03-08', 47) },
      { seasonNumber: 3, name: '第 3 季', episodes: genEpisodes(13, '2010-03-21', 47) },
    ],
  },
  {
    mediaType: 'tv',
    sourceId: '87108',
    zhName: '切尔诺贝利',
    originalName: 'Chernobyl',
    enName: 'Chernobyl',
    year: 2019,
    runtimeMin: 65,
    genres: ['剧情', '历史'],
    posterHash: '/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg',
    backdropHash: '/900tHlUYUkp7Ol04XFSoAaEIXcT.jpg',
    showStatus: 'Ended',
    imdbId: 'tt7366338',
    doubanId: '27098632',
    ratings: { douban: '9.6', imdb: '9.3', rottenTomatoes: '95%', metacritic: '82' },
    overviewZh:
      '重现 1986 年苏联乌克兰切尔诺贝利核电站爆炸事故的始末，讲述科学家、消防员与矿工们为阻止灾难进一步蔓延而付出的巨大牺牲。',
    seasons: [{ seasonNumber: 1, name: '限定剧集', episodes: genEpisodes(5, '2019-05-06', 65) }],
  },
  {
    mediaType: 'tv',
    sourceId: '94605',
    zhName: '双城之战',
    originalName: 'Arcane',
    enName: 'Arcane',
    year: 2021,
    runtimeMin: 41,
    genres: ['动画', '奇幻', '动作'],
    posterHash: '/87C0wecB8bHb1PsrKBI4kJiEkgV.jpg',
    backdropHash: '/5cvnxEHT3e39DvT6ARw4GNCFrB0.jpg',
    showStatus: 'Ended',
    imdbId: 'tt11126994',
    doubanId: '34867891',
    ratings: { douban: '9.1', imdb: '9.0', rottenTomatoes: '100%' },
    overviewZh:
      '在富裕乌托邦皮尔特沃夫与压抑地下城祖安的对立升级中，蔚和金克丝两姐妹在海克斯科技与动荡冲突的裹挟下走向不同的命运。',
    seasons: [
      { seasonNumber: 1, name: '第 1 季', episodes: genEpisodes(9, '2021-11-06', 41) },
      { seasonNumber: 2, name: '第 2 季', episodes: genEpisodes(9, '2024-11-09', 41) },
    ],
  },
  {
    mediaType: 'tv',
    sourceId: '106379',
    zhName: '辐射',
    originalName: 'Fallout',
    enName: 'Fallout',
    year: 2024,
    runtimeMin: 58,
    genres: ['科幻', '动作', '冒险'],
    posterHash: '/c15BtJxCXMrISLVmysdsnZUPQft.jpg',
    backdropHash: '/coaPCIqQBPUZsOnJcWZxhaORcDT.jpg',
    showStatus: 'Returning Series',
    imdbId: 'tt12637874',
    doubanId: '35130956',
    ratings: { douban: '8.6', imdb: '8.3', rottenTomatoes: '94%' },
    overviewZh:
      '核战爆发两百年后，33 号避难所的温和居民露西被迫踏上危机四伏的洛杉矶废土表面，寻找被劫持的父亲。',
    seasons: [{ seasonNumber: 1, name: '第 1 季', episodes: genEpisodes(8, '2024-04-10', 58) }],
  },
  movieSpec('872585', '奥本海默', 'Oppenheimer', 2023, 181, ['剧情', '历史'], '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', '/neeNHeXjMF5fXoCJRsOmkNGC7q.jpg', 'tt15398776', '35593344', { douban: '8.8', imdb: '8.3', rottenTomatoes: '93%', metacritic: '90' }, '聚焦美国“原子弹之父”罗伯特·奥本海默在二战期间领导曼哈顿计划研制核武器的历程。'),
  movieSpec('693134', '沙丘2', 'Dune: Part Two', 2024, 166, ['科幻', '冒险'], '/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg', '/eZ239CUp1d6OryZEBPnO2n87gMG.jpg', 'tt15239678', '35575567', { douban: '8.2', imdb: '8.5', rottenTomatoes: '92%', metacritic: '79' }, '保罗·厄崔迪与契妮及弗雷曼人联手，对毁灭他家族的阴谋者展开复仇。'),
  movieSpec('157336', '星际穿越', 'Interstellar', 2014, 169, ['冒险', '剧情', '科幻'], '/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg', '/8sNiAPPYU14PUepFNeSNGUTiHW.jpg', 'tt0816692', '1889243', { douban: '9.4', imdb: '8.7', rottenTomatoes: '73%', metacritic: '74' }, '前宇航员库珀与一队科学家穿越虫洞展开星际航行，为人类寻找延续生命的新家园。'),
  movieSpec('569094', '蜘蛛侠：纵横宇宙', 'Spider-Man: Across the Spider-Verse', 2023, 140, ['动画', '动作', '冒险'], '/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg', '/kVd3a9YeLGkoeR50jGEXM6EqseS.jpg', 'tt9362722', '30391186', { douban: '8.5', imdb: '8.6', rottenTomatoes: '95%', metacritic: '86' }, '迈尔斯·莫拉莱斯与格温·斯黛西再度携手，穿越多元宇宙并邂逅蜘蛛侠联盟。'),
  movieSpec('915935', '坠落的审判', 'Anatomy of a Fall', 2023, 152, ['剧情', '犯罪', '悬疑'], '/1ho0d4LNZw3Y0voeKmSvPSgJOJ2.jpg', '/lDVl2jf6VB8ODl1olZ6FLvOV1gX.jpg', 'tt17009710', '35660795', { douban: '8.7', imdb: '7.7', rottenTomatoes: '96%', metacritic: '86' }, '一名男子在法国阿尔卑斯山偏远木屋坠亡，他的妻子桑德拉被控谋杀。'),
  // 10 MCU Movies for "漫威观影顺序"
  movieSpec('1726', '钢铁侠', 'Iron Man', 2008, 126, ['动作', '科幻', '冒险'], '/78lPtwv72eTNqFW9COBYI0dWDJa.jpg', '/cKvDv2LpwVEqbdXWoQl4XgGN6le.jpg', 'tt0371746', '1432146', { douban: '8.4', imdb: '7.9', rottenTomatoes: '94%' }, '托尼·斯塔克打造高科技动力装甲，化身钢铁侠守护世界。'),
  movieSpec('1771', '美国队长', 'Captain America: The First Avenger', 2011, 124, ['动作', '冒险', '科幻'], '/vSNxAJTlD0r02V9sPYpOjqDZXUK.jpg', '/yFuKvT4Vm3sKHdFY4eG6I4ldAnn.jpg', 'tt0458339', '2138838', { douban: '7.3', imdb: '6.9', rottenTomatoes: '80%' }, '二战期间，史蒂夫·罗杰斯参加超级士兵计划成为美国队长。'),
  movieSpec('24428', '复仇者联盟', 'The Avengers', 2012, 143, ['科幻', '动作', '冒险'], '/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg', '/gHLs7Fy3DzLmLsD4lmfqL55KGcl.jpg', 'tt0848228', '1866479', { douban: '8.3', imdb: '8.0', rottenTomatoes: '91%' }, '尼克·弗瑞召集地球最强英雄组建复仇者联盟迎战洛基。'),
  movieSpec('100402', '美国队长2：冬日战士', 'Captain America: The Winter Soldier', 2014, 136, ['动作', '冒险', '科幻'], '/tVFRpFw3xTedgPGqxW0AOI8Qhh0.jpg', '/jJvrPQAHFKmz4pVano4UtWTsRgA.jpg', 'tt1843866', '6390823', { douban: '8.0', imdb: '7.8', rottenTomatoes: '90%' }, '美国队长与黑寡妇、猎鹰联手揭露神盾局内部深藏的阴谋。'),
  movieSpec('118340', '银河护卫队', 'Guardians of the Galaxy', 2014, 121, ['动作', '科幻', '冒险'], '/r7vmZjiyZw9rpJMQJdXpjgiCOk9.jpg', '/uLtVbjvS1O7gXL8lUOwsFOH4man.jpg', 'tt2015381', '7065154', { douban: '8.2', imdb: '8.0', rottenTomatoes: '92%' }, '星爵与伙伴们组成银河护卫队，阻止罗南毁灭星系。'),
  movieSpec('99861', '复仇者联盟2：奥创纪元', 'Avengers: Age of Ultron', 2015, 141, ['动作', '冒险', '科幻'], '/4ssDuvEDkSArWEdyBl2X5EHvYKU.jpg', '/kIBK5SKwgqIIuRKhhWrJn3XkbPq.jpg', 'tt2395427', '10741834', { douban: '7.5', imdb: '7.3', rottenTomatoes: '76%' }, '失控的人工智能奥创企图毁灭人类，复仇者联盟再度集结。'),
  movieSpec('271110', '美国队长3：内战', 'Captain America: Civil War', 2016, 147, ['冒险', '动作', '科幻'], '/rAGiXaUfPzY7CDEyNKUofk3Kw2e.jpg', '/7FWlcZq3r6525LWOcvO9kNWurN1.jpg', 'tt3498820', '25820460', { douban: '7.9', imdb: '7.8', rottenTomatoes: '90%' }, '《索科维亚协议》引发复仇者联盟内部裂痕，两大阵营爆发正面对决。'),
  movieSpec('284054', '黑豹', 'Black Panther', 2018, 134, ['动作', '冒险', '科幻'], '/uxzzxijgPIY7slzFvMotPv8wjKA.jpg', '/b6ZJZHUdMEFECvGiDpJjlfUWela.jpg', 'tt1825683', '6390825', { douban: '6.5', imdb: '7.3', rottenTomatoes: '96%' }, '特查拉回到非洲国家瓦坎达继承王位，同时面对强敌挑战。'),
  movieSpec('299536', '复仇者联盟3：无限战争', 'Avengers: Infinity War', 2018, 149, ['冒险', '动作', '科幻'], '/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg', '/mDfJG3LC3Dqb67AZ52x3Z0jU0uB.jpg', 'tt4154756', '24773958', { douban: '8.1', imdb: '8.4', rottenTomatoes: '85%' }, '复仇者联盟与银河护卫队倾尽全力阻止灭霸集齐无限宝石。'),
  movieSpec('299534', '复仇者联盟4：终局之战', 'Avengers: Endgame', 2019, 181, ['冒险', '科幻', '动作'], '/jtDv3lCnST0fZRvdYFwR5CVwK2x.jpg', '/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg', 'tt4154796', '26100958', { douban: '8.5', imdb: '8.4', rottenTomatoes: '94%' }, '幸存的复仇者们通过量子领域展开时空劫持，为逆转结局发起背水一战。'),
];

export function buildFallbackTitleAndSeasons(
  spec: DemoTitleSpec,
  now: number
): { title: TitleDoc; seasons: SeasonDoc[] } {
  const titleId = `tmdb_${spec.mediaType}_${spec.sourceId}`;
  const title: TitleDoc = {
    id: titleId,
    source: 'tmdb',
    sourceId: spec.sourceId,
    mediaType: spec.mediaType,
    names: { original: spec.originalName, zh: spec.zhName, en: spec.enName },
    displayLang: null,
    year: spec.year,
    runtimeMin: spec.runtimeMin,
    genres: spec.genres,
    posterPath: tmdbImageUrl(spec.posterHash, 'w500'),
    backdropPath: tmdbImageUrl(spec.backdropHash, 'w1280'),
    overview: { zh: spec.overviewZh },
    showStatus: spec.showStatus,
    externalIds: { imdb: spec.imdbId, douban: spec.doubanId },
    ratings: { ...spec.ratings, fetchedAt: now },
    manualState: null,
    playthroughs: [{ id: 'p1', number: 1, startedAt: now - 30 * 86_400_000 }],
    activePlaythroughId: 'p1',
    resume: null,
    metaFetchedAt: now,
    addedAt: now - 30 * 86_400_000,
    updatedAt: now,
    lastActivityAt: now,
  };

  const seasons: SeasonDoc[] = (spec.seasons || []).map((s) => ({
    seasonNumber: s.seasonNumber,
    name: s.name,
    episodes: s.episodes.map(
      (ep): EpisodeMeta => ({
        number: ep.number,
        key: makeEpisodeKey(s.seasonNumber, ep.number),
        name: ep.name,
        airDate: ep.airDate,
        runtime: ep.runtime,
        stillPath: tmdbImageUrl(ep.stillHash || spec.backdropHash, 'w300'),
        overview: { zh: ep.overview || '' },
      })
    ),
  }));

  return { title, seasons };
}
