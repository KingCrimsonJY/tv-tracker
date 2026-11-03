import assert from 'node:assert/strict';
import { test as registerTest } from 'vitest';
import { assertSafePublicUrl, isPrivateOrReservedIp } from '../../server/security/ssrf.ts';
import {
  cancelRewatch,
  computeTitleState,
  markUpToEpisode,
  markWholeTitleWatched,
  setSeasonWatched,
  startRewatch,
  toggleEpisodeWatched,
} from './progress.ts';
import { makeBaseTvTitle, makeSampleSeasons } from './progress.test.ts';
import type { ProgressDoc, SeasonDoc, TitleDoc } from './types.ts';

const TODAY = '2026-11-01';

registerTest('1. Mark up to here across seasons checks previous countable episodes and never unchecks later ones', () => {
  const title = makeBaseTvTitle();
  const seasons = makeSampleSeasons();
  const initialProgress: ProgressDoc = {
    playthroughId: 'p1',
    watched: {
      s2e2: 9999,
    },
  };

  const res = markUpToEpisode(title, seasons, initialProgress, 's2e1', {
    todayStr: TODAY,
    now: 5000,
  });

  assert.equal(Boolean(res.progress.watched.s1e1), true);
  assert.equal(Boolean(res.progress.watched.s1e2), true);
  assert.equal(Boolean(res.progress.watched.s1e3), true);
  assert.equal(Boolean(res.progress.watched.s2e1), true);
  assert.equal(res.progress.watched.s2e2, 9999);
  assert.equal(res.progress.watched.s0e1, undefined);
});

registerTest('2. Unaired episode cannot be checked', () => {
  const title = makeBaseTvTitle();
  const seasons = makeSampleSeasons();
  const initialProgress: ProgressDoc = {
    playthroughId: 'p1',
    watched: {},
  };

  const res = toggleEpisodeWatched(title, seasons, initialProgress, 's2e3', {
    todayStr: TODAY,
    now: 12345,
  });
  assert.equal(res.progress.watched.s2e3, undefined);
});

registerTest('3. Rewatch start and cancel restores previous playthrough', () => {
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

registerTest('4. Whole title mark watched works for both movies and TV shows', () => {
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

registerTest('5. Missing air dates: episode with no airDate is treated as aired if show is Ended/Canceled or any later episode has aired', () => {
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

  const ongoingTitle = makeBaseTvTitle({ showStatus: 'Returning Series' });
  const ongoingState = computeTitleState(
    ongoingTitle,
    seasonsWithMissingAirDates,
    { playthroughId: 'p1', watched: {} },
    { todayStr: TODAY }
  );
  assert.equal(ongoingState.countableCount, 2);
  assert.equal(ongoingState.nextUp?.key, 's1e1');

  const afterCheckS1E1 = toggleEpisodeWatched(
    ongoingTitle,
    seasonsWithMissingAirDates,
    { playthroughId: 'p1', watched: {} },
    's1e1',
    { todayStr: TODAY, now: 1000 }
  );
  assert.equal(afterCheckS1E1.progress.watched.s1e1, 1000);

  const afterCheckS1E3Ongoing = toggleEpisodeWatched(
    ongoingTitle,
    seasonsWithMissingAirDates,
    afterCheckS1E1.progress,
    's1e3',
    { todayStr: TODAY, now: 2000 }
  );
  assert.equal(afterCheckS1E3Ongoing.progress.watched.s1e3, undefined);

  const endedTitle = makeBaseTvTitle({ showStatus: 'Ended' });
  const endedState = computeTitleState(
    endedTitle,
    seasonsWithMissingAirDates,
    { playthroughId: 'p1', watched: {} },
    { todayStr: TODAY }
  );
  assert.equal(endedState.countableCount, 3);

  const afterCheckS1E3Ended = toggleEpisodeWatched(
    endedTitle,
    seasonsWithMissingAirDates,
    { playthroughId: 'p1', watched: {} },
    's1e3',
    { todayStr: TODAY, now: 3000 }
  );
  assert.equal(afterCheckS1E3Ended.progress.watched.s1e3, 3000);
});

registerTest('6. Rewatch of an ongoing show: reaching 已追平 sets completedAt and stops showing 二刷中', () => {
  const ongoingTitle = makeBaseTvTitle({
    showStatus: 'Returning Series',
    playthroughs: [{ id: 'p1', number: 1, startedAt: 1000 }],
    activePlaythroughId: 'p1',
  });
  const seasons = makeSampleSeasons();
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

  const rewatchStarted = startRewatch(ongoingTitle, seasons, caughtUpProgressP1, {
    todayStr: TODAY,
    now: 10000,
    newPlaythroughId: 'p2',
  });
  assert.equal(rewatchStarted.activePlaythroughId, 'p2');
  assert.equal(rewatchStarted.playthroughs.length, 2);

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

registerTest('7. SSRF protection rejects private, loopback, link-local IPs and non-http protocols', async () => {
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
