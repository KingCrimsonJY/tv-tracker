import assert from 'node:assert/strict';
import { test as registerTest } from 'vitest';
import {
  computeResumeRatio,
  computeSeasonState,
  computeTitleState,
  countCompletedPlaythroughs,
  formatSeconds,
  getTitleContinueProgressRatio,
  isEpisodic,
  parseTimeInput,
  pickBackdrop,
  pickPoster,
  resolveDisplayTitle,
  resolveOverviewText,
  setResumePoint,
  setSeasonWatched,
  startRewatch,
  toggleEpisodeWatched,
} from './progress.ts';
import { makeBaseTvTitle, makeSampleSeasons, TODAY } from './testFixtures.ts';
import type { ProgressDoc, SeasonDoc } from './types.ts';
import { en } from '../i18n/messages/en.ts';
import { zhCN } from '../i18n/messages/zh-CN.ts';

registerTest('1. Partial season -> status watching and season state partial', () => {
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
  assert.equal(state.watchedCount, 1);
  assert.equal(state.countableCount, 5);
  assert.equal(state.nextUp?.key, 's1e2');

  const s1State = computeSeasonState(seasons[1], progress, { todayStr: TODAY });
  assert.equal(s1State.state, 'partial');
  assert.equal(s1State.watchedCount, 1);
  assert.equal(s1State.airedCount, 3);
});

registerTest('2. Full season of an ongoing show -> caught_up', () => {
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
  assert.equal(state.hasNewEpisodes, false);
  assert.equal(state.nextUp, null);

  const s2State = computeSeasonState(seasons[2], progress, { todayStr: TODAY });
  assert.equal(s2State.state, 'complete');
  assert.equal(s2State.isCompleteSoFar, true);
});

registerTest('3. Ended show with all countable episodes watched -> completed', () => {
  const title = makeBaseTvTitle({ showStatus: 'Ended' });
  const seasons = [makeSampleSeasons()[1]];
  const emptyProgress: ProgressDoc = { playthroughId: 'p1', watched: {} };

  const res = setSeasonWatched(title, seasons, emptyProgress, 1, true, {
    todayStr: TODAY,
    now: 1760000000000,
  });

  const state = computeTitleState({ ...title, playthroughs: res.playthroughs }, seasons, res.progress, {
    todayStr: TODAY,
  });
  assert.equal(state.status, 'completed');
  assert.equal(res.playthroughs[0].completedAt, 1760000000000);

  const afterUncheck = toggleEpisodeWatched(
    { ...title, playthroughs: res.playthroughs },
    seasons,
    res.progress,
    's1e3',
    { todayStr: TODAY, now: 1760000050000 },
  );
  assert.equal(afterUncheck.playthroughs[0].completedAt, undefined);
});

registerTest('4. New episode aired after user was caught up -> watching + hasNewEpisodes', () => {
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

  const afterCheck = toggleEpisodeWatched(pausedTitle, seasons, initialProgress, 's1e1', {
    todayStr: TODAY,
    now: 2000,
  });
  assert.equal(afterCheck.manualState, null);
  assert.equal(afterCheck.resume, null);

  const afterResume = setResumePoint(
    { manualState: 'paused', resume: null },
    { episodeKey: 's1e2', seconds: 600 },
    3000,
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
      name: null,
      episodes: [
        {
          number: 1,
          key: 's1e1',
          name: null,
          airDate: null,
          runtime: 45,
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
          name: null,
          airDate: '2024-01-01',
          runtime: 45,
          stillPath: null,
          overview: {},
        },
      ],
    },
  ];

  const s1State = computeSeasonState(
    seasons[0],
    { playthroughId: 'p1', watched: {} },
    {
      todayStr: '2026-11-01',
      allSeasons: seasons,
    },
  );
  assert.equal(s1State.airedCount, 1);
  assert.equal(s1State.state, 'none');
});

