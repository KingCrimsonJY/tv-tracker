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
  '关于地狱的好消息',
  '半环路',
  '永恒之中',
  '你就是你',
  '光学与设计部的残酷野蛮',
  '捉迷藏',
  '挑衅性爵士乐',
  '晚饭吃什么？',
  '我们就是我们',
];
const SEV_S2_NAMES = [
  '你好，科贝尔女士',
  '再见，塞尔维格太太',
  '谁还活着？',
  '哀伤之谷',
  '特洛伊木马',
  '阿提拉',
  '奇卡海牙',
  '甜蜜的硫酸盐',
  '下班后',
  '冷港',
];
const SEV_S2_STILLS = [
  '/a97vNY8Knu45FLQib0uQZ2VReLy.jpg',
  '/wjlSkqMoLngSO6fv2Ajt2CIeCSi.jpg',
  '/j4AUAq1XJOBmfXsLphZzsCz6pZs.jpg',
  '/mioOOhTaShLd1MPKsmfirbe9AwI.jpg',
  '/7Gw2DWAbhsBREKFbM2S0h5sD0tL.jpg',
  '/l9CC3onLMDBDKxs6Ie0yIWI8VmC.jpg',
  '/dmzBzYcEtjOYJO46p7kyRmYrHZu.jpg',
  '/piWjCKARsSkmr9kMKHZ5ynengj3.jpg',
  '/2RJaWjY4dD5s7jpdo2aGeSLmtI3.jpg',
  '/gXUvGwpZxrpqMRouxM7yI28lgNa.jpg',
];

const FRIEREN_S1_NAMES = [
  '冒险的结束',
  '并不需要是魔法',
  '杀人魔法',
  '灵魂长眠之地',
  '死者的幻影',
  '村子的英雄',
  '宛如童话般的事物',
  '葬送的芙莉莲',
  '断头台阿乌拉',
  '强大的魔法使',
  '北侧诸国的冬日',
  '真正的勇者',
  '同族厌恶',
  '年轻人的特权',
  '难缠事物的气味',
  '长寿的朋友',
  '那么，保重了',
  '一级魔法使选拔测验',
  '精心策划的陷阱',
  '必要的杀戮',
  '魔法的世界',
  '次起是仇敌',
  '攻略迷宫',
  '完美的复制体',
  '致命的破绽',
  '魔法的高度',
  '人类的时代',
  '再会之时定会难为情',
];

const BB_S5_NAMES = [
  '自由不死',
  '牧歌',
  '危险津贴',
  '五十一',
  '死亡货运',
  '买断',
  '说出我的名字',
  '凌驾一切',
  '血钱',
  '深埋',
  '忏悔',
  '疯狗',
  '托哈吉莉',
  '奥兹曼迪亚斯',
  '花岗岩州',
  '费利娜',
];

function movieSpec(
  sourceId: string,
  zhName: string,
  originalName: string,
  enName: string,
  year: number,
  runtimeMin: number,
  genres: string[],
  posterHash: string,
  backdropHash: string,
  imdbId: string,
  ratings: Omit<Ratings, 'fetchedAt'>,
  overviewZh: string
): DemoTitleSpec {
  return {
    mediaType: 'movie',
    sourceId,
    zhName,
    originalName,
    enName,
    year,
    runtimeMin,
    genres,
    posterHash,
    backdropHash,
    showStatus: 'Released',
    imdbId,
    ratings,
    overviewZh,
  };
}

