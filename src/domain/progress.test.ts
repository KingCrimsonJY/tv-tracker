import assert from 'node:assert/strict';
import { test as registerTest } from 'vitest';
import {
  computeResumeRatio,
  computeSeasonState,
  computeTitleState,
  formatSeconds,
  getTitleContinueProgressRatio,
  parseTimeInput,
  setResumePoint,
  setSeasonWatched,
  toggleEpisodeWatched,
} from './progress.ts';
import { makeBaseTvTitle, makeSampleSeasons, TODAY } from './testFixtures.ts';
import type { ProgressDoc, SeasonDoc } from './types.ts';

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
  assert.equal(state.countableCount, 5);
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

  const s2State = computeSeasonState(seasons[2], progress, { todayStr: TODAY });
  assert.equal(s2State.state, 'complete');
  assert.equal(s2State.isCompleteSoFar, true);
});

registerTest('3. Ended show with all countable episodes watched -> 已看完 (completed)', () => {
  const title = makeBaseTvTitle({ showStatus: 'Ended' });
  const seasons = [makeSampleSeasons()[1]];
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

  const caughtUpTs = new Date(2026, 9, 12, 20, 0, 0).getTime();
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
  const seasons = [makeSampleSeasons()[0], makeSampleSeasons()[1]];
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

registerTest('6. Paused or dropped manualState is cleared by checking an episode or setting resume time', () => {
  const pausedTitle = makeBaseTvTitle({
    manualState: 'paused',
    resume: { episodeKey: 's1e1', seconds: 1250, updatedAt: 1000 },
  });
  const seasons = makeSampleSeasons();
  const initialProgress: ProgressDoc = { playthroughId: 'p1', watched: {} };

  const initialState = computeTitleState(pausedTitle, seasons, initialProgress, {
    todayStr: TODAY,
  });
  assert.equal(initialState.status, 'paused');
  assert.equal(initialState.label, '暂停');

  const afterCheck = toggleEpisodeWatched(pausedTitle, seasons, initialProgress, 's1e1', {
    todayStr: TODAY,
    now: 2000,
  });
  assert.equal(afterCheck.manualState, null);
  assert.equal(afterCheck.resume, null);

  const afterResume = setResumePoint(
    { manualState: 'paused', resume: null },
    { episodeKey: 's1e2', seconds: 600 },
    3000
  );
  assert.equal(afterResume.manualState, null);
  assert.equal(afterResume.resume?.episodeKey, 's1e2');
  assert.equal(afterResume.resume?.seconds, 600);

  const parsed1 = parseTimeInput('42:15', 50);
  assert.equal(parsed1.ok, true);
  if (parsed1.ok) {
    assert.equal(parsed1.seconds, 2535);
    assert.equal(formatSeconds(parsed1.seconds), '42:15');
  }
  const parsedOverRuntime = parseTimeInput('1:10:00', 50);
  assert.equal(parsedOverRuntime.ok, false);
});

registerTest('7. Progress ratio for movies and resumed episodes uses resume seconds / (runtime * 60)', () => {
  const movie = makeBaseTvTitle({
    id: 'tmdb_movie_2',
    mediaType: 'movie',
    runtimeMin: 120,
    resume: { episodeKey: null, seconds: 1800, updatedAt: 1000 },
  });
  const state = computeTitleState(movie, [], { playthroughId: 'p1', watched: {} }, { todayStr: TODAY });
  assert.equal(state.status, 'watching');
  assert.equal(state.progressRatio, 0.25);

  const tvWithResume = makeBaseTvTitle({
    runtimeMin: 50,
    resume: { episodeKey: 's1e2', seconds: 1410, updatedAt: 1000 },
  });
  const seasons = makeSampleSeasons();
  const epContinueRatio = getTitleContinueProgressRatio(tvWithResume, seasons, 0.2);
  assert.equal(epContinueRatio, 0.5);
  assert.equal(computeResumeRatio(900, 60), 0.25);
});

registerTest('8. computeSeasonState with allSeasons accounts for later aired episodes across seasons', () => {
  const seasons: SeasonDoc[] = [
    {
      seasonNumber: 1,
      name: '第 1 季',
      episodes: [
        {
          number: 1,
          key: 's1e1',
          name: '第 1 集',
          airDate: null,
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
  assert.equal(s1State.airedCount, 1);
  assert.equal(s1State.state, 'none');
});
