import type { DatabaseSync } from 'node:sqlite';
import type { ListEntryDoc, ServerErrorCode, TitleDoc, WatchListDoc } from '../../src/domain/types.ts';

export class NotFoundError extends Error {
  public readonly code: ServerErrorCode;
  constructor(message: string, code: ServerErrorCode = 'TITLE_NOT_FOUND') {
    super(message);
    this.name = 'NotFoundError';
    this.code = code;
  }
}

/** The copy taken before an import or a migration could not be written, so nothing was changed. */
export class SafetyBackupError extends Error {
  public readonly code: ServerErrorCode = 'BACKUP_FAILED';
  constructor(kind: string, cause: unknown) {
    super(`Could not write the ${kind} safety backup; nothing was changed.`, { cause });
    this.name = 'SafetyBackupError';
  }
}

export class ConflictError extends Error {
  public readonly code: ServerErrorCode;
  constructor(message: string, code: ServerErrorCode = 'CONFLICT_ERROR') {
    super(message);
    this.name = 'ConflictError';
    this.code = code;
  }
}

export interface RepositoryOptions {
  dbPath?: string;
  dataDir?: string;
  /** Stop at an older schema version. Only for tests that seed a legacy database. */
  migrateTo?: number;
}

export interface StoredProgressData {
  archivedWatched?: import('../../src/domain/types.ts').ArchivedWatch[];
  watched: Record<string, number>;
  movieWatchedAt?: number;
}

export interface StoredAuthData {
  passwordHash: string;
  updatedAt: number;
}

export interface DbContext {
  db: DatabaseSync;
  isMemory: boolean;
  dataDir: string | null;
  runInTransaction: <T>(fn: () => T) => T;
  bumpVersionInTx: () => number;
  getVersion: () => number;
}

export function serializeTitleData(title: TitleDoc): string {
  const { id: _id, ...rest } = title;
  if (rest.upstreamChange) {
    const { seasons: _seasons, ...header } = rest.upstreamChange;
    return JSON.stringify({ ...rest, upstreamChange: header });
  }
  return JSON.stringify(rest);
}

export function serializeListData(list: WatchListDoc): string {
  const { id: _id, ...rest } = list;
  return JSON.stringify(rest);
}

export function serializeEntryData(entry: ListEntryDoc): string {
  const { id: _id, ...rest } = entry;
  return JSON.stringify(rest);
}
