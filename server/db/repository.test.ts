import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '../../src/domain/schemas.ts';
import type {
  ListEntryDoc,
  ProgressDoc,
  SeasonDoc,
  TitleDoc,
  WatchListDoc,
} from '../../src/domain/types.ts';
import { ConflictError, TrackerRepository } from './repository.ts';

function makeSampleTitle(id = 'tmdb_tv_100', name = '人生切割术'): TitleDoc {
  const now = 1710000000000;
  return {
    id,
    source: 'tmdb',
    sourceId: '100',
    mediaType: 'tv',
    names: {
      original: 'Severance',
      zh: name,
      en: 'Severance',
    },
    displayLang: null,
    year: 2022,
    runtimeMin: 50,
    genres: ['剧情', '科幻'],
    posterPath: 'https://image.tmdb.org/t/p/w500/poster.jpg',
    backdropPath: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg',
    overview: {
      zh: '卢蒙工业的员工接受了记忆切割手术。',
      en: 'Mark leads a team of office workers whose memories have been surgically divided.',
    },
    showStatus: 'Returning Series',
    externalIds: { imdb: 'tt11280740', douban: '35033654' },
    ratings: { imdb: '8.7', douban: '9.1', fetchedAt: now },
    manualState: null,
    playthroughs: [{ id: 'p1', number: 1, startedAt: now }],
    activePlaythroughId: 'p1',
    resume: null,
    metaFetchedAt: now,
    addedAt: now,
    updatedAt: now,
    lastActivityAt: now,
  };
}

function makeSampleSeasons(): SeasonDoc[] {
  return [
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
          overview: { zh: '第一集简介' },
        },
        {
          number: 2,
          key: 's1e2',
          name: '半环路',
          airDate: '2022-02-18',
          runtime: 47,
          stillPath: null,
          overview: { zh: '第二集简介' },
        },
        {
          number: 3,
          key: 's1e3',
          name: '永恒之中',
          airDate: '2022-02-25',
          runtime: 52,
          stillPath: null,
          overview: { zh: '第三集简介' },
        },
      ],
    },
  ];
}

