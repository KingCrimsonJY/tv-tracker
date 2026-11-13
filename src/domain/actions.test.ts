import assert from 'node:assert/strict';
import { test as registerTest } from 'vitest';
import {
  computeTitleState,
  deletePlaythrough,
  markUpToEpisode,
  markWholeTitleWatched,
  setSeasonWatched,
  startRewatch,
  toggleEpisodeWatched,
  undoLatestPlaythrough,
} from './progress.ts';
import { makeBaseTvTitle, makeSampleSeasons, TODAY } from './testFixtures.ts';
import type { ProgressDoc, SeasonDoc, TitleDoc } from './types.ts';

registerTest(
  '1. Mark up to here across seasons checks previous countable episodes and never unchecks later ones',
  () => {
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
  },
);

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
    playthroughs: [{ id: 'p1', number: 1, startedAt: 1000, completedAt: 5000 }],
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
    { todayStr: TODAY },
  );
  assert.equal(rewatchingState.isRewatching, true);
  assert.equal(rewatchingState.playthroughNumber, 2);
  assert.equal(rewatchingState.completedPlaythroughCount, 1);

  const cancelled = undoLatestPlaythrough(
    {
      ...title,
      playthroughs: started.playthroughs,
      activePlaythroughId: started.activePlaythroughId,
    },
    { p1: p1Progress, p2: started.progress },
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
    { todayStr: TODAY },
  );
  assert.equal(watchedState.status, 'completed');
});