registerTest(
  '9. Movies: 2021 movie and movie released earlier this year show Mark as watched (unwatched); future movie shows unreleased',
  () => {
    const emptyProgress: ProgressDoc = { playthroughId: 'p1', watched: {} };

    const movie2021 = makeBaseTvTitle({
      id: 'tmdb_movie_438631',
      mediaType: 'movie',
      year: 2021,
      releaseDate: '2021-10-22',
      showStatus: 'Released',
    });
    assert.equal(isEpisodic(movie2021, []), false);
    const state2021 = computeTitleState(movie2021, [], emptyProgress, { todayStr: '2026-10-20' });
    assert.equal(state2021.isEpisodic, false);
    assert.equal(state2021.status, 'unwatched');
    assert.equal(en.detail.primaryAction.markMovieWatched, 'Mark as watched');
    assert.equal(zhCN.detail.primaryAction.markMovieWatched, '标记已看');

    const movieEarlierThisYear = makeBaseTvTitle({
      id: 'tmdb_movie_2026_early',
      mediaType: 'movie',
      year: 2026,
      releaseDate: '2026-03-15',
      showStatus: 'Released',
    });
    assert.equal(isEpisodic(movieEarlierThisYear, []), false);
    const stateEarlierThisYear = computeTitleState(movieEarlierThisYear, [], emptyProgress, {
      todayStr: '2026-10-20',
    });
    assert.equal(stateEarlierThisYear.isEpisodic, false);
    assert.equal(stateEarlierThisYear.status, 'unwatched');

    const futureMovie = makeBaseTvTitle({
      id: 'tmdb_movie_future',
      mediaType: 'movie',
      year: 2027,
      releaseDate: '2027-05-01',
      showStatus: 'In Production',
    });
    assert.equal(isEpisodic(futureMovie, []), false);
    const stateFuture = computeTitleState(futureMovie, [], emptyProgress, { todayStr: '2026-10-20' });
    assert.equal(stateFuture.isEpisodic, false);
    assert.equal(stateFuture.status, 'unreleased');
    assert.equal(en.status.unreleased, 'Not released yet');
    assert.equal(zhCN.status.unreleased, '未上映');
  },
);

registerTest(
  '10. pickPoster, pickBackdrop, and text/image fallbacks (including Chinese-only poster and no images)',
  () => {
    // 1) Full localized posters: active language -> textless -> other language -> default
    const fullPostersTitle = makeBaseTvTitle({
      posterPath: 'https://image.tmdb.org/t/p/w500/default.jpg',
      backdropPath: 'https://image.tmdb.org/t/p/w1280/textless_bd.jpg',
      posters: {
        zh: 'https://image.tmdb.org/t/p/w500/zh.jpg',
        en: 'https://image.tmdb.org/t/p/w500/en.jpg',
        textless: 'https://image.tmdb.org/t/p/w500/textless.jpg',
      },
    });
    assert.equal(pickPoster(fullPostersTitle, 'zh-CN'), 'https://image.tmdb.org/t/p/w500/zh.jpg');
    assert.equal(pickPoster(fullPostersTitle, 'en'), 'https://image.tmdb.org/t/p/w500/en.jpg');
    assert.equal(pickBackdrop(fullPostersTitle, 'zh-CN'), 'https://image.tmdb.org/t/p/w1280/textless_bd.jpg');

    // 2) Textless fallback before other language
    const textlessAndEn = makeBaseTvTitle({
      posterPath: 'https://image.tmdb.org/t/p/w500/default.jpg',
      posters: {
        zh: null,
        en: 'https://image.tmdb.org/t/p/w500/en.jpg',
        textless: 'https://image.tmdb.org/t/p/w500/textless.jpg',
      },
    });
    assert.equal(pickPoster(textlessAndEn, 'zh-CN'), 'https://image.tmdb.org/t/p/w500/textless.jpg');

    // 3) Title with ONLY a Chinese poster falls back to Chinese poster in English locale too
    const chinesePosterOnly = makeBaseTvTitle({
      posterPath: null,
      posters: {
        zh: 'https://image.tmdb.org/t/p/w500/zh_only.jpg',
        en: null,
        textless: null,
      },
    });
    assert.equal(pickPoster(chinesePosterOnly, 'zh-CN'), 'https://image.tmdb.org/t/p/w500/zh_only.jpg');
    assert.equal(pickPoster(chinesePosterOnly, 'en'), 'https://image.tmdb.org/t/p/w500/zh_only.jpg');

    // 4) Title with NO images returns null for both poster and backdrop
    const noImagesTitle = makeBaseTvTitle({
      posterPath: null,
      backdropPath: null,
      posters: {
        zh: null,
        en: null,
        textless: null,
      },
    });
    assert.equal(pickPoster(noImagesTitle, 'zh-CN'), null);
    assert.equal(pickPoster(noImagesTitle, 'en'), null);
    assert.equal(pickBackdrop(noImagesTitle, 'zh-CN'), null);
    assert.equal(pickBackdrop(noImagesTitle, 'en'), null);

    // 5) Text fallback: active language -> other language -> original
    const zhOnlyNames = { original: 'Original Title', zh: '中文名', en: undefined };
    assert.equal(resolveDisplayTitle(zhOnlyNames, null, 'auto', 'zh-CN').primary, '中文名');
    assert.equal(resolveDisplayTitle(zhOnlyNames, null, 'auto', 'en').primary, '中文名');

    const originalOnlyNames = { original: 'Le Samouraï' };
    assert.equal(resolveDisplayTitle(originalOnlyNames, null, 'auto', 'zh-CN').primary, 'Le Samouraï');
    assert.equal(resolveDisplayTitle(originalOnlyNames, null, 'auto', 'en').primary, 'Le Samouraï');

    // 6) Overview fallback: active language -> other language -> empty
    const zhOnlyOverview = makeBaseTvTitle({
      source: 'custom',
      overview: { zh: '仅有中文简介' },
    });
    assert.equal(resolveOverviewText(zhOnlyOverview, 'auto', 'zh-CN'), '仅有中文简介');
    assert.equal(resolveOverviewText(zhOnlyOverview, 'auto', 'en'), '仅有中文简介');

    const noOverviewTitle = makeBaseTvTitle({
      overview: {},
    });
    assert.equal(resolveOverviewText(noOverviewTitle, 'auto', 'zh-CN'), '');
    assert.equal(resolveOverviewText(noOverviewTitle, 'auto', 'en'), '');
    assert.equal(zhCN.detail.overview.empty, '暂无简介');
    assert.equal(en.detail.overview.empty, 'No overview yet');
  },
);

