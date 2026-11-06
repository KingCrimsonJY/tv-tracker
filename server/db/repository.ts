import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { extractGenreIdsFromNames } from '../../src/domain/genres.ts';
import {
  normalizeLocalizedEpisodeName,
  normalizeLocalizedSeasonName,
  splitUploaderPrefixFromOverview,
} from '../../src/domain/progress.ts';
import type {
  AppSettingsDoc,
  AppStateSnapshot,
  LinkImportEpisodeSeed,
  ListEntryDoc,
  PlaylistRefreshResult,
  ProgressDoc,
  SeasonDoc,
  StateMutationResult,
  TitleAtomicActionInput,
  TitleDoc,
  WatchListDoc,
  ZhenjiExportV2,
} from '../../src/domain/types.ts';
import {
  backupDatabase,
  createSafetyBackup,
  todayDateStr,
  writeDailyExport,
} from './backup.ts';
import { exportData, getState, importData } from './importExportRepo.ts';
import {
  deleteList,
  deleteListEntry,
  patchList,
  patchListEntry,
  putList,
  putListEntry,
} from './listsRepo.ts';
import { deleteProgress, patchProgress, putProgress } from './progressRepo.ts';
import {
  createSession,
  deleteAllSessions,
  deleteSession,
  getSettings,
  getStoredPasswordHash,
  patchSettings,
  setStoredPasswordHash,
  verifyAndTouchSession,
} from './settingsAuthRepo.ts';
import {
  appendPlaylistEpisodes,
  applyTitleAtomicAction,
  deleteTitle,
  getTitle,
  patchTitle,
  putTitle,
  replaceSeasons,
} from './titlesRepo.ts';
import { ConflictError, type DbContext, NotFoundError, type RepositoryOptions } from './types.ts';

export { ConflictError, NotFoundError, type RepositoryOptions };

export class DataDirPermissionError extends Error {
  public readonly dataDir: string;

  constructor(dataDir: string, cause?: unknown) {
    const uid = typeof process.getuid === 'function' ? process.getuid() : 'unknown';
    const message = [
      `Error: DATA_DIR "${dataDir}" is not writable by the current process (uid=${uid}).`,
      `If ./data did not exist before the first "docker compose up", Docker created it owned by root.`,
      `Fix it on the host before starting the container:`,
      `  mkdir -p data && sudo chown 1000:1000 data`,
    ].join('\n');
    super(message, { cause });
    this.name = 'DataDirPermissionError';
    this.dataDir = dataDir;
  }
}

export function assertDataDirWritable(
  dataDir: string,
  fsImpl: Pick<typeof fs, 'mkdirSync' | 'accessSync' | 'writeFileSync' | 'unlinkSync'> = fs
): void {
  const resolved = path.resolve(dataDir);
  try {
    fsImpl.mkdirSync(resolved, { recursive: true });
    fsImpl.accessSync(resolved, fs.constants.R_OK | fs.constants.W_OK);
    const probeFile = path.join(resolved, `.write-test-${process.pid}-${Date.now()}`);
    fsImpl.writeFileSync(probeFile, '');
    fsImpl.unlinkSync(probeFile);
    fsImpl.mkdirSync(path.join(resolved, 'backups'), { recursive: true });
    fsImpl.mkdirSync(path.join(resolved, 'exports'), { recursive: true });
  } catch (err) {
    throw new DataDirPermissionError(resolved, err);
  }
}

export class TrackerRepository {
  private readonly db: DatabaseSync;
  private readonly isMemory: boolean;
  private readonly dataDir: string | null;
  private readonly migrationsDir: string;
  private readonly ctx: DbContext;