registerTest(
  '5. Missing air dates: episode with no airDate is treated as aired if show is Ended/Canceled or any later episode has aired',
  () => {
    const seasonsWithMissingAirDates: SeasonDoc[] = [
      {
        seasonNumber: 1,
        name: null,
        episodes: [
          {
            number: 1,
            key: 's1e1',
            name: { zh: '缺少日期但后续已播' },
            airDate: null,
            runtime: 45,
            stillPath: null,
            overview: {},
          },
          {
            number: 2,
            key: 's1e2',
            name: { zh: '已播出剧集' },
            airDate: '2026-10-01',
            runtime: 45,
            stillPath: null,
            overview: {},
          },
          {
            number: 3,
            key: 's1e3',
            name: { zh: '缺少日期且后续无已播' },
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
      { todayStr: TODAY },
    );
    assert.equal(ongoingState.countableCount, 2);
    assert.equal(ongoingState.nextUp?.key, 's1e1');

    const afterCheckS1E1 = toggleEpisodeWatched(
      ongoingTitle,
      seasonsWithMissingAirDates,
      { playthroughId: 'p1', watched: {} },
      's1e1',
      { todayStr: TODAY, now: 1000 },
    );
    assert.equal(afterCheckS1E1.progress.watched.s1e1, 1000);

    const afterCheckS1E3Ongoing = toggleEpisodeWatched(
      ongoingTitle,
      seasonsWithMissingAirDates,
      afterCheckS1E1.progress,
      's1e3',
      { todayStr: TODAY, now: 2000 },
    );
    assert.equal(afterCheckS1E3Ongoing.progress.watched.s1e3, undefined);

    const endedTitle = makeBaseTvTitle({ showStatus: 'Ended' });
    const endedState = computeTitleState(
      endedTitle,
      seasonsWithMissingAirDates,
      { playthroughId: 'p1', watched: {} },
      { todayStr: TODAY },
    );
    assert.equal(endedState.countableCount, 3);

    const afterCheckS1E3Ended = toggleEpisodeWatched(
      endedTitle,
      seasonsWithMissingAirDates,
      { playthroughId: 'p1', watched: {} },
      's1e3',
      { todayStr: TODAY, now: 3000 },
    );
    assert.equal(afterCheckS1E3Ended.progress.watched.s1e3, 3000);
  },
);

registerTest(
  '6. Rewatch of an ongoing show: reaching caught_up sets completedAt and stops showing isRewatching',
  () => {
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
      { todayStr: TODAY },
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
      { todayStr: TODAY, now: 20000 },
    );
    assert.equal(step2.playthroughs[1].completedAt, 20000);

    const caughtUpRewatchState = computeTitleState(
      { ...midRewatchTitle, playthroughs: step2.playthroughs },
      seasons,
      step2.progress,
      { todayStr: TODAY },
    );
    assert.equal(caughtUpRewatchState.status, 'caught_up');
    assert.equal(caughtUpRewatchState.isRewatching, false);
  },
);

registerTest('7. Undo 3rd -> 2nd -> 1st -> unwatched step by step', () => {
  const seasons = [makeSampleSeasons()[1]];
  const p1Progress: ProgressDoc = {
    playthroughId: 'p1',
    watched: { s1e1: 1100, s1e2: 1200, s1e3: 1300 },
  };
  const p2Progress: ProgressDoc = {
    playthroughId: 'p2',
    watched: { s1e1: 2100, s1e2: 2200, s1e3: 2300 },
  };
  const p3Progress: ProgressDoc = {
    playthroughId: 'p3',
    watched: { s1e1: 3100 },
  };

  const title3rd = makeBaseTvTitle({
    showStatus: 'Ended',
    playthroughs: [
      { id: 'p1', number: 1, startedAt: 1000, completedAt: 1500 },
      { id: 'p2', number: 2, startedAt: 2000, completedAt: 2500 },
      { id: 'p3', number: 3, startedAt: 3000 },
    ],
    activePlaythroughId: 'p3',
    resume: { episodeKey: 's1e2', seconds: 600, updatedAt: 3200 },
  });

  const undo3to2 = undoLatestPlaythrough(title3rd, {
    p1: p1Progress,
    p2: p2Progress,
    p3: p3Progress,
  });
  assert.equal(undo3to2.removedPlaythroughId, 'p3');
  assert.equal(undo3to2.clearedPlaythroughId, undefined);
  assert.equal(undo3to2.activePlaythroughId, 'p2');
  assert.equal(undo3to2.playthroughs.length, 2);
  assert.equal(undo3to2.playthroughs[1].id, 'p2');
  assert.equal(undo3to2.playthroughs[1].number, 2);
  assert.equal(undo3to2.playthroughs[1].completedAt, 2500);
  assert.equal(undo3to2.resume, null);
  assert.deepEqual(undo3to2.progress.watched, p2Progress.watched);

  const stateAfter2nd = computeTitleState(
    {
      ...title3rd,
      playthroughs: undo3to2.playthroughs,
      activePlaythroughId: undo3to2.activePlaythroughId,
      resume: undo3to2.resume,
    },
    seasons,
    undo3to2.progress,
    { todayStr: TODAY },
  );
  assert.equal(stateAfter2nd.status, 'completed');
  assert.equal(stateAfter2nd.playthroughNumber, 2);

  const undo2to1 = undoLatestPlaythrough(
    {
      ...title3rd,
      playthroughs: undo3to2.playthroughs,
      activePlaythroughId: undo3to2.activePlaythroughId,
      resume: undo3to2.resume,
    },
    { p1: p1Progress, p2: p2Progress },
  );
  assert.equal(undo2to1.removedPlaythroughId, 'p2');
  assert.equal(undo2to1.clearedPlaythroughId, undefined);
  assert.equal(undo2to1.activePlaythroughId, 'p1');
  assert.equal(undo2to1.playthroughs.length, 1);
  assert.equal(undo2to1.playthroughs[0].id, 'p1');
  assert.equal(undo2to1.playthroughs[0].number, 1);
  assert.equal(undo2to1.playthroughs[0].completedAt, 1500);
  assert.deepEqual(undo2to1.progress.watched, p1Progress.watched);

  const stateAfter1st = computeTitleState(
    {
      ...title3rd,
      playthroughs: undo2to1.playthroughs,
      activePlaythroughId: undo2to1.activePlaythroughId,
      resume: undo2to1.resume,
    },
    seasons,
    undo2to1.progress,
    { todayStr: TODAY },
  );
  assert.equal(stateAfter1st.status, 'completed');
  assert.equal(stateAfter1st.playthroughNumber, 1);

  const undo1toUnwatched = undoLatestPlaythrough(
    {
      ...title3rd,
      playthroughs: undo2to1.playthroughs,
      activePlaythroughId: undo2to1.activePlaythroughId,
      resume: { episodeKey: 's1e1', seconds: 120, updatedAt: 4000 },
    },
    { p1: p1Progress },
  );
  assert.equal(undo1toUnwatched.removedPlaythroughId, undefined);
  assert.equal(undo1toUnwatched.clearedPlaythroughId, 'p1');
  assert.equal(undo1toUnwatched.activePlaythroughId, 'p1');
  assert.equal(undo1toUnwatched.playthroughs.length, 1);
  assert.equal(undo1toUnwatched.playthroughs[0].id, 'p1');
  assert.equal(undo1toUnwatched.playthroughs[0].number, 1);
  assert.equal(undo1toUnwatched.playthroughs[0].completedAt, undefined);
  assert.equal(undo1toUnwatched.resume, null);
  assert.equal(undo1toUnwatched.manualState, null);
  assert.deepEqual(undo1toUnwatched.progress.watched, {});

  const stateUnwatched = computeTitleState(
    {
      ...title3rd,
      manualState: undo1toUnwatched.manualState,
      playthroughs: undo1toUnwatched.playthroughs,
      activePlaythroughId: undo1toUnwatched.activePlaythroughId,
      resume: undo1toUnwatched.resume,
    },
    seasons,
    undo1toUnwatched.progress,
    { todayStr: TODAY },
  );
  assert.equal(stateUnwatched.status, 'unwatched');
  assert.equal(stateUnwatched.watchedCount, 0);
  assert.equal(stateUnwatched.completedPlaythroughCount, 0);
});

registerTest('9. Deleting a middle playthrough renumbers remaining ones by start date', () => {
  const p1Progress: ProgressDoc = {
    playthroughId: 'p1',
    watched: { s1e1: 1100, s1e2: 1200, s1e3: 1300 },
  };
  const p2Progress: ProgressDoc = {
    playthroughId: 'p2',
    watched: { s1e1: 2100, s1e2: 2200, s1e3: 2300 },
  };
  const p3Progress: ProgressDoc = {
    playthroughId: 'p3',
    watched: { s1e1: 3100 },
  };

  const title3rd = makeBaseTvTitle({
    showStatus: 'Ended',
    playthroughs: [
      { id: 'p1', number: 1, startedAt: 1000, completedAt: 1500 },
      { id: 'p2', number: 2, startedAt: 2000, completedAt: 2500 },
      { id: 'p3', number: 3, startedAt: 3000 },
    ],
    activePlaythroughId: 'p3',
    resume: { episodeKey: 's1e2', seconds: 420, updatedAt: 3200 },
  });

  const deletedMiddle = deletePlaythrough(title3rd, 'p2', {
    p1: p1Progress,
    p2: p2Progress,
    p3: p3Progress,
  });

  assert.equal(deletedMiddle.removedPlaythroughId, 'p2');
  assert.equal(deletedMiddle.activePlaythroughId, 'p3');
  assert.equal(deletedMiddle.playthroughs.length, 2);
  assert.deepEqual(
    deletedMiddle.playthroughs.map((p) => ({ id: p.id, number: p.number })),
    [
      { id: 'p1', number: 1 },
      { id: 'p3', number: 2 },
    ],
  );
  assert.deepEqual(deletedMiddle.progress.watched, p3Progress.watched);
  assert.deepEqual(deletedMiddle.resume, title3rd.resume);
});

registerTest(
  '10. Undo when the latest playthrough is completed removes it and restores the previous playthrough',
  () => {
    const seasons = [makeSampleSeasons()[1]];
    const p1Progress: ProgressDoc = {
      playthroughId: 'p1',
      watched: { s1e1: 1100, s1e2: 1200, s1e3: 1300 },
    };
    const p2Progress: ProgressDoc = {
      playthroughId: 'p2',
      watched: { s1e1: 2100, s1e2: 2200, s1e3: 2300 },
    };

    const completed2ndTitle = makeBaseTvTitle({
      showStatus: 'Ended',
      playthroughs: [
        { id: 'p1', number: 1, startedAt: 1000, completedAt: 1500 },
        { id: 'p2', number: 2, startedAt: 2000, completedAt: 2500 },
      ],
      activePlaythroughId: 'p2',
    });

    const undone = undoLatestPlaythrough(completed2ndTitle, {
      p1: p1Progress,
      p2: p2Progress,
    });

    assert.equal(undone.removedPlaythroughId, 'p2');
    assert.equal(undone.activePlaythroughId, 'p1');
    assert.equal(undone.playthroughs.length, 1);
    assert.equal(undone.playthroughs[0].id, 'p1');
    assert.equal(undone.playthroughs[0].number, 1);
    assert.equal(undone.playthroughs[0].completedAt, 1500);
    assert.deepEqual(undone.progress.watched, p1Progress.watched);

    const state = computeTitleState(
      {
        ...completed2ndTitle,
        playthroughs: undone.playthroughs,
        activePlaythroughId: undone.activePlaythroughId,
      },
      seasons,
      undone.progress,
      { todayStr: TODAY },
    );
    assert.equal(state.status, 'completed');
    assert.equal(state.playthroughNumber, 1);
    assert.equal(state.completedPlaythroughCount, 1);
  },
);
