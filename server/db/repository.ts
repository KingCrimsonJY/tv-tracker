import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DEFAULT_APP_SETTINGS, importPayloadSchema } from '../../src/domain/schemas.ts';
import type {
  AppSettingsDoc,
  AppStateSnapshot,
  ListEntryDoc,
  ProgressDoc,
  SeasonDoc,
  StateMutationResult,
  TitleDoc,
  WatchListDoc,
  ZhenjiExportV2,
} from '../../src/domain/types.ts';

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export interface RepositoryOptions {
  dbPath?: string;
  dataDir?: string;
  migrationsDir?: string;
}

interface StoredProgressData {
  watched: Record<string, number>;
  movieWatchedAt?: number;
}

interface StoredAuthData {
  passwordHash: string;
  updatedAt: number;
}

function todayDateStr(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function formatTimeHHmmss(now = new Date()): string {
  return now.toISOString().slice(11, 19).replace(/:/g, '');
}

const DAILY_BACKUP_REGEX = /^tracker-\d{4}-\d{2}-\d{2}\.db$/;
const SAFETY_BACKUP_REGEX = /^tracker-\d{4}-\d{2}-\d{2}-\d{6}-pre-(?:import|migration)(?:-\d+)?\.db$/;
const DAILY_EXPORT_REGEX = /^zhenji-\d{4}-\d{2}-\d{2}\.json$/;

function pruneMatchingFilesKeepingNewest(
  dirPath: string,
  pattern: RegExp,
  keepCount: number
): void {
  if (!fs.existsSync(dirPath)) return;
  const files = fs
    .readdirSync(dirPath)
    .filter((f) => pattern.test(f))
    .sort(); // Lexicographical sort matches YYYY-MM-DD(-HHmmss) ascending
  if (files.length <= keepCount) return;
  const toDelete = files.slice(0, files.length - keepCount);
  for (const file of toDelete) {
    try {
      fs.unlinkSync(path.join(dirPath, file));
    } catch (err) {
      console.error(`Failed to prune old file ${file}:`, err);
    }
  }
}

export class TrackerRepository {
  private readonly db: DatabaseSync;
  private readonly isMemory: boolean;
  private readonly dataDir: string | null;
  private readonly migrationsDir: string;

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
      fs.mkdirSync(this.dataDir, { recursive: true });
      fs.mkdirSync(path.join(this.dataDir, 'backups'), { recursive: true });
      fs.mkdirSync(path.join(this.dataDir, 'exports'), { recursive: true });
    }

    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    if (!this.isMemory) {
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA busy_timeout = 5000;');
    }

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

    // Automatic safety backup before applying migrations on an existing file database
    if (!this.isMemory && this.dataDir && currentVersion > 0) {
      this.createSafetyBackup('pre-migration');
    }

    for (const migration of pending) {
      const sqlPath = path.join(this.migrationsDir, migration.filename);
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
      this.runInTransaction(() => {
        this.db.exec(sqlContent);
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
      .prepare("INSERT INTO meta (key, value) VALUES ('version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
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
    if (this.isMemory || !this.dataDir) return null;
    const backupsDir = path.join(this.dataDir, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });

    const dateStr = todayDateStr(now);
    const timeStr = formatTimeHHmmss(now);
    let baseName = `tracker-${dateStr}-${timeStr}-${kind}.db`;
    let targetPath = path.join(backupsDir, baseName);
    let suffix = 1;
    while (fs.existsSync(targetPath)) {
      baseName = `tracker-${dateStr}-${timeStr}-${kind}-${suffix}.db`;
      targetPath = path.join(backupsDir, baseName);
      suffix++;
    }

    const tempPath = path.join(backupsDir, `.${baseName}.tmp-${process.pid}-${Date.now()}`);
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      const escapedPath = tempPath.replace(/'/g, "''");
      this.db.exec(`VACUUM INTO '${escapedPath}';`);
      fs.renameSync(tempPath, targetPath);
      pruneMatchingFilesKeepingNewest(backupsDir, SAFETY_BACKUP_REGEX, 10);
      return targetPath;
    } catch (err) {
      console.error(`Failed to create ${kind} safety backup:`, err);
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // ignore
        }
      }
      return null;
    }
  }

  public backupDatabase(dateStr = todayDateStr()): string | null {
    if (this.isMemory || !this.dataDir) return null;
    const backupsDir = path.join(this.dataDir, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
    const targetPath = path.join(backupsDir, `tracker-${dateStr}.db`);
    const tempPath = path.join(backupsDir, `.tracker-${dateStr}.tmp-${process.pid}-${Date.now()}.db`);

    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      const escapedPath = tempPath.replace(/'/g, "''");
      this.db.exec(`VACUUM INTO '${escapedPath}';`);
      fs.renameSync(tempPath, targetPath);
      pruneMatchingFilesKeepingNewest(backupsDir, DAILY_BACKUP_REGEX, 14);
      return targetPath;
    } catch (err) {
      console.error(`Failed to create daily database backup for ${dateStr}:`, err);
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // ignore
        }
      }
      return null;
    }
  }

  public writeDailyExport(dateStr = todayDateStr()): string | null {
    if (this.isMemory || !this.dataDir) return null;
    const exportsDir = path.join(this.dataDir, 'exports');
    fs.mkdirSync(exportsDir, { recursive: true });
    const targetPath = path.join(exportsDir, `zhenji-${dateStr}.json`);
    const tempPath = path.join(exportsDir, `.zhenji-${dateStr}.tmp-${process.pid}-${Date.now()}.json`);

    try {
      const exported = this.exportData();
      fs.writeFileSync(tempPath, JSON.stringify(exported, null, 2), 'utf-8');
      fs.renameSync(tempPath, targetPath);
      pruneMatchingFilesKeepingNewest(exportsDir, DAILY_EXPORT_REGEX, 14);
      return targetPath;
    } catch (err) {
      console.error(`Failed to write daily JSON export for ${dateStr}:`, err);
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // ignore
        }
      }
      return null;
    }
  }

  public runDailyMaintenance(dateStr = todayDateStr()): void {
    this.backupDatabase(dateStr);
    this.writeDailyExport(dateStr);
  }

  // =========================================================================
  // Read State
  // =========================================================================

  public getSettings(): AppSettingsDoc {
    const row = this.db.prepare("SELECT data FROM settings WHERE key = 'app'").get() as
      | { data: string }
      | undefined;
    if (!row) {
      return structuredClone(DEFAULT_APP_SETTINGS);
    }
    try {
      const parsed = JSON.parse(row.data) as Partial<AppSettingsDoc>;
      return {
        ...structuredClone(DEFAULT_APP_SETTINGS),
        ...parsed,
      };
    } catch {
      return structuredClone(DEFAULT_APP_SETTINGS);
    }
  }

  public getState(): AppStateSnapshot {
    const version = this.getVersion();
    const settings = this.getSettings();

    const titles: Record<string, TitleDoc> = {};
    const titleRows = this.db.prepare('SELECT id, data FROM titles').all() as Array<{
      id: string;
      data: string;
    }>;
    for (const row of titleRows) {
      const data = JSON.parse(row.data) as Omit<TitleDoc, 'id'>;
      titles[row.id] = { ...data, id: row.id };
    }

    const seasonsByTitle: Record<string, SeasonDoc[]> = {};
    const seasonRows = this.db
      .prepare('SELECT title_id, season_number, data FROM seasons ORDER BY season_number ASC')
      .all() as Array<{
      title_id: string;
      season_number: number;
      data: string;
    }>;
    for (const row of seasonRows) {
      const season = JSON.parse(row.data) as SeasonDoc;
      if (!seasonsByTitle[row.title_id]) {
        seasonsByTitle[row.title_id] = [];
      }
      seasonsByTitle[row.title_id].push(season);
    }

    const progressByTitle: Record<string, Record<string, ProgressDoc>> = {};
    const progressRows = this.db
      .prepare('SELECT title_id, playthrough_id, data FROM progress')
      .all() as Array<{
      title_id: string;
      playthrough_id: string;
      data: string;
    }>;
    for (const row of progressRows) {
      const data = JSON.parse(row.data) as StoredProgressData;
      if (!progressByTitle[row.title_id]) {
        progressByTitle[row.title_id] = {};
      }
      progressByTitle[row.title_id][row.playthrough_id] = {
        playthroughId: row.playthrough_id,
        watched: data.watched || {},
        ...(data.movieWatchedAt !== undefined ? { movieWatchedAt: data.movieWatchedAt } : {}),
      };
    }

    const lists: Record<string, WatchListDoc> = {};
    const listRows = this.db.prepare('SELECT id, data, rank FROM lists ORDER BY rank ASC').all() as Array<{
      id: string;
      data: string;
      rank: string;
    }>;
    for (const row of listRows) {
      const data = JSON.parse(row.data) as Omit<WatchListDoc, 'id'>;
      lists[row.id] = { ...data, id: row.id, rank: row.rank };
    }

    const entriesByList: Record<string, ListEntryDoc[]> = {};
    const entryRows = this.db
      .prepare('SELECT id, list_id, title_id, rank, data FROM list_entries ORDER BY rank ASC')
      .all() as Array<{
      id: string;
      list_id: string;
      title_id: string;
      rank: string;
      data: string;
    }>;
    for (const row of entryRows) {
      const data = JSON.parse(row.data) as Omit<ListEntryDoc, 'id'>;
      if (!entriesByList[row.list_id]) {
        entriesByList[row.list_id] = [];
      }
      entriesByList[row.list_id].push({
        ...data,
        id: row.id,
        titleId: row.title_id,
        rank: row.rank,
      });
    }

    return {
      version,
      titles,
      seasonsByTitle,
      progressByTitle,
      lists,
      entriesByList,
      settings,
    };
  }

  // =========================================================================
  // Titles & Seasons Mutations
  // =========================================================================

  private serializeTitleData(title: TitleDoc): string {
    const { id: _id, ...rest } = title;
    return JSON.stringify(rest);
  }

  public putTitle(
    id: string,
    input: {
      title: TitleDoc;
      seasons?: SeasonDoc[];
      progress?: Record<string, ProgressDoc>;
    }
  ): StateMutationResult {
    return this.runInTransaction(() => {
      const titleDoc: TitleDoc = { ...input.title, id };
      const dataJson = this.serializeTitleData(titleDoc);

      this.db
        .prepare(
          `INSERT INTO titles (id, data, added_at, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             data = excluded.data,
             added_at = excluded.added_at,
             updated_at = excluded.updated_at`
        )
        .run(id, dataJson, titleDoc.addedAt, titleDoc.updatedAt);

      let sortedSeasons: SeasonDoc[] | undefined;
      if (input.seasons !== undefined) {
        this.db.prepare('DELETE FROM seasons WHERE title_id = ?').run(id);
        sortedSeasons = [...input.seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
        const insertSeason = this.db.prepare(
          'INSERT INTO seasons (title_id, season_number, data) VALUES (?, ?, ?)'
        );
        for (const s of sortedSeasons) {
          insertSeason.run(id, s.seasonNumber, JSON.stringify(s));
        }
      }

      let storedProgressMap: Record<string, ProgressDoc> | undefined;
      if (input.progress !== undefined) {
        storedProgressMap = {};
        const upsertProg = this.db.prepare(
          `INSERT INTO progress (title_id, playthrough_id, data)
           VALUES (?, ?, ?)
           ON CONFLICT(title_id, playthrough_id) DO UPDATE SET data = excluded.data`
        );
        for (const [ptId, pDoc] of Object.entries(input.progress)) {
          const progPayload: StoredProgressData = {
            watched: pDoc.watched || {},
            ...(pDoc.movieWatchedAt !== undefined ? { movieWatchedAt: pDoc.movieWatchedAt } : {}),
          };
          upsertProg.run(id, ptId, JSON.stringify(progPayload));
          storedProgressMap[ptId] = {
            playthroughId: ptId,
            watched: progPayload.watched,
            ...(progPayload.movieWatchedAt !== undefined
              ? { movieWatchedAt: progPayload.movieWatchedAt }
              : {}),
          };
        }
      }

      const version = this.bumpVersionInTx();
      return {
        version,
        upserts: {
          titles: { [id]: titleDoc },
          ...(sortedSeasons !== undefined ? { seasonsByTitle: { [id]: sortedSeasons } } : {}),
          ...(storedProgressMap !== undefined
            ? { progressByTitle: { [id]: storedProgressMap } }
            : {}),
        },
        deletes: {},
      };
    });
  }

  public patchTitle(id: string, patch: Partial<Omit<TitleDoc, 'id'>>): StateMutationResult {
    return this.runInTransaction(() => {
      const row = this.db.prepare('SELECT data FROM titles WHERE id = ?').get(id) as
        | { data: string }
        | undefined;
      if (!row) {
        throw new NotFoundError(`未找到作品: ${id}`);
      }

      const existing = JSON.parse(row.data) as Omit<TitleDoc, 'id'>;
      const merged: TitleDoc = {
        ...existing,
        ...patch,
        id,
      };
      const dataJson = this.serializeTitleData(merged);

      this.db
        .prepare('UPDATE titles SET data = ?, added_at = ?, updated_at = ? WHERE id = ?')
        .run(dataJson, merged.addedAt, merged.updatedAt, id);

      const version = this.bumpVersionInTx();
      return {
        version,
        upserts: {
          titles: { [id]: merged },
        },
        deletes: {},
      };
    });
  }

  public deleteTitle(id: string): StateMutationResult {
    return this.runInTransaction(() => {
      const affectedEntries = this.db
        .prepare('SELECT id, list_id FROM list_entries WHERE title_id = ?')
        .all(id) as Array<{ id: string; list_id: string }>;

      this.db.prepare('DELETE FROM titles WHERE id = ?').run(id);
      const version = this.bumpVersionInTx();

      return {
        version,
        upserts: {},
        deletes: {
          titles: [id],
          ...(affectedEntries.length > 0
            ? {
                entries: affectedEntries.map((e) => ({
                  listId: e.list_id,
                  entryId: e.id,
                })),
              }
            : {}),
        },
      };
    });
  }

  public replaceSeasons(titleId: string, seasons: SeasonDoc[]): StateMutationResult {
    return this.runInTransaction(() => {
      const exists = this.db.prepare('SELECT 1 FROM titles WHERE id = ?').get(titleId);
      if (!exists) {
        throw new NotFoundError(`未找到作品: ${titleId}`);
      }

      this.db.prepare('DELETE FROM seasons WHERE title_id = ?').run(titleId);
      const sortedSeasons = [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
      const insertStmt = this.db.prepare(
        'INSERT INTO seasons (title_id, season_number, data) VALUES (?, ?, ?)'
      );
      for (const s of sortedSeasons) {
        insertStmt.run(titleId, s.seasonNumber, JSON.stringify(s));
      }

      const version = this.bumpVersionInTx();
      return {
        version,
        upserts: {
          seasonsByTitle: {
            [titleId]: sortedSeasons,
          },
        },
        deletes: {},
      };
    });
  }

  // =========================================================================
  // Progress Mutations
  // =========================================================================

  public putProgress(
    titleId: string,
    playthroughId: string,
    input: { watched: Record<string, number>; movieWatchedAt?: number }
  ): StateMutationResult {
    return this.runInTransaction(() => {
      const exists = this.db.prepare('SELECT 1 FROM titles WHERE id = ?').get(titleId);
      if (!exists) {
        throw new NotFoundError(`未找到作品: ${titleId}`);
      }

      const payload: StoredProgressData = {
        watched: { ...(input.watched || {}) },
        ...(input.movieWatchedAt !== undefined ? { movieWatchedAt: input.movieWatchedAt } : {}),
      };

      this.db
        .prepare(
          `INSERT INTO progress (title_id, playthrough_id, data)
           VALUES (?, ?, ?)
           ON CONFLICT(title_id, playthrough_id) DO UPDATE SET data = excluded.data`
        )
        .run(titleId, playthroughId, JSON.stringify(payload));

      const doc: ProgressDoc = {
        playthroughId,
        watched: payload.watched,
        ...(payload.movieWatchedAt !== undefined
          ? { movieWatchedAt: payload.movieWatchedAt }
          : {}),
      };

      const version = this.bumpVersionInTx();
      return {
        version,
        upserts: {
          progressByTitle: {
            [titleId]: {
              [playthroughId]: doc,
            },
          },
        },
        deletes: {},
      };
    });
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
    return this.runInTransaction(() => {
      const exists = this.db.prepare('SELECT 1 FROM titles WHERE id = ?').get(titleId);
      if (!exists) {
        throw new NotFoundError(`未找到作品: ${titleId}`);
      }

      const row = this.db
        .prepare('SELECT data FROM progress WHERE title_id = ? AND playthrough_id = ?')
        .get(titleId, playthroughId) as { data: string } | undefined;

      const current: StoredProgressData = row
        ? (JSON.parse(row.data) as StoredProgressData)
        : { watched: {} };

      const watched: Record<string, number> = { ...(current.watched || {}) };

      if (patch.set) {
        for (const [epKey, ts] of Object.entries(patch.set)) {
          watched[epKey] = ts;
        }
      }
      if (patch.unset) {
        for (const epKey of patch.unset) {
          delete watched[epKey];
        }
      }

      let movieWatchedAt = current.movieWatchedAt;
      if (patch.movieWatchedAt === null) {
        movieWatchedAt = undefined;
      } else if (typeof patch.movieWatchedAt === 'number') {
        movieWatchedAt = patch.movieWatchedAt;
      }

      const updatedData: StoredProgressData = {
        watched,
        ...(movieWatchedAt !== undefined ? { movieWatchedAt } : {}),
      };

      this.db
        .prepare(
          `INSERT INTO progress (title_id, playthrough_id, data)
           VALUES (?, ?, ?)
           ON CONFLICT(title_id, playthrough_id) DO UPDATE SET data = excluded.data`
        )
        .run(titleId, playthroughId, JSON.stringify(updatedData));

      const doc: ProgressDoc = {
        playthroughId,
        watched: updatedData.watched,
        ...(updatedData.movieWatchedAt !== undefined
          ? { movieWatchedAt: updatedData.movieWatchedAt }
          : {}),
      };

      const version = this.bumpVersionInTx();
      return {
        version,
        upserts: {
          progressByTitle: {
            [titleId]: {
              [playthroughId]: doc,
            },
          },
        },
        deletes: {},
      };
    });
  }

  public deleteProgress(titleId: string, playthroughId: string): StateMutationResult {
    return this.runInTransaction(() => {
      this.db
        .prepare('DELETE FROM progress WHERE title_id = ? AND playthrough_id = ?')
        .run(titleId, playthroughId);
      const version = this.bumpVersionInTx();
      return {
        version,
        upserts: {},
        deletes: {
          progress: [{ titleId, playthroughId }],
        },
      };
    });
  }

  // =========================================================================
  // Lists & List Entries Mutations
  // =========================================================================

  private serializeListData(list: WatchListDoc): string {
    const { id: _id, ...rest } = list;
    return JSON.stringify(rest);
  }

  private serializeEntryData(entry: ListEntryDoc): string {
    const { id: _id, ...rest } = entry;
    return JSON.stringify(rest);
  }

  private getEntriesForListInTx(listId: string): ListEntryDoc[] {
    const rows = this.db
      .prepare('SELECT id, title_id, rank, data FROM list_entries WHERE list_id = ? ORDER BY rank ASC')
      .all(listId) as Array<{
      id: string;
      title_id: string;
      rank: string;
      data: string;
    }>;
    return rows.map((r) => {
      const parsed = JSON.parse(r.data) as Omit<ListEntryDoc, 'id'>;
      return {
        ...parsed,
        id: r.id,
        titleId: r.title_id,
        rank: r.rank,
      };
    });
  }

  public putList(id: string, listInput: Omit<WatchListDoc, 'id'>): StateMutationResult {
    return this.runInTransaction(() => {
      const listDoc: WatchListDoc = { ...listInput, id };
      this.db
        .prepare(
          `INSERT INTO lists (id, data, rank)
           VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET data = excluded.data, rank = excluded.rank`
        )
        .run(id, this.serializeListData(listDoc), listDoc.rank);

      const version = this.bumpVersionInTx();
      return {
        version,
        upserts: {
          lists: { [id]: listDoc },
        },
        deletes: {},
      };
    });
  }

  public patchList(id: string, patch: Partial<Omit<WatchListDoc, 'id'>>): StateMutationResult {
    return this.runInTransaction(() => {
      const row = this.db.prepare('SELECT data, rank FROM lists WHERE id = ?').get(id) as
        | { data: string; rank: string }
        | undefined;
      if (!row) {
        throw new NotFoundError(`未找到列表: ${id}`);
      }

      const existing = JSON.parse(row.data) as Omit<WatchListDoc, 'id'>;
      const merged: WatchListDoc = {
        ...existing,
        rank: row.rank,
        ...patch,
        id,
      };

      this.db
        .prepare('UPDATE lists SET data = ?, rank = ? WHERE id = ?')
        .run(this.serializeListData(merged), merged.rank, id);

      const version = this.bumpVersionInTx();
      return {
        version,
        upserts: {
          lists: { [id]: merged },
        },
        deletes: {},
      };
    });
  }

  public deleteList(id: string): StateMutationResult {
    return this.runInTransaction(() => {
      this.db.prepare('DELETE FROM lists WHERE id = ?').run(id);
      const version = this.bumpVersionInTx();
      return {
        version,
        upserts: {},
        deletes: {
          lists: [id],
        },
      };
    });
  }

  public putListEntry(
    listId: string,
    entryId: string,
    entryInput: Omit<ListEntryDoc, 'id'>
  ): StateMutationResult {
    return this.runInTransaction(() => {
      const listExists = this.db.prepare('SELECT 1 FROM lists WHERE id = ?').get(listId);
      if (!listExists) {
        throw new NotFoundError(`未找到列表: ${listId}`);
      }
      const titleExists = this.db
        .prepare('SELECT 1 FROM titles WHERE id = ?')
        .get(entryInput.titleId);
      if (!titleExists) {
        throw new NotFoundError(`未找到作品: ${entryInput.titleId}`);
      }

      const entryDoc: ListEntryDoc = { ...entryInput, id: entryId };
      this.db
        .prepare(
          `INSERT INTO list_entries (id, list_id, title_id, rank, data)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             list_id = excluded.list_id,
             title_id = excluded.title_id,
             rank = excluded.rank,
             data = excluded.data`
        )
        .run(entryId, listId, entryDoc.titleId, entryDoc.rank, this.serializeEntryData(entryDoc));

      const entries = this.getEntriesForListInTx(listId);
      const version = this.bumpVersionInTx();
      return {
        version,
        upserts: {
          entriesByList: {
            [listId]: entries,
          },
        },
        deletes: {},
      };
    });
  }

  public patchListEntry(
    listId: string,
    entryId: string,
    patch: Partial<Omit<ListEntryDoc, 'id'>>
  ): StateMutationResult {
    return this.runInTransaction(() => {
      const row = this.db
        .prepare('SELECT title_id, rank, data FROM list_entries WHERE id = ? AND list_id = ?')
        .get(entryId, listId) as { title_id: string; rank: string; data: string } | undefined;
      if (!row) {
        throw new NotFoundError(`未找到列表条目: ${entryId}`);
      }

      const existing = JSON.parse(row.data) as Omit<ListEntryDoc, 'id'>;
      const merged: ListEntryDoc = {
        ...existing,
        titleId: row.title_id,
        rank: row.rank,
        ...patch,
        id: entryId,
      };

      this.db
        .prepare(
          'UPDATE list_entries SET title_id = ?, rank = ?, data = ? WHERE id = ? AND list_id = ?'
        )
        .run(merged.titleId, merged.rank, this.serializeEntryData(merged), entryId, listId);

      const entries = this.getEntriesForListInTx(listId);
      const version = this.bumpVersionInTx();
      return {
        version,
        upserts: {
          entriesByList: {
            [listId]: entries,
          },
        },
        deletes: {},
      };
    });
  }

  public deleteListEntry(listId: string, entryId: string): StateMutationResult {
    return this.runInTransaction(() => {
      this.db
        .prepare('DELETE FROM list_entries WHERE id = ? AND list_id = ?')
        .run(entryId, listId);
      const entries = this.getEntriesForListInTx(listId);
      const version = this.bumpVersionInTx();
      return {
        version,
        upserts: {
          entriesByList: {
            [listId]: entries,
          },
        },
        deletes: {
          entries: [{ listId, entryId }],
        },
      };
    });
  }

  // =========================================================================
  // Settings Mutations
  // =========================================================================

  public patchSettings(patch: Partial<AppSettingsDoc>): StateMutationResult {
    return this.runInTransaction(() => {
      const current = this.getSettings();
      const updated: AppSettingsDoc = {
        ...current,
        ...patch,
      };

      this.db
        .prepare(
          `INSERT INTO settings (key, data) VALUES ('app', ?)
           ON CONFLICT(key) DO UPDATE SET data = excluded.data`
        )
        .run(JSON.stringify(updated));

      const version = this.bumpVersionInTx();
      return {
        version,
        upserts: {
          settings: updated,
        },
        deletes: {},
      };
    });
  }

  // =========================================================================
  // Export & Import
  // =========================================================================

  public exportData(exportedAt = new Date().toISOString()): ZhenjiExportV2 {
    const state = this.getState();
    return {
      format: 'zhenji-export',
      version: 2,
      exportedAt,
      settings: state.settings,
      titles: state.titles,
      seasonsByTitle: state.seasonsByTitle,
      progressByTitle: state.progressByTitle,
      lists: state.lists,
      entriesByList: state.entriesByList,
    };
  }

  public importData(
    rawInput: unknown,
    options: { skipBackup?: boolean; now?: Date } = {}
  ): StateMutationResult {
    const parsed = importPayloadSchema.parse(rawInput);

    if (!options.skipBackup) {
      this.createSafetyBackup('pre-import', options.now);
    }

    return this.runInTransaction(() => {
      const oldTitleIds = (
        this.db.prepare('SELECT id FROM titles').all() as Array<{ id: string }>
      ).map((r) => r.id);
      const oldListIds = (
        this.db.prepare('SELECT id FROM lists').all() as Array<{ id: string }>
      ).map((r) => r.id);

      // Clear all domain data tables (leave settings['auth'] and sessions untouched)
      this.db.prepare('DELETE FROM list_entries').run();
      this.db.prepare('DELETE FROM lists').run();
      this.db.prepare('DELETE FROM progress').run();
      this.db.prepare('DELETE FROM seasons').run();
      this.db.prepare('DELETE FROM titles').run();

      // 1. Settings
      const settings: AppSettingsDoc = {
        ...structuredClone(DEFAULT_APP_SETTINGS),
        ...parsed.settings,
      };
      this.db
        .prepare(
          `INSERT INTO settings (key, data) VALUES ('app', ?)
           ON CONFLICT(key) DO UPDATE SET data = excluded.data`
        )
        .run(JSON.stringify(settings));

      // 2. Titles
      const insertTitle = this.db.prepare(
        'INSERT INTO titles (id, data, added_at, updated_at) VALUES (?, ?, ?, ?)'
      );
      const titles: Record<string, TitleDoc> = {};
      for (const [id, title] of Object.entries(parsed.titles)) {
        const titleDoc: TitleDoc = { ...title, id };
        titles[id] = titleDoc;
        insertTitle.run(id, this.serializeTitleData(titleDoc), titleDoc.addedAt, titleDoc.updatedAt);
      }

      // 3. Seasons
      const insertSeason = this.db.prepare(
        'INSERT INTO seasons (title_id, season_number, data) VALUES (?, ?, ?)'
      );
      const seasonsByTitle: Record<string, SeasonDoc[]> = {};
      for (const [titleId, seasons] of Object.entries(parsed.seasonsByTitle)) {
        if (!titles[titleId]) continue;
        const sorted = [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
        seasonsByTitle[titleId] = sorted;
        for (const s of sorted) {
          insertSeason.run(titleId, s.seasonNumber, JSON.stringify(s));
        }
      }

      // 4. Progress
      const insertProgress = this.db.prepare(
        'INSERT INTO progress (title_id, playthrough_id, data) VALUES (?, ?, ?)'
      );
      const progressByTitle: Record<string, Record<string, ProgressDoc>> = {};
      for (const [titleId, progMap] of Object.entries(parsed.progressByTitle)) {
        if (!titles[titleId]) continue;
        progressByTitle[titleId] = {};
        for (const [ptId, pDoc] of Object.entries(progMap)) {
          const payload: StoredProgressData = {
            watched: pDoc.watched || {},
            ...(pDoc.movieWatchedAt !== undefined ? { movieWatchedAt: pDoc.movieWatchedAt } : {}),
          };
          insertProgress.run(titleId, ptId, JSON.stringify(payload));
          progressByTitle[titleId][ptId] = {
            playthroughId: ptId,
            watched: payload.watched,
            ...(payload.movieWatchedAt !== undefined
              ? { movieWatchedAt: payload.movieWatchedAt }
              : {}),
          };
        }
      }

      // 5. Lists
      const insertList = this.db.prepare('INSERT INTO lists (id, data, rank) VALUES (?, ?, ?)');
      const lists: Record<string, WatchListDoc> = {};
      for (const [listId, list] of Object.entries(parsed.lists)) {
        const listDoc: WatchListDoc = { ...list, id: listId };
        lists[listId] = listDoc;
        insertList.run(listId, this.serializeListData(listDoc), listDoc.rank);
      }

      // 6. List entries
      const insertEntry = this.db.prepare(
        'INSERT INTO list_entries (id, list_id, title_id, rank, data) VALUES (?, ?, ?, ?, ?)'
      );
      const entriesByList: Record<string, ListEntryDoc[]> = {};
      for (const [listId, entries] of Object.entries(parsed.entriesByList)) {
        if (!lists[listId]) continue;
        const validEntries: ListEntryDoc[] = [];
        for (const entry of entries) {
          if (!titles[entry.titleId]) continue;
          const entryDoc: ListEntryDoc = { ...entry };
          validEntries.push(entryDoc);
          insertEntry.run(
            entryDoc.id,
            listId,
            entryDoc.titleId,
            entryDoc.rank,
            this.serializeEntryData(entryDoc)
          );
        }
        validEntries.sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
        entriesByList[listId] = validEntries;
      }

      const removedTitles = oldTitleIds.filter((id) => !titles[id]);
      const removedLists = oldListIds.filter((id) => !lists[id]);

      const version = this.bumpVersionInTx();
      return {
        version,
        upserts: {
          titles,
          seasonsByTitle,
          progressByTitle,
          lists,
          entriesByList,
          settings,
        },
        deletes: {
          ...(removedTitles.length > 0 ? { titles: removedTitles } : {}),
          ...(removedLists.length > 0 ? { lists: removedLists } : {}),
        },
      };
    });
  }

  // =========================================================================
  // Auth & Sessions
  // =========================================================================

  public getStoredPasswordHash(): string | null {
    const row = this.db.prepare("SELECT data FROM settings WHERE key = 'auth'").get() as
      | { data: string }
      | undefined;
    if (!row) return null;
    try {
      const parsed = JSON.parse(row.data) as Partial<StoredAuthData>;
      return parsed.passwordHash || null;
    } catch {
      return null;
    }
  }

  public setStoredPasswordHash(passwordHash: string, now = Date.now()): void {
    this.runInTransaction(() => {
      const existing = this.getStoredPasswordHash();
      if (existing) {
        throw new ConflictError('密码已设置，无法重复初始化');
      }
      const data: StoredAuthData = { passwordHash, updatedAt: now };
      this.db
        .prepare("INSERT INTO settings (key, data) VALUES ('auth', ?)")
        .run(JSON.stringify(data));
    });
  }

  public createSession(tokenHash: string, now: number, expiresAt: number): void {
    this.runInTransaction(() => {
      this.db
        .prepare(
          `INSERT INTO sessions (token_hash, created_at, last_seen_at, expires_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(token_hash) DO UPDATE SET
             last_seen_at = excluded.last_seen_at,
             expires_at = excluded.expires_at`
        )
        .run(tokenHash, now, now, expiresAt);
    });
  }

  public verifyAndTouchSession(tokenHash: string, now: number, newExpiresAt: number): boolean {
    const row = this.db
      .prepare('SELECT expires_at FROM sessions WHERE token_hash = ?')
      .get(tokenHash) as { expires_at: number } | undefined;

    if (!row) return false;

    if (row.expires_at <= now) {
      this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      return false;
    }

    this.db
      .prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?')
      .run(now, newExpiresAt, tokenHash);
    return true;
  }

  public deleteSession(tokenHash: string): void {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  public deleteAllSessions(): void {
    this.db.prepare('DELETE FROM sessions').run();
  }
}