describe('TrackerRepository (in-memory SQLite)', () => {
  let repo: TrackerRepository;

  beforeEach(() => {
    repo = new TrackerRepository({ dbPath: ':memory:' });
  });

  afterEach(() => {
    repo.close();
  });

  it('supports progress set and unset and increments version on each write', () => {
    const title = makeSampleTitle();
    const seasons = makeSampleSeasons();
    const initialProgress: ProgressDoc = {
      playthroughId: 'p1',
      watched: { s1e1: 1000 },
    };

    const m1 = repo.putTitle(title.id, {
      title,
      seasons,
      progress: { p1: initialProgress },
    });
    expect(m1.version).toBe(1);

    // Patch progress: set s1e2 & s1e3, unset s1e1
    const m2 = repo.patchProgress(title.id, 'p1', {
      set: { s1e2: 2000, s1e3: 3000 },
      unset: ['s1e1'],
    });
    expect(m2.version).toBe(2);
    expect(m2.upserts.progressByTitle?.[title.id]?.p1).toEqual({
      playthroughId: 'p1',
      watched: {
        s1e2: 2000,
        s1e3: 3000,
      },
    });

    const state = repo.getState();
    expect(state.version).toBe(2);
    expect(state.progressByTitle[title.id].p1.watched).toEqual({
      s1e2: 2000,
      s1e3: 3000,
    });
  });

  it('cascades title deletion to seasons, progress, and list_entries', () => {
    const title1 = makeSampleTitle('tmdb_tv_100', '人生切割术');
    const title2 = makeSampleTitle('tmdb_tv_200', '安多');
    const seasons = makeSampleSeasons();

    repo.putTitle(title1.id, {
      title: title1,
      seasons,
      progress: { p1: { playthroughId: 'p1', watched: { s1e1: 1234 } } },
    });
    repo.putTitle(title2.id, {
      title: title2,
      seasons,
      progress: { p1: { playthroughId: 'p1', watched: { s1e1: 5678 } } },
    });

    const list: Omit<WatchListDoc, 'id'> = {
      name: '年度科幻必看',
      kind: 'ordered',
      pinned: true,
      rank: 'a0',
      collectionSort: 'manual',
      createdAt: 1710000000000,
    };
    repo.putList('list_1', list);

    repo.putListEntry('list_1', 'entry_1', {
      titleId: title1.id,
      rank: 'a0',
      addedAt: 1710000000000,
    });
    repo.putListEntry('list_1', 'entry_2', {
      titleId: title2.id,
      rank: 'a1',
      addedAt: 1710000000001,
    });

    const delResult = repo.deleteTitle(title1.id);
    expect(delResult.deletes.titles).toEqual([title1.id]);
    expect(delResult.deletes.entries).toEqual([{ listId: 'list_1', entryId: 'entry_1' }]);

    const state = repo.getState();
    expect(state.titles[title1.id]).toBeUndefined();
    expect(state.seasonsByTitle[title1.id]).toBeUndefined();
    expect(state.progressByTitle[title1.id]).toBeUndefined();
    expect(state.entriesByList['list_1']).toHaveLength(1);
    expect(state.entriesByList['list_1'][0].titleId).toBe(title2.id);
  });

  it('exports and re-imports data (v2 round-trip) with identical resulting state', () => {
    const title = makeSampleTitle();
    const seasons = makeSampleSeasons();
    repo.putTitle(title.id, {
      title,
      seasons,
      progress: {
        p1: {
          playthroughId: 'p1',
          watched: { s1e1: 1111, s1e2: 2222 },
        },
      },
    });

    repo.putList('list_sci', {
      name: '科幻精选',
      kind: 'ordered',
      description: '硬核科幻剧集',
      pinned: true,
      rank: 'a0',
      collectionSort: 'manual',
      createdAt: 1710000000000,
    });

    const entry: Omit<ListEntryDoc, 'id'> = {
      titleId: title.id,
      rank: 'a0',
      note: '必看神作',
      addedAt: 1710000000010,
    };
    repo.putListEntry('list_sci', 'e_1', entry);
    repo.patchSettings({ includeSpecials: true, defaultTitleLang: 'original' });

    const beforeState = repo.getState();
    const exported = repo.exportData('2026-03-15T00:00:00.000Z');

    expect(exported.format).toBe('zhenji-export');
    expect(exported.version).toBe(2);

    // Import into a brand-new repository and verify identical data
    const repo2 = new TrackerRepository({ dbPath: ':memory:' });
    repo2.importData(exported);
    const afterState = repo2.getState();

    expect(afterState.settings).toEqual(beforeState.settings);
    expect(afterState.titles).toEqual(beforeState.titles);
    expect(afterState.seasonsByTitle).toEqual(beforeState.seasonsByTitle);
    expect(afterState.progressByTitle).toEqual(beforeState.progressByTitle);
    expect(afterState.lists).toEqual(beforeState.lists);
    expect(afterState.entriesByList).toEqual(beforeState.entriesByList);
    repo2.close();
  });

  it('accepts a version-1 export file (without format field) from the old build', () => {
    const title = makeSampleTitle('tmdb_movie_550', '搏击俱乐部');
    title.mediaType = 'movie';
    const v1Payload = {
      exportedAt: '2026-01-01T12:00:00.000Z',
      version: 1 as const,
      settings: {
        ...DEFAULT_APP_SETTINGS,
        theme: 'light' as const,
      },
      titles: {
        [title.id]: title,
      },
      seasonsByTitle: {},
      progressByTitle: {
        [title.id]: {
          p1: {
            playthroughId: 'p1',
            watched: {},
            movieWatchedAt: 1700000000000,
          },
        },
      },
      lists: {},
      entriesByList: {},
    };

    repo.importData(v1Payload);
    const state = repo.getState();
    expect(state.settings.theme).toBe('light');
    expect(state.titles[title.id].names.zh).toBe('搏击俱乐部');
    expect(state.progressByTitle[title.id].p1.movieWatchedAt).toBe(1700000000000);
  });

  it('enforces one-time password setup in repository', () => {
    expect(repo.getStoredPasswordHash()).toBeNull();
    repo.setStoredPasswordHash('scrypt:aa:bb', 1000);
    expect(repo.getStoredPasswordHash()).toBe('scrypt:aa:bb');

    expect(() => repo.setStoredPasswordHash('scrypt:cc:dd', 2000)).toThrow(ConflictError);
  });

  it('creates daily VACUUM INTO backups and JSON exports and prunes to newest 14', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhenji-repo-test-'));
    try {
      const fileRepo = new TrackerRepository({ dataDir: tmpDir });
      const title = makeSampleTitle();
      fileRepo.putTitle(title.id, { title, seasons: [] });

      for (let day = 1; day <= 16; day++) {
        const dateStr = `2026-03-${String(day).padStart(2, '0')}`;
        fileRepo.runDailyMaintenance(dateStr);
      }

      const backupFiles = fs
        .readdirSync(path.join(tmpDir, 'backups'))
        .filter((f) => f.endsWith('.db'))
        .sort();
      const exportFiles = fs
        .readdirSync(path.join(tmpDir, 'exports'))
        .filter((f) => f.endsWith('.json'))
        .sort();

      expect(backupFiles).toHaveLength(14);
      expect(backupFiles[0]).toBe('tracker-2026-03-03.db');
      expect(backupFiles[13]).toBe('tracker-2026-03-16.db');

      expect(exportFiles).toHaveLength(14);
      expect(exportFiles[0]).toBe('zhenji-2026-03-03.json');
      expect(exportFiles[13]).toBe('zhenji-2026-03-16.json');

      fileRepo.close();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