  constructor(options: RepositoryOptions = {}) {
    const resolvedDataDir =
      options.dbPath === ':memory:'
        ? null
        : path.resolve(options.dataDir || process.env.DATA_DIR || './data');
    this.dataDir = resolvedDataDir;

    const dbPath =
      options.dbPath || (resolvedDataDir ? path.join(resolvedDataDir, 'tracker.db') : ':memory:');
    this.isMemory = dbPath === ':memory:';
    this.migrationsDir =
      options.migrationsDir || path.resolve(import.meta.dirname, 'migrations');

    if (!this.isMemory && this.dataDir) {
      assertDataDirWritable(this.dataDir);
    }

    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    if (!this.isMemory) {
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA busy_timeout = 5000;');
    }

    this.ctx = {
      db: this.db,
      isMemory: this.isMemory,
      dataDir: this.dataDir,
      migrationsDir: this.migrationsDir,
      runInTransaction: <T>(fn: () => T) => this.runInTransaction(fn),
      bumpVersionInTx: () => this.bumpVersionInTx(),
      getVersion: () => this.getVersion(),
    };

    this.applyMigrations();
  }

  public close(): void {
    this.db.close();
  }

  private getUserVersion(): number {
    const row = this.db.prepare('PRAGMA user_version;').get() as
      | { user_version?: number }
      | undefined;
    return Number(row?.user_version ?? 0);
  }

  private applyMigrations(): void {
    if (!fs.existsSync(this.migrationsDir)) return;

    const currentVersion = this.getUserVersion();
    const files = fs
      .readdirSync(this.migrationsDir)
      .filter((f) => /^\d+_.*\.sql$/.test(f))
      .sort();

    const pending = files
      .map((filename) => {
        const match = filename.match(/^(\d+)_/);
        const version = match ? Number.parseInt(match[1], 10) : 0;
        return { filename, version };
      })
      .filter((m) => m.version > currentVersion);

    if (pending.length === 0) return;

    if (!this.isMemory && this.dataDir && currentVersion > 0) {
      this.createSafetyBackup('pre-migration');
    }

    for (const migration of pending) {
      const sqlPath = path.join(this.migrationsDir, migration.filename);
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
      this.runInTransaction(() => {
        this.db.exec(sqlContent);
        if (migration.version === 2) {
          this.runMigration002InTx();
        }
        if (migration.version === 3) {
          this.runMigration003InTx();
        }
        this.db.exec(`PRAGMA user_version = ${migration.version};`);
      });
    }
  }

  private runMigration002InTx(): void {
    const seasonRows = this.db
      .prepare('SELECT title_id, season_number, data FROM seasons')
      .all() as Array<{ title_id: string; season_number: number; data: string }>;
    const updateSeason = this.db.prepare(
      'UPDATE seasons SET data = ? WHERE title_id = ? AND season_number = ?'
    );

    for (const row of seasonRows) {
      try {
        const parsed = JSON.parse(row.data) as SeasonDoc & {
          name?: unknown;
          episodes?: Array<{ name?: unknown }>;
        };
        const normalizedSeason: SeasonDoc = {
          ...parsed,
          name: normalizeLocalizedSeasonName(parsed.name as string | null | undefined),
          episodes: Array.isArray(parsed.episodes)
            ? parsed.episodes.map((ep) => ({
                ...ep,
                name: normalizeLocalizedEpisodeName(ep.name as string | null | undefined),
              }))
            : [],
        };
        updateSeason.run(JSON.stringify(normalizedSeason), row.title_id, row.season_number);
      } catch {
        // Ignore malformed legacy row
      }
    }

    const titleRows = this.db.prepare('SELECT id, data FROM titles').all() as Array<{
      id: string;
      data: string;
    }>;
    const updateTitle = this.db.prepare('UPDATE titles SET data = ? WHERE id = ?');

    for (const row of titleRows) {
      try {
        const parsed = JSON.parse(row.data) as Omit<TitleDoc, 'id'>;
        let changed = false;

        if ((parsed.source === 'url' || parsed.source === 'custom') && parsed.overview?.zh) {
          const split = splitUploaderPrefixFromOverview(parsed.overview.zh);
          if (split.uploader) {
            parsed.uploader = parsed.uploader || split.uploader;
            parsed.overview = {
              ...parsed.overview,
              zh: split.overview,
            };
            changed = true;
          }
        }

        if (
          (!parsed.genreIds || parsed.genreIds.length === 0) &&
          Array.isArray(parsed.genres) &&
          parsed.genres.length > 0
        ) {
          const ids = extractGenreIdsFromNames(parsed.genres);
          if (ids.length > 0) {
            parsed.genreIds = ids;
            changed = true;
          }
        }

        if (changed) {
          updateTitle.run(JSON.stringify(parsed), row.id);
        }
      } catch {
        // Ignore malformed legacy row
      }
    }
  }