export const DEMO_TMDB_SPECS: DemoTitleSpec[] = [
  // 1. Breaking Bad: ended, fully watched (已看完)
  {
    mediaType: 'tv',
    sourceId: '1396',
    zhName: '绝命毒师',
    originalName: 'Breaking Bad',
    enName: 'Breaking Bad',
    year: 2008,
    runtimeMin: 47,
    genres: ['剧情', '犯罪'],
    posterHash: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    backdropHash: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
    showStatus: 'Ended',
    imdbId: 'tt0903747',
    ratings: { tmdb: '8.9', imdb: '9.5', rottenTomatoes: '96%', metacritic: '87' },
    overviewZh:
      '新墨西哥州的高中化学老师沃尔特·怀特被诊断出患有晚期肺癌，为了给家人留下足够的生活保障，他与曾经的学生杰西·平克曼联手制售高纯度冰毒，一步步滑向犯罪深渊。',
    seasons: [
      { seasonNumber: 1, name: '第 1 季', episodes: genEpisodes(7, '2008-01-20', 48) },
      { seasonNumber: 2, name: '第 2 季', episodes: genEpisodes(13, '2009-03-08', 47) },
      { seasonNumber: 3, name: '第 3 季', episodes: genEpisodes(13, '2010-03-21', 47) },
      { seasonNumber: 4, name: '第 4 季', episodes: genEpisodes(13, '2011-07-17', 47) },
      { seasonNumber: 5, name: '第 5 季', episodes: genEpisodes(16, '2012-07-15', 49, BB_S5_NAMES) },
    ],
  },
  // 2. Severance: returning series, caught up to the latest aired episode (已追平)
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
    ratings: { tmdb: '8.4', imdb: '8.7', rottenTomatoes: '97%', metacritic: '84' },
    overviewZh:
      '马克领导着卢蒙工业的一支办公室团队，这里的员工都接受了“记忆切割”手术，工作记忆与个人生活记忆被彻底分离。当一位神秘同事出现在办公室外时，揭示工作真相的旅程就此展开。',
    seasons: [
      { seasonNumber: 1, name: '第 1 季', episodes: genEpisodes(9, '2022-02-18', 48, SEV_S1_NAMES) },
      {
        seasonNumber: 2,
        name: '第 2 季',
        episodes: genEpisodes(10, '2025-01-17', 52, SEV_S2_NAMES, SEV_S2_STILLS),
      },
    ],
  },
  // 3. The Bear: watching with 有新集 (real air dates, watched S1-S2 before S3 aired)
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
    ratings: { tmdb: '8.3', imdb: '8.5', rottenTomatoes: '96%', metacritic: '88' },
    overviewZh:
      '年轻的主厨卡米来自高级餐饮界，在哥哥去世后回到芝加哥接管家族的三明治小店。他在应对沉重债务、简陋厨房与脾气暴躁的厨师团队时，努力改造餐厅并治愈自我。',
    seasons: [
      { seasonNumber: 1, name: '第 1 季', episodes: genEpisodes(8, '2022-06-23', 30) },
      { seasonNumber: 2, name: '第 2 季', episodes: genEpisodes(10, '2023-06-22', 35) },
      { seasonNumber: 3, name: '第 3 季', episodes: genEpisodes(10, '2024-06-26', 34) },
    ],
  },
  // 4. Spirited Away: watched once, second watch in progress (二刷中)
  movieSpec(
    '129',
    '千与千寻',
    '千と千尋の神隠し',
    'Spirited Away',
    2001,
    125,
    ['动画', '家庭', '奇幻'],
    '/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg',
    '/Ab8mkHmkYADjU7wQiOkia9BzGvS.jpg',
    'tt0245429',
    { tmdb: '8.5', imdb: '8.6', rottenTomatoes: '96%', metacritic: '96' },
    '十岁少女千寻随父母搬家途中误入神灵异世界，父母因贪吃变成猪。为了拯救父母并重返人类世界，千寻在汤婆婆经营的油屋中取名“小千”开始工作，并在白龙的帮助下经历成长与蜕变。'
  ),
  // 5. Frieren: Beyond Journey's End: anime added through TMDB, watching (观看中)
  {
    mediaType: 'tv',
    sourceId: '209867',
    zhName: '葬送的芙莉莲',
    originalName: '葬送のフリーレン',
    enName: "Frieren: Beyond Journey's End",
    year: 2023,
    runtimeMin: 24,
    genres: ['动画', '冒险', '奇幻'],
    posterHash: '/dqZENchTd7lp5zht7BdlqM7RBhD.jpg',
    backdropHash: '/96RT2A47UdzWlUfvIERFyBsLhL2.jpg',
    showStatus: 'Returning Series',
    imdbId: 'tt22248376',
    ratings: { tmdb: '8.9', imdb: '8.9', rottenTomatoes: '100%' },
    overviewZh:
      '打倒魔王的勇者一行人凯旋归来，精灵魔法使芙莉莲与伙伴们迎来漫长的离别。在勇者辛美尔逝世后，悔恨未能真正了解人类的芙莉莲再度踏上旅途，追寻曾经共同走过的足迹。',
    seasons: [
      {
        seasonNumber: 1,
        name: '第 1 季',
        episodes: genEpisodes(28, '2023-09-29', 24, FRIEREN_S1_NAMES),
      },
    ],
  },
  // 6. Collection "想看": The Godfather, In the Mood for Love, Parasite, Interstellar
  movieSpec(
    '238',
    '教父',
    'The Godfather',
    'The Godfather',
    1972,
    175,
    ['剧情', '犯罪'],
    '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
    '/tmU7GeKVybMWFButWEGl2M4GeiP.jpg',
    'tt0068646',
    { tmdb: '8.7', imdb: '9.2', rottenTomatoes: '97%', metacritic: '100' },
    '纽约黑手党柯里昂家族的掌舵人维托·柯里昂在拒绝毒品交易后遭到暗杀重伤，原本不愿涉足家族生意的幼子迈克尔被迫卷入腥风血雨的帮派纷争，最终接过教父的权杖。'
  ),
  movieSpec(
    '843',
    '花样年华',
    '花樣年華',
    'In the Mood for Love',
    2000,
    98,
    ['剧情', '爱情'],
    '/iYypPT4bhqXfq1b6EnmxvRt6b2Y.jpg',
    '/8eRscFbRYl681zDfkjv1jjW1KAA.jpg',
    'tt0118694',
    { tmdb: '8.1', imdb: '8.1', rottenTomatoes: '92%', metacritic: '87' },
    '1962 年的香港，报馆编辑周慕云与货运公司秘书苏丽珍在同一天搬进同一栋公寓。两人在发觉各自的伴侣背叛自己后，在克制与试探中产生了一段微妙而隐秘的情感。'
  ),
  movieSpec(
    '496243',
    '寄生虫',
    '기생충',
    'Parasite',
    2019,
    133,
    ['喜剧', '惊悚', '剧情'],
    '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
    '/TU9NIjwzjoKPwQHoHshkFcQUCG.jpg',
    'tt6751668',
    { tmdb: '8.5', imdb: '8.5', rottenTomatoes: '99%', metacritic: '97' },
    '居住在半地下室的金基泽一家四口全部无业，长子基宇通过伪造文凭进入富有的朴社长家中担任家教，随后全家一步步用计谋进入豪宅工作，却意外揭开了豪宅地下深藏的秘密。'
  ),
  movieSpec(
    '157336',
    '星际穿越',
    'Interstellar',
    'Interstellar',
    2014,
    169,
    ['冒险', '剧情', '科幻'],
    '/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg',
    '/8sNiAPPYU14PUepFNeSNGUTiHW.jpg',
    'tt0816692',
    { tmdb: '8.4', imdb: '8.7', rottenTomatoes: '73%', metacritic: '74' },
    '前宇航员库珀与一队科学家穿越虫洞展开星际航行，为人类寻找延续生命的新家园。'
  ),
  // 7. Ordered list "漫威无限传奇观影顺序" (10 MCU films in story order)
  movieSpec(
    '1771',
    '美国队长',
    'Captain America: The First Avenger',
    'Captain America: The First Avenger',
    2011,
    124,
    ['动作', '冒险', '科幻'],
    '/vSNxAJTlD0r02V9sPYpOjqDZXUK.jpg',
    '/yFuKvT4Vm3sKHdFY4eG6I4ldAnn.jpg',
    'tt0458339',
    { tmdb: '7.0', imdb: '6.9', rottenTomatoes: '80%' },
    '二战期间，史蒂夫·罗杰斯参加超级士兵计划成为美国队长，率领咆哮突击队对抗九头蛇。'
  ),
  movieSpec(
    '1726',
    '钢铁侠',
    'Iron Man',
    'Iron Man',
    2008,
    126,
    ['动作', '科幻', '冒险'],
    '/78lPtwv72eTNqFW9COBYI0dWDJa.jpg',
    '/cKvDv2LpwVEqbdXWoQl4XgGN6le.jpg',
    'tt0371746',
    { tmdb: '7.6', imdb: '7.9', rottenTomatoes: '94%' },
    '托尼·斯塔克打造高科技动力装甲，化身钢铁侠守护世界。'
  ),
  movieSpec(
    '24428',
    '复仇者联盟',
    'The Avengers',
    'The Avengers',
    2012,
    143,
    ['科幻', '动作', '冒险'],
    '/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg',
    '/gHLs7Fy3DzLmLsD4lmfqL55KGcl.jpg',
    'tt0848228',
    { tmdb: '7.7', imdb: '8.0', rottenTomatoes: '91%' },
    '尼克·弗瑞召集地球最强英雄组建复仇者联盟迎战洛基与奇塔瑞大军。'
  ),
  movieSpec(
    '100402',
    '美国队长2：冬日战士',
    'Captain America: The Winter Soldier',
    'Captain America: The Winter Soldier',
    2014,
    136,
    ['动作', '冒险', '科幻'],
    '/tVFRpFw3xTedgPGqxW0AOI8Qhh0.jpg',
    '/jJvrPQAHFKmz4pVano4UtWTsRgA.jpg',
    'tt1843866',
    { tmdb: '7.7', imdb: '7.8', rottenTomatoes: '90%' },
    '美国队长与黑寡妇、猎鹰联手揭露神盾局内部深藏的阴谋。'
  ),
  movieSpec(
    '118340',
    '银河护卫队',
    'Guardians of the Galaxy',
    'Guardians of the Galaxy',
    2014,
    121,
    ['动作', '科幻', '冒险'],
    '/r7vmZjiyZw9rpJMQJdXpjgiCOk9.jpg',
    '/uLtVbjvS1O7gXL8lUOwsFOH4man.jpg',
    'tt2015381',
    { tmdb: '7.9', imdb: '8.0', rottenTomatoes: '92%' },
    '星爵与伙伴们组成银河护卫队，阻止罗南利用力量宝石毁灭山达尔星。'
  ),
  movieSpec(
    '99861',
    '复仇者联盟2：奥创纪元',
    'Avengers: Age of Ultron',
    'Avengers: Age of Ultron',
    2015,
    141,
    ['动作', '冒险', '科幻'],
    '/4ssDuvEDkSArWEdyBl2X5EHvYKU.jpg',
    '/kIBK5SKwgqIIuRKhhWrJn3XkbPq.jpg',
    'tt2395427',
    { tmdb: '7.3', imdb: '7.3', rottenTomatoes: '76%' },
    '失控的人工智能奥创企图毁灭人类，复仇者联盟再度集结迎战。'
  ),
  movieSpec(
    '271110',
    '美国队长3：内战',
    'Captain America: Civil War',
    'Captain America: Civil War',
    2016,
    147,
    ['冒险', '动作', '科幻'],
    '/rAGiXaUfPzY7CDEyNKUofk3Kw2e.jpg',
    '/7FWlcZq3r6525LWOcvO9kNWurN1.jpg',
    'tt3498820',
    { tmdb: '7.4', imdb: '7.8', rottenTomatoes: '90%' },
    '《索科维亚协议》引发复仇者联盟内部裂痕，两大阵营爆发正面对决。'
  ),
  movieSpec(
    '284054',
    '黑豹',
    'Black Panther',
    'Black Panther',
    2018,
    134,
    ['动作', '冒险', '科幻'],
    '/uxzzxijgPIY7slzFvMotPv8wjKA.jpg',
    '/b6ZJZHUdMEFECvGiDpJjlfUWela.jpg',
    'tt1825683',
    { tmdb: '7.4', imdb: '7.3', rottenTomatoes: '96%' },
    '特查拉回到非洲国家瓦坎达继承王位，同时面对强敌挑战。'
  ),
  movieSpec(
    '299536',
    '复仇者联盟3：无限战争',
    'Avengers: Infinity War',
    'Avengers: Infinity War',
    2018,
    149,
    ['冒险', '动作', '科幻'],
    '/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg',
    '/mDfJG3LC3Dqb67AZ52x3Z0jU0uB.jpg',
    'tt4154756',
    { tmdb: '8.2', imdb: '8.4', rottenTomatoes: '85%' },
    '复仇者联盟与银河护卫队倾尽全力阻止灭霸集齐六颗无限宝石。'
  ),
  movieSpec(
    '299534',
    '复仇者联盟4：终局之战',
    'Avengers: Endgame',
    'Avengers: Endgame',
    2019,
    181,
    ['冒险', '科幻', '动作'],
    '/jtDv3lCnST0fZRvdYFwR5CVwK2x.jpg',
    '/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg',
    'tt4154796',
    { tmdb: '8.3', imdb: '8.4', rottenTomatoes: '94%' },
    '幸存的复仇者们通过量子领域展开时空劫持，为逆转结局发起背水一战。'
  ),
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
    externalIds: { imdb: spec.imdbId },
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
