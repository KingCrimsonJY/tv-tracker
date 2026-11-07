import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '../../src/domain/schemas.ts';
import type { ListEntryDoc, ProgressDoc, SeasonDoc, TitleDoc, WatchListDoc } from '../../src/domain/types.ts';
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
    posterPath: '/poster.jpg',
    backdropPath: '/backdrop.jpg',
    overview: {
      zh: '卢蒙工业的员工接受了记忆切割手术。',
      en: 'Mark leads a team of office workers whose memories have been surgically divided.',
    },
    showStatus: 'Returning Series',
    externalIds: { imdb: 'tt11280740' },
    ratings: { tmdb: '8.4', tmdbVotes: 1520, imdb: '8.7', fetchedAt: now },
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
      name: null,
      episodes: [
        {
          number: 1,
          key: 's1e1',
          name: { zh: '好消息关于地狱' },
          airDate: '2022-02-18',
          runtime: 57,
          stillPath: null,
          overview: { zh: '第一集简介' },
        },
        {
          number: 2,
          key: 's1e2',
          name: { zh: '半环路' },
          airDate: '2022-02-18',
          runtime: 47,
          stillPath: null,
          overview: { zh: '第二集简介' },
        },
        {
          number: 3,
          key: 's1e3',
          name: { zh: '永恒之中' },
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

    // Also verify legacy douban keys in externalIds and ratings are ignored and stripped on import
    const legacyWithDouban = {
      ...v1Payload,
      titles: {
        [title.id]: {
          ...title,
          externalIds: { imdb: 'tt0137523', douban: '1292000' },
          ratings: { imdb: '8.8', douban: '9.0', fetchedAt: 1700000000000 },
        },
      },
    };
    repo.importData(legacyWithDouban);
    const stateAfter = repo.getState();
    expect(stateAfter.titles[title.id].externalIds).toEqual({ imdb: 'tt0137523' });
    expect(stateAfter.titles[title.id].ratings).toEqual({
      imdb: '8.8',
      fetchedAt: 1700000000000,
    });
  });

  it('sorts collection entries by TMDB rating, falling back to IMDb rating', async () => {
    const { sortListEntries } = await import('../../src/domain/ordering.ts');
    const t1 = makeSampleTitle('tmdb_movie_1', 'A');
    t1.ratings = { tmdb: '7.5', imdb: '9.0' }; // Uses TMDB 7.5
    const t2 = makeSampleTitle('tmdb_movie_2', 'B');
    t2.ratings = { imdb: '8.2' }; // No TMDB -> falls back to IMDb 8.2
    const t3 = makeSampleTitle('tmdb_movie_3', 'C');
    t3.ratings = { tmdb: '8.9', imdb: '7.0' }; // Uses TMDB 8.9

    const hydrated = [
      { entry: { id: 'e1', titleId: t1.id, rank: 'a0', addedAt: 1 }, title: t1 },
      { entry: { id: 'e2', titleId: t2.id, rank: 'a1', addedAt: 2 }, title: t2 },
      { entry: { id: 'e3', titleId: t3.id, rank: 'a2', addedAt: 3 }, title: t3 },
    ];
    const sorted = sortListEntries(hydrated, 'collection', 'rating', 'zh');
    expect(sorted.map((h) => h.title.id)).toEqual([t3.id, t2.id, t1.id]);
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

  it('preserves pre-import safety backup when a later daily backup runs on the same day and across 14+ daily backups', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhenji-pre-import-test-'));
    try {
      const fileRepo = new TrackerRepository({ dataDir: tmpDir });
      const originalTitle = makeSampleTitle('tmdb_tv_100', '导入前的原始剧集');
      fileRepo.putTitle(originalTitle.id, { title: originalTitle, seasons: [] });

      const emptyExport = {
        format: 'zhenji-export' as const,
        version: 2 as const,
        exportedAt: '2026-03-01T10:20:30.000Z',
        settings: DEFAULT_APP_SETTINGS,
        titles: {},
        seasonsByTitle: {},
        progressByTitle: {},
        lists: {},
        entriesByList: {},
      };

      // Import triggers pre-import backup: tracker-2026-03-01-102030-pre-import.db
      fileRepo.importData(emptyExport, {
        now: new Date('2026-03-01T10:20:30.000Z'),
      });

      // Run daily backup on the same day AND 15 subsequent days
      for (let day = 1; day <= 16; day++) {
        const dateStr = `2026-03-${String(day).padStart(2, '0')}`;
        fileRepo.runDailyMaintenance(dateStr);
      }

      const backupDir = path.join(tmpDir, 'backups');
      const allBackupFiles = fs.readdirSync(backupDir).sort();
      expect(allBackupFiles).toContain('tracker-2026-03-01-102030-pre-import.db');

      // Open the pre-import backup DB and verify the original title is still intact inside it
      const restoredRepo = new TrackerRepository({
        dbPath: path.join(backupDir, 'tracker-2026-03-01-102030-pre-import.db'),
      });
      expect(restoredRepo.getState().titles['tmdb_tv_100']?.names.zh).toBe('导入前的原始剧集');
      restoredRepo.close();
      fileRepo.close();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('throws DataDirPermissionError with chown 1000:1000 fix message when DATA_DIR is not writable', async () => {
    const { assertDataDirWritable, DataDirPermissionError } = await import('./repository.ts');

    expect(() =>
      assertDataDirWritable('/data', {
        mkdirSync: () => undefined,
        accessSync: () => {
          throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
        },
        writeFileSync: () => undefined,
        unlinkSync: () => undefined,
      }),
    ).toThrow(DataDirPermissionError);

    try {
      assertDataDirWritable('/data', {
        mkdirSync: () => undefined,
        accessSync: () => {
          throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
        },
        writeFileSync: () => undefined,
        unlinkSync: () => undefined,
      });
    } catch (err) {
      expect(err).toBeInstanceOf(DataDirPermissionError);
      expect((err as Error).message).toContain('mkdir -p data && sudo chown 1000:1000 data');
    }
  });

  it('set-password CLI rejects command-line arguments, enforces 10-char minimum, verifies confirmation match, and masks input', async () => {
    const { PassThrough } = await import('node:stream');
    const { verifyPassword } = await import('../auth.ts');
    const { runSetPasswordCli, SetPasswordCliError } = await import('../scripts/set-password.ts');

    // 1. Rejects command-line password argument
    await expect(runSetPasswordCli({ argv: ['my-secret-password'] })).rejects.toThrow(SetPasswordCliError);

    // 2. Rejects passwords shorter than 10 characters
    const shortIn = new PassThrough();
    const shortOut = new PassThrough();
    shortIn.end('short123\nshort123\n');
    await expect(runSetPasswordCli({ argv: [], input: shortIn, output: shortOut })).rejects.toThrow(
      /at least 10 characters/,
    );

    // 3. Rejects mismatched confirmation
    const mismatchIn = new PassThrough();
    const mismatchOut = new PassThrough();
    mismatchIn.end('valid-password-10\ndifferent-password-10\n');
    await expect(runSetPasswordCli({ argv: [], input: mismatchIn, output: mismatchOut })).rejects.toThrow(
      /do not match/,
    );

    // 4. Accepts matching >= 10 char password and never echoes the typed characters to output
    const validIn = new PassThrough();
    let capturedOutput = '';
    const validOut = new PassThrough();
    validOut.on('data', (chunk) => {
      capturedOutput += String(chunk);
    });
    const secret = 'correct-horse-battery-staple';
    validIn.end(`${secret}\n${secret}\n`);

    const hash = await runSetPasswordCli({ argv: [], input: validIn, output: validOut });
    expect(verifyPassword(secret, hash)).toBe(true);
    expect(capturedOutput).toContain('Enter new password');
    expect(capturedOutput).toContain('Confirm new password');
    expect(capturedOutput).not.toContain(secret);
  });
});
