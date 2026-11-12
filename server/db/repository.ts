import { normalizeTmdbImages } from '../../src/domain/images.ts';
import { fillEpisodeMetadataBatch, enrichmentDue, claimEnrichment } from './enrichmentRepo.ts';
import { LATEST_SCHEMA_VERSION, MIGRATIONS } from './migrations.ts';
import { appendPlaylistEpisodes } from './linkMetadataRepo.ts';
import { previewStructure, decideStructure, convertToManual } from './structureRepo.ts';
import { readSeasons, refreshMetadata } from './metadataRepo.ts';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  AppSettingsDoc,
  AppStateSnapshot,
  LinkImportEpisodeSeed,
  LinkImportResult,
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
import { backupDatabase, createSafetyBackup, todayDateStr, writeDailyExport } from './backup.ts';
import { exportData, getState, importData } from './importExportRepo.ts';
import { deleteList, deleteListEntry, patchList, patchListEntry, putList, putListEntry } from './listsRepo.ts';
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
import { applyTitleAtomicAction, deleteTitle, getTitle, patchTitle, putTitle, replaceSeasons } from './titlesRepo.ts';
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
  fsImpl: Pick<typeof fs, 'mkdirSync' | 'accessSync' | 'writeFileSync' | 'unlinkSync'> = fs,
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
  private readonly ctx: DbContext;

  constructor(options: RepositoryOptions = {}) {
    const resolvedDataDir =
      options.dbPath === ':memory:' ? null : path.resolve(options.dataDir || process.env.DATA_DIR || './data');
    this.dataDir = resolvedDataDir;

    const dbPath = options.dbPath || (resolvedDataDir ? path.join(resolvedDataDir, 'tracker.db') : ':memory:');
    this.isMemory = dbPath === ':memory:';

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
      runInTransaction: <T>(fn: () => T) => this.runInTransaction(fn),
      bumpVersionInTx: () => this.bumpVersionInTx(),
      getVersion: () => this.getVersion(),
    };

    this.applyMigrations(options.migrateTo ?? LATEST_SCHEMA_VERSION);
  }

  public close(): void {
    this.db.close();
  }

  private getUserVersion(): number {
    const row = this.db.prepare('PRAGMA user_version;').get() as { user_version?: number } | undefined;
    return Number(row?.user_version ?? 0);
  }

  private applyMigrations(target: number): void {
    const currentVersion = this.getUserVersion();
    if (currentVersion > LATEST_SCHEMA_VERSION) {
      // Written by a newer release: running old code against it could corrupt data it does not understand.
      this.db.close();
      throw new Error(
        `Database schema version ${currentVersion} is newer than this release supports (${LATEST_SCHEMA_VERSION}). ` +
          'Update the app, or restore a backup made by this release.',
      );
    }
    const pending = MIGRATIONS.filter((m) => m.version > currentVersion && m.version <= target);
    if (pending.length === 0) return;

    if (currentVersion > 0) this.createSafetyBackup('pre-migration');

    for (const migration of pending) {
      this.runInTransaction(() => {
        if (migration.sql) this.db.exec(migration.sql);
        migration.run?.(this.db);
        this.db.exec(`PRAGMA user_version = ${migration.version};`);
      });
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
        "INSERT INTO meta (key, value) VALUES ('version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run(String(next));
    return next;
  }

  public getVersion(): number {
    const row = this.db.prepare("SELECT value FROM meta WHERE key = 'version'").get() as { value?: string } | undefined;
    return row?.value ? Number.parseInt(row.value, 10) || 0 : 0;
  }

  public createSafetyBackup(kind: 'pre-migration' | 'pre-import', now = new Date()): string | null {
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

  public getSeasons(id: string): SeasonDoc[] {
    return readSeasons(this.ctx, id);
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
    },
  ): StateMutationResult {
    return putTitle(this.ctx, id, normalizeTmdbImages(input));
  }

  public patchTitle(id: string, patch: Partial<Omit<TitleDoc, 'id'>>): StateMutationResult {
    return patchTitle(this.ctx, id, normalizeTmdbImages(patch));
  }

  public deleteTitle(id: string): StateMutationResult {
    return deleteTitle(this.ctx, id);
  }

  public fillEpisodeMetadataBatch(
    id: string,
    sourceUrl: string,
    entries: Array<{ videoId: string; detail: LinkImportResult }>,
  ) {
    return fillEpisodeMetadataBatch(this.ctx, id, sourceUrl, entries);
  }
  public enrichmentDue(id: string, sourceUrl: string, videoId: string, now = Date.now()) {
    return enrichmentDue(this.ctx, id, sourceUrl, videoId, now);
  }
  public claimEnrichment(id: string, sourceUrl: string, videoId: string, now = Date.now()) {
    return claimEnrichment(this.ctx, id, sourceUrl, videoId, now);
  }

  public previewStructure(id: string) {
    return previewStructure(this.ctx, id);
  }
  public decideStructure(id: string, decision: 'keep' | 'adopt', version: number, signature: string) {
    return decideStructure(this.ctx, id, decision, version, signature);
  }
  public convertToManual(id: string) {
    return convertToManual(this.ctx, id);
  }

  public refreshMetadata(
    id: string,
    data: import('../../src/domain/types.ts').TmdbDetails,
    now = Date.now(),
    relink = false,
  ): StateMutationResult {
    return refreshMetadata(this.ctx, id, data, now, relink);
  }

  public replaceSeasons(titleId: string, seasons: SeasonDoc[]): StateMutationResult {
    return replaceSeasons(this.ctx, titleId, seasons);
  }

  public appendPlaylistEpisodes(
    titleId: string,
    incomingEpisodes: LinkImportEpisodeSeed[],
    now = Date.now(),
    metadata?: LinkImportResult,
  ): PlaylistRefreshResult {
    return appendPlaylistEpisodes(this.ctx, titleId, incomingEpisodes, now, metadata);
  }

  public applyTitleAtomicAction(titleId: string, input: TitleAtomicActionInput): StateMutationResult {
    return applyTitleAtomicAction(this.ctx, titleId, input);
  }

  public putProgress(
    titleId: string,
    playthroughId: string,
    input: { watched: Record<string, number>; movieWatchedAt?: number },
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
    },
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

  public putListEntry(listId: string, entryId: string, entryInput: Omit<ListEntryDoc, 'id'>): StateMutationResult {
    return putListEntry(this.ctx, listId, entryId, entryInput);
  }

  public patchListEntry(
    listId: string,
    entryId: string,
    patch: Partial<Omit<ListEntryDoc, 'id'>>,
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

  public importData(rawInput: unknown, options: { skipBackup?: boolean; now?: Date } = {}): StateMutationResult {
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
