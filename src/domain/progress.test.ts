import assert from 'node:assert/strict';
import { test as registerTest } from 'vitest';
import {
  cancelRewatch,
  computeResumeRatio,
  computeSeasonState,
  computeTitleState,
  formatSeconds,
  getTitleContinueProgressRatio,
  markUpToEpisode,
  markWholeTitleWatched,
  parseTimeInput,
  setResumePoint,
  setSeasonWatched,
  startRewatch,
  toggleEpisodeWatched,
} from './progress.ts';
import type { ProgressDoc, SeasonDoc, TitleDoc } from './types.ts';
import { assertSafePublicUrl, isPrivateOrReservedIp } from '../../server/security/ssrf.ts';

const TODAY = '2026-11-01';

function makeBaseTvTitle(overrides: Partial<TitleDoc> = {}): TitleDoc {
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

function makeSampleSeasons(): SeasonDoc[] {
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

registerTest('1. Partial season -> status 观看中 and season state partial', () => {
  const title = makeBaseTvTitle();
  const seasons = makeSampleSeasons();
  const progress: ProgressDoc = {
    playthroughId: 'p1',
    watched: {
      s1e1: Date.parse('2026-10-20T12:00:00Z'),
    },
  };

  const state = computeTitleState(title, seasons, progress, { todayStr: TODAY });
  assert.equal(state.status, 'watching');
  assert.equal(state.label, '观看中');
  assert.equal(state.watchedCount, 1);
  assert.equal(state.countableCount, 5); // 3 in S1 + 2 aired in S2
  assert.equal(state.nextUp?.key, 's1e2');

  const s1State = computeSeasonState(seasons[1], progress, { todayStr: TODAY });
  assert.equal(s1State.state, 'partial');
  assert.equal(s1State.watchedCount, 1);
  assert.equal(s1State.airedCount, 3);
});

registerTest('2. Full season of an ongoing show -> 已追平 (caught_up)', () => {
  const title = makeBaseTvTitle({ showStatus: 'Returning Series' });
  const seasons = makeSampleSeasons();
  const progress: ProgressDoc = {
    playthroughId: 'p1',
    watched: {
      s1e1: 1000,
      s1e2: 2000,
      s1e3: 3000,
      s2e1: 4000,
      s2e2: 5000,
    },
  };

  const state = computeTitleState(title, seasons, progress, { todayStr: TODAY });
  assert.equal(state.status, 'caught_up');
  assert.equal(state.label, '已追平');
  assert.equal(state.hasNewEpisodes, false);
  assert.equal(state.nextUp, null);

  // Season 2 has 2 aired (both watched) and 1 unaired -> complete-so-far
  const s2State = computeSeasonState(seasons[2], progress, { todayStr: TODAY });
  assert.equal(s2State.state, 'complete');
  assert.equal(s2State.isCompleteSoFar, true);
});

registerTest('3. Ended show with all countable episodes watched -> 已看完 (completed)', () => {
  const title = makeBaseTvTitle({ showStatus: 'Ended' });
  const seasons = [makeSampleSeasons()[1]]; // Only S1 (3 aired episodes)
  const emptyProgress: ProgressDoc = { playthroughId: 'p1', watched: {} };

  const res = setSeasonWatched(title, seasons, emptyProgress, 1, true, {
    todayStr: TODAY,
    now: 1760000000000,
  });

  const state = computeTitleState(
    { ...title, playthroughs: res.playthroughs },
    seasons,
    res.progress,
    { todayStr: TODAY }
  );
  assert.equal(state.status, 'completed');
  assert.equal(state.label, '已看完');
  assert.equal(res.playthroughs[0].completedAt, 1760000000000);

  // Unchecking an episode clears completedAt
  const afterUncheck = toggleEpisodeWatched(
    { ...title, playthroughs: res.playthroughs },
    seasons,
    res.progress,
    's1e3',
    { todayStr: TODAY, now: 1760000050000 }
  );
  assert.equal(afterUncheck.playthroughs[0].completedAt, undefined);
});

registerTest('4. New episode aired after user was caught up -> 观看中 + 有新集', () => {
  const title = makeBaseTvTitle({ showStatus: 'Returning Series' });
  const seasons = makeSampleSeasons();

  // User caught up through s2e1 on 2026-10-12; then s2e2 aired on 2026-10-17
  const caughtUpTs = new Date(2026, 9, 12, 20, 0, 0).getTime(); // 2026-10-12 local
  const progress: ProgressDoc = {
    playthroughId: 'p1',
    watched: {
      s1e1: caughtUpTs - 30000,
      s1e2: caughtUpTs - 20000,
      s1e3: caughtUpTs - 10000,
      s2e1: caughtUpTs,
    },
  };

  const state = computeTitleState(title, seasons, progress, { todayStr: TODAY });
  assert.equal(state.status, 'watching');
  assert.equal(state.label, '观看中');
  assert.equal(state.hasNewEpisodes, true);
  assert.equal(state.nextUp?.key, 's2e2');
});

registerTest('5. Specials toggle: excluded by default, included when includeSpecials is true', () => {
  const title = makeBaseTvTitle({ showStatus: 'Ended' });
  const seasons = [makeSampleSeasons()[0], makeSampleSeasons()[1]]; // S0 (1 ep) + S1 (3 eps)
  const progress: ProgressDoc = {
    playthroughId: 'p1',
    watched: {
      s1e1: 1000,
      s1e2: 2000,
      s1e3: 3000,
    },
  };

  const withoutSpecials = computeTitleState(title, seasons, progress, {
    includeSpecials: false,
    todayStr: TODAY,
  });
  assert.equal(withoutSpecials.status, 'completed');
  assert.equal(withoutSpecials.countableCount, 3);

  const withSpecials = computeTitleState(title, seasons, progress, {
    includeSpecials: true,
    todayStr: TODAY,
  });
  assert.equal(withSpecials.status, 'watching');
  assert.equal(withSpecials.countableCount, 4);
  assert.equal(withSpecials.nextUp?.key, 's0e1');
});

registerTest('6. Mark up to here across seasons checks previous countable episodes and never unchecks later ones', () => {
  const title = makeBaseTvTitle();
  const seasons = makeSampleSeasons();
  const initialProgress: ProgressDoc = {
    playthroughId: 'p1',
    watched: {
      s2e2: 9999, // A later episode already watched
    },
  };

  const res = markUpToEpisode(title, seasons, initialProgress, 's2e1', {
    todayStr: TODAY,
    now: 5000,
  });

  // Should have checked s1e1, s1e2, s1e3, s2e1 and preserved s2e2
  assert.equal(Boolean(res.progress.watched.s1e1), true);
  assert.equal(Boolean(res.progress.watched.s1e2), true);
  assert.equal(Boolean(res.progress.watched.s1e3), true);
  assert.equal(Boolean(res.progress.watched.s2e1), true);
  assert.equal(res.progress.watched.s2e2, 9999);
  // s0e1 (specials) should not be checked when includeSpecials is false
  assert.equal(res.progress.watched.s0e1, undefined);
});

registerTest('7. Unaired episode cannot be checked', () => {
  const title = makeBaseTvTitle();
  const seasons = makeSampleSeasons();
  const initialProgress: ProgressDoc = {
    playthroughId: 'p1',
    watched: {},
  };

  // s2e3 airs on 2026-12-25, which is after TODAY (2026-11-01)
  const res = toggleEpisodeWatched(title, seasons, initialProgress, 's2e3', {
    todayStr: TODAY,
    now: 12345,
  });
  assert.equal(res.progress.watched.s2e3, undefined);
});

registerTest('8. Rewatch start and cancel restores previous playthrough', () => {
  const title = makeBaseTvTitle({
    showStatus: 'Ended',
    playthroughs: [
      { id: 'p1', number: 1, startedAt: 1000, completedAt: 5000 },
    ],
    activePlaythroughId: 'p1',
  });
  const seasons = [makeSampleSeasons()[1]];
  const p1Progress: ProgressDoc = {
    playthroughId: 'p1',
    watched: { s1e1: 2000, s1e2: 3000, s1e3: 4000 },
  };

  // Start rewatch
  const started = startRewatch(title, seasons, p1Progress, {
    todayStr: TODAY,
    now: 10000,
    newPlaythroughId: 'p2',
  });

  assert.equal(started.activePlaythroughId, 'p2');
  assert.equal(started.playthroughs.length, 2);
  assert.equal(started.playthroughs[1].number, 2);
  assert.deepEqual(started.progress.watched, {});

  const rewatchingState = computeTitleState(
    {
      ...title,
      playthroughs: started.playthroughs,
      activePlaythroughId: started.activePlaythroughId,
    },
    seasons,
    started.progress,
    { todayStr: TODAY }
  );
  assert.equal(rewatchingState.isRewatching, true);
  assert.equal(rewatchingState.playthroughNumber, 2);
  assert.equal(rewatchingState.completedPlaythroughCount, 1);

  // Cancel rewatch
  const cancelled = cancelRewatch(
    {
      ...title,
      playthroughs: started.playthroughs,
      activePlaythroughId: started.activePlaythroughId,
    },
    { p1: p1Progress, p2: started.progress }
  );

  assert.equal(cancelled.activePlaythroughId, 'p1');
  assert.equal(cancelled.playthroughs.length, 1);
  assert.deepEqual(cancelled.progress.watched, p1Progress.watched);
});

registerTest('9. Paused or dropped manualState is cleared by checking an episode or setting resume time, and resume is cleared when its episode is marked watched', () => {
  const pausedTitle = makeBaseTvTitle({
    manualState: 'paused',
    resume: { episodeKey: 's1e1', seconds: 1250, updatedAt: 1000 },
  });
  const seasons = makeSampleSeasons();
  const initialProgress: ProgressDoc = { playthroughId: 'p1', watched: {} };

  // Initially paused
  const initialState = computeTitleState(pausedTitle, seasons, initialProgress, {
    todayStr: TODAY,
  });
  assert.equal(initialState.status, 'paused');
  assert.equal(initialState.label, '暂停');

  // Checking s1e1 clears manualState AND clears resume on s1e1
  const afterCheck = toggleEpisodeWatched(pausedTitle, seasons, initialProgress, 's1e1', {
    todayStr: TODAY,
    now: 2000,
  });
  assert.equal(afterCheck.manualState, null);
  assert.equal(afterCheck.resume, null);

  // Setting a resume point on a paused title also clears manualState
  const afterResume = setResumePoint(
    { manualState: 'paused', resume: null },
    { episodeKey: 's1e2', seconds: 600 },
    3000
  );
  assert.equal(afterResume.manualState, null);
  assert.equal(afterResume.resume?.episodeKey, 's1e2');
  assert.equal(afterResume.resume?.seconds, 600);

  // Time parsing & formatting
  const parsed1 = parseTimeInput('42:15', 50);
  assert.equal(parsed1.ok, true);
  if (parsed1.ok) {
    assert.equal(parsed1.seconds, 2535);
    assert.equal(formatSeconds(parsed1.seconds), '42:15');
  }
  const parsedOverRuntime = parseTimeInput('1:10:00', 50);
  assert.equal(parsedOverRuntime.ok, false);
});

registerTest('10. Whole title mark watched works for both movies and TV shows', () => {
  const movieTitle = makeBaseTvTitle({
    id: 'tmdb_movie_1',
    mediaType: 'movie',
    runtimeMin: 148,
  });
  const emptyProgress: ProgressDoc = { playthroughId: 'p1', watched: {} };
  const unwatchedState = computeTitleState(movieTitle, [], emptyProgress, { todayStr: TODAY });
  assert.equal(unwatchedState.status, 'unwatched');

  const watchedRes = markWholeTitleWatched(movieTitle, [], emptyProgress, true, {
    todayStr: TODAY,
    now: 50000,
  });
  const watchedState = computeTitleState(
    { ...movieTitle, playthroughs: watchedRes.playthroughs },
    [],
    watchedRes.progress,
    { todayStr: TODAY }
  );
  assert.equal(watchedState.status, 'completed');
  assert.equal(watchedState.label, '已看完');
});

registerTest('11. Missing air dates: episode with no airDate is treated as aired if show is Ended/Canceled or any later episode has aired', () => {
  const seasonsWithMissingAirDates: SeasonDoc[] = [
    {
      seasonNumber: 1,
      name: '第 1 季',
      episodes: [
        {
          number: 1,
          key: 's1e1',
          name: '缺少日期但后续已播',
          airDate: null,
          runtime: 45,
          stillPath: null,
          overview: {},
        },
        {
          number: 2,
          key: 's1e2',
          name: '已播出剧集',
          airDate: '2026-10-01',
          runtime: 45,
          stillPath: null,
          overview: {},
        },
        {
          number: 3,
          key: 's1e3',
          name: '缺少日期且后续无已播',
          airDate: null,
          runtime: 45,
          stillPath: null,
          overview: {},
        },
      ],
    },
  ];

  // Case A: Ongoing show (Returning Series) -> s1e1 is treated as aired (since s1e2 aired), s1e3 is NOT aired
  const ongoingTitle = makeBaseTvTitle({ showStatus: 'Returning Series' });
  const ongoingState = computeTitleState(
    ongoingTitle,
    seasonsWithMissingAirDates,
    { playthroughId: 'p1', watched: {} },
    { todayStr: TODAY }
  );
  assert.equal(ongoingState.countableCount, 2); // s1e1 and s1e2
  assert.equal(ongoingState.nextUp?.key, 's1e1');

  // Checking s1e1 succeeds because a later episode (s1e2) has aired
  const afterCheckS1E1 = toggleEpisodeWatched(
    ongoingTitle,
    seasonsWithMissingAirDates,
    { playthroughId: 'p1', watched: {} },
    's1e1',
    { todayStr: TODAY, now: 1000 }
  );
  assert.equal(afterCheckS1E1.progress.watched.s1e1, 1000);

  // Checking s1e3 on ongoing show fails because no later episode has aired
  const afterCheckS1E3Ongoing = toggleEpisodeWatched(
    ongoingTitle,
    seasonsWithMissingAirDates,
    afterCheckS1E1.progress,
    's1e3',
    { todayStr: TODAY, now: 2000 }
  );
  assert.equal(afterCheckS1E3Ongoing.progress.watched.s1e3, undefined);

  // Case B: Ended or Canceled show -> all episodes with missing airDate (including s1e3) are treated as aired
  const endedTitle = makeBaseTvTitle({ showStatus: 'Ended' });
  const endedState = computeTitleState(
    endedTitle,
    seasonsWithMissingAirDates,
    { playthroughId: 'p1', watched: {} },
    { todayStr: TODAY }
  );
  assert.equal(endedState.countableCount, 3); // s1e1, s1e2, s1e3

  const afterCheckS1E3Ended = toggleEpisodeWatched(
    endedTitle,
    seasonsWithMissingAirDates,
    { playthroughId: 'p1', watched: {} },
    's1e3',
    { todayStr: TODAY, now: 3000 }
  );
  assert.equal(afterCheckS1E3Ended.progress.watched.s1e3, 3000);
});

registerTest('12. Rewatch of an ongoing show: reaching 已追平 sets completedAt and stops showing 二刷中', () => {
  const ongoingTitle = makeBaseTvTitle({
    showStatus: 'Returning Series',
    playthroughs: [{ id: 'p1', number: 1, startedAt: 1000 }],
    activePlaythroughId: 'p1',
  });
  const seasons = makeSampleSeasons(); // 5 countable episodes (s1e1..3, s2e1..2) plus s2e3 unaired
  const caughtUpProgressP1: ProgressDoc = {
    playthroughId: 'p1',
    watched: {
      s1e1: 1000,
      s1e2: 2000,
      s1e3: 3000,
      s2e1: 4000,
      s2e2: 5000,
    },
  };

  // Start rewatch from 已追平
  const rewatchStarted = startRewatch(ongoingTitle, seasons, caughtUpProgressP1, {
    todayStr: TODAY,
    now: 10000,
    newPlaythroughId: 'p2',
  });
  assert.equal(rewatchStarted.activePlaythroughId, 'p2');
  assert.equal(rewatchStarted.playthroughs.length, 2);

  // During rewatch (partially watched), isRewatching is true
  const midRewatchTitle: TitleDoc = {
    ...ongoingTitle,
    playthroughs: rewatchStarted.playthroughs,
    activePlaythroughId: rewatchStarted.activePlaythroughId,
  };
  const step1 = setSeasonWatched(midRewatchTitle, seasons, rewatchStarted.progress, 1, true, {
    todayStr: TODAY,
    now: 15000,
  });
  const midState = computeTitleState(
    { ...midRewatchTitle, playthroughs: step1.playthroughs },
    seasons,
    step1.progress,
    { todayStr: TODAY }
  );
  assert.equal(midState.status, 'watching');
  assert.equal(midState.isRewatching, true);
  assert.equal(step1.playthroughs[1].completedAt, undefined);

  // Finish all aired episodes of Season 2 -> reaches 已追平 on playthrough #2
  const step2 = setSeasonWatched(
    { ...midRewatchTitle, playthroughs: step1.playthroughs },
    seasons,
    step1.progress,
    2,
    true,
    { todayStr: TODAY, now: 20000 }
  );
  assert.equal(step2.playthroughs[1].completedAt, 20000);

  const caughtUpRewatchState = computeTitleState(
    { ...midRewatchTitle, playthroughs: step2.playthroughs },
    seasons,
    step2.progress,
    { todayStr: TODAY }
  );
  assert.equal(caughtUpRewatchState.status, 'caught_up');
  assert.equal(caughtUpRewatchState.label, '已追平');
  assert.equal(caughtUpRewatchState.isRewatching, false);
});

registerTest('13. Progress ratio for movies and resumed episodes uses resume seconds / (runtime * 60)', () => {
  const movie = makeBaseTvTitle({
    id: 'tmdb_movie_2',
    mediaType: 'movie',
    runtimeMin: 120, // 7200 seconds
    resume: { episodeKey: null, seconds: 1800, updatedAt: 1000 }, // 25%
  });
  const state = computeTitleState(movie, [], { playthroughId: 'p1', watched: {} }, { todayStr: TODAY });
  assert.equal(state.status, 'watching');
  assert.equal(state.progressRatio, 0.25);

  const tvWithResume = makeBaseTvTitle({
    runtimeMin: 50,
    resume: { episodeKey: 's1e2', seconds: 1410, updatedAt: 1000 }, // s1e2 runtime is 47m = 2820s -> 0.5
  });
  const seasons = makeSampleSeasons();
  const epContinueRatio = getTitleContinueProgressRatio(tvWithResume, seasons, 0.2);
  assert.equal(epContinueRatio, 0.5);
  assert.equal(computeResumeRatio(900, 60), 0.25);
});

registerTest('14. SSRF protection rejects private, loopback, link-local IPs and non-http protocols', async () => {
  assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('10.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('172.16.5.4'), true);
  assert.equal(isPrivateOrReservedIp('192.168.1.1'), true);
  assert.equal(isPrivateOrReservedIp('169.254.169.254'), true);
  assert.equal(isPrivateOrReservedIp('::1'), true);
  assert.equal(isPrivateOrReservedIp('fe80::1'), true);
  assert.equal(isPrivateOrReservedIp('fc00::1'), true);
  assert.equal(isPrivateOrReservedIp('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('93.184.216.34'), false);

  await assert.rejects(() => assertSafePublicUrl('file:///etc/passwd'));
  await assert.rejects(() => assertSafePublicUrl('http://127.0.0.1:8080/test'));
  await assert.rejects(() => assertSafePublicUrl('http://169.254.169.254/latest/meta-data/'));
  await assert.rejects(() =>
    assertSafePublicUrl('https://evil.example.com/video', async () => [{ address: '10.1.2.3' }])
  );
  const valid = await assertSafePublicUrl('https://www.bilibili.com/video/BV1xx411c7mD', async () => [
    { address: '93.184.216.34' },
  ]);
  assert.equal(valid.hostname, 'www.bilibili.com');
});

registerTest('15. computeSeasonState with allSeasons accounts for later aired episodes across seasons', () => {
  const seasons: SeasonDoc[] = [
    {
      seasonNumber: 1,
      name: '第 1 季',
      episodes: [
        {
          number: 1,
          key: 's1e1',
          name: '第 1 集',
          airDate: null, // no airDate, but Season 2 Episode 1 has aired
          runtime: 45,
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
          name: '第 1 集',
          airDate: '2024-01-01',
          runtime: 45,
          stillPath: null,
          overview: {},
        },
      ],
    },
  ];

  const s1State = computeSeasonState(seasons[0], { playthroughId: 'p1', watched: {} }, {
    todayStr: '2026-11-01',
    allSeasons: seasons,
  });
  // Since S2E1 has aired, S1E1 is treated as aired too
  assert.equal(s1State.airedCount, 1);
  assert.equal(s1State.state, 'none');
});