  private runMigration003InTx(): void {
    const seasonRows = this.db
      .prepare('SELECT title_id, season_number, data FROM seasons WHERE season_number = 1')
      .all() as Array<{ title_id: string; season_number: number; data: string }>;
    const firstAirByTitle = new Map<string, string>();
    for (const sRow of seasonRows) {
      try {
        const parsedSeason = JSON.parse(sRow.data) as SeasonDoc;
        const firstEpAirDate = parsedSeason.episodes?.[0]?.airDate;
        if (firstEpAirDate && firstEpAirDate.trim() !== '') {
          firstAirByTitle.set(sRow.title_id, firstEpAirDate.trim());
        } else if (parsedSeason.airDate && parsedSeason.airDate.trim() !== '') {
          firstAirByTitle.set(sRow.title_id, parsedSeason.airDate.trim());
        }
      } catch {
        // Ignore malformed season row
      }
    }

    const titleRows = this.db.prepare('SELECT id, data FROM titles').all() as Array<{
      id: string;
      data: string;
    }>;
    const updateTitle = this.db.prepare('UPDATE titles SET data = ? WHERE id = ?');

    for (const row of titleRows) {
      try {
        const parsed = JSON.parse(row.data) as Omit<TitleDoc, 'id'>;
        let changed = false;

        if (parsed.releaseDate === undefined) {
          const inferredAir = firstAirByTitle.get(row.id);
          if (inferredAir) {
            parsed.releaseDate = inferredAir;
          } else if (typeof parsed.year === 'number' && parsed.year > 1800) {
            parsed.releaseDate = `${parsed.year}-01-01`;
          } else {
            parsed.releaseDate = null;
          }
          changed = true;
        }

        if (!parsed.posters) {
          parsed.posters = {
            zh: parsed.posterPath ?? null,
            en: parsed.posterPath ?? null,
            textless: null,
          };
          changed = true;
        }

        if (changed) {
          updateTitle.run(JSON.stringify(parsed), row.id);
        }
      } catch {
        // Ignore malformed legacy row
      }
    }
  }