registerTest(
  '11. Rewatch start: movie and series at start of rewatch set isRewatching=true and count only completedAt != null',
  () => {
    // 1) Movie after 1 finished watch + startRewatch (2nd playthrough has completedAt: undefined)
    const completedMovie = makeBaseTvTitle({
      id: 'tmdb_movie_rewatch',
      mediaType: 'movie',
      year: 2021,
      releaseDate: '2021-10-22',
      showStatus: 'Released',
      playthroughs: [{ id: 'p1', number: 1, startedAt: 1000, completedAt: 2000 }],
      activePlaythroughId: 'p1',
    });
    const movieRewatch = startRewatch(
      completedMovie,
      [],
      { playthroughId: 'p1', watched: {}, movieWatchedAt: 2000 },
      { todayStr: TODAY, now: 3000, newPlaythroughId: 'p2' },
    );
    assert.equal(movieRewatch.playthroughs.length, 2);
    assert.equal(movieRewatch.playthroughs[1].completedAt, undefined);

    // countCompletedPlaythroughs must use != null so undefined completedAt is not counted
    assert.equal(countCompletedPlaythroughs(movieRewatch.playthroughs), 1);

    const movieState = computeTitleState(
      {
        ...completedMovie,
        playthroughs: movieRewatch.playthroughs,
        activePlaythroughId: movieRewatch.activePlaythroughId,
        resume: movieRewatch.resume,
      },
      [],
      movieRewatch.progress,
      { todayStr: TODAY },
    );
    assert.equal(movieState.status, 'unwatched');
    assert.equal(movieState.isRewatching, true);
    assert.equal(movieState.activePlaythroughNumber, 2);
    assert.equal(movieState.completedPlaythroughCount, 1);

    // 2) Series at the start of a rewatch (0 episodes watched in playthrough 2)
    const completedSeries = makeBaseTvTitle({
      id: 'tmdb_tv_rewatch',
      mediaType: 'tv',
      showStatus: 'Ended',
      playthroughs: [{ id: 'p1', number: 1, startedAt: 1000, completedAt: 2000 }],
      activePlaythroughId: 'p1',
    });
    const seasons = [makeSampleSeasons()[1]];
    const seriesRewatch = startRewatch(
      completedSeries,
      seasons,
      { playthroughId: 'p1', watched: { s1e1: 1200, s1e2: 1500, s1e3: 2000 } },
      { todayStr: TODAY, now: 3000, newPlaythroughId: 'p2' },
    );
    assert.equal(countCompletedPlaythroughs(seriesRewatch.playthroughs), 1);

    const seriesState = computeTitleState(
      {
        ...completedSeries,
        playthroughs: seriesRewatch.playthroughs,
        activePlaythroughId: seriesRewatch.activePlaythroughId,
        resume: seriesRewatch.resume,
      },
      seasons,
      seriesRewatch.progress,
      { todayStr: TODAY },
    );
    assert.equal(seriesState.status, 'unwatched');
    assert.equal(seriesState.isRewatching, true);
    assert.equal(seriesState.activePlaythroughNumber, 2);
    assert.equal(seriesState.completedPlaythroughCount, 1);
  },
);