  private runInTransaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const result = fn();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  private bumpVersionInTx(): number {
    const current = this.getVersion();
    const next = current + 1;
    this.db
      .prepare(
        "INSERT INTO meta (key, value) VALUES ('version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run(String(next));
    return next;
  }

  public getVersion(): number {
    const row = this.db.prepare("SELECT value FROM meta WHERE key = 'version'").get() as
      | { value?: string }
      | undefined;
    return row?.value ? Number.parseInt(row.value, 10) || 0 : 0;
  }

  public createSafetyBackup(
    kind: 'pre-migration' | 'pre-import',
    now = new Date()
  ): string | null {
    return createSafetyBackup(this.ctx, kind, now);
  }

  public backupDatabase(dateStr = todayDateStr()): string | null {
    return backupDatabase(this.ctx, dateStr);
  }

  public writeDailyExport(dateStr = todayDateStr()): string | null {
    return writeDailyExport(this.ctx, () => this.exportData(), dateStr);
  }

  public runDailyMaintenance(dateStr = todayDateStr()): void {
    this.backupDatabase(dateStr);
    this.writeDailyExport(dateStr);
  }

  public getSettings(): AppSettingsDoc {
    return getSettings(this.ctx);
  }

  public getState(): AppStateSnapshot {
    return getState(this.ctx);
  }

  public getTitle(id: string): TitleDoc | null {
    return getTitle(this.ctx, id);
  }

  public putTitle(
    id: string,
    input: {
      title: TitleDoc;
      seasons?: SeasonDoc[];
      progress?: Record<string, ProgressDoc>;
    }
  ): StateMutationResult {
    return putTitle(this.ctx, id, input);
  }

  public patchTitle(id: string, patch: Partial<Omit<TitleDoc, 'id'>>): StateMutationResult {
    return patchTitle(this.ctx, id, patch);
  }

  public deleteTitle(id: string): StateMutationResult {
    return deleteTitle(this.ctx, id);
  }

  public replaceSeasons(titleId: string, seasons: SeasonDoc[]): StateMutationResult {
    return replaceSeasons(this.ctx, titleId, seasons);
  }

  public appendPlaylistEpisodes(
    titleId: string,
    incomingEpisodes: LinkImportEpisodeSeed[],
    now = Date.now()
  ): PlaylistRefreshResult {
    return appendPlaylistEpisodes(this.ctx, titleId, incomingEpisodes, now);
  }

  public applyTitleAtomicAction(
    titleId: string,
    input: TitleAtomicActionInput
  ): StateMutationResult {
    return applyTitleAtomicAction(this.ctx, titleId, input);
  }

  public putProgress(
    titleId: string,
    playthroughId: string,
    input: { watched: Record<string, number>; movieWatchedAt?: number }
  ): StateMutationResult {
    return putProgress(this.ctx, titleId, playthroughId, input);
  }

  public patchProgress(
    titleId: string,
    playthroughId: string,
    patch: {
      set?: Record<string, number>;
      unset?: string[];
      movieWatchedAt?: number | null;
    }
  ): StateMutationResult {
    return patchProgress(this.ctx, titleId, playthroughId, patch);
  }

  public deleteProgress(titleId: string, playthroughId: string): StateMutationResult {
    return deleteProgress(this.ctx, titleId, playthroughId);
  }

  public putList(id: string, listInput: Omit<WatchListDoc, 'id'>): StateMutationResult {
    return putList(this.ctx, id, listInput);
  }

  public patchList(id: string, patch: Partial<Omit<WatchListDoc, 'id'>>): StateMutationResult {
    return patchList(this.ctx, id, patch);
  }

  public deleteList(id: string): StateMutationResult {
    return deleteList(this.ctx, id);
  }

  public putListEntry(
    listId: string,
    entryId: string,
    entryInput: Omit<ListEntryDoc, 'id'>
  ): StateMutationResult {
    return putListEntry(this.ctx, listId, entryId, entryInput);
  }

  public patchListEntry(
    listId: string,
    entryId: string,
    patch: Partial<Omit<ListEntryDoc, 'id'>>
  ): StateMutationResult {
    return patchListEntry(this.ctx, listId, entryId, patch);
  }

  public deleteListEntry(listId: string, entryId: string): StateMutationResult {
    return deleteListEntry(this.ctx, listId, entryId);
  }

  public patchSettings(patch: Partial<AppSettingsDoc>): StateMutationResult {
    return patchSettings(this.ctx, patch);
  }

  public exportData(exportedAt = new Date().toISOString()): ZhenjiExportV2 {
    return exportData(this.ctx, exportedAt);
  }

  public importData(
    rawInput: unknown,
    options: { skipBackup?: boolean; now?: Date } = {}
  ): StateMutationResult {
    return importData(this.ctx, rawInput, options);
  }

  public getStoredPasswordHash(): string | null {
    return getStoredPasswordHash(this.ctx);
  }

  public setStoredPasswordHash(passwordHash: string, now = Date.now()): void {
    setStoredPasswordHash(this.ctx, passwordHash, now);
  }

  public createSession(tokenHash: string, now: number, expiresAt: number): void {
    createSession(this.ctx, tokenHash, now, expiresAt);
  }

  public verifyAndTouchSession(tokenHash: string, now: number, newExpiresAt: number): boolean {
    return verifyAndTouchSession(this.ctx, tokenHash, now, newExpiresAt);
  }

  public deleteSession(tokenHash: string): void {
    deleteSession(this.ctx, tokenHash);
  }

  public deleteAllSessions(): void {
    deleteAllSessions(this.ctx);
  }
}
