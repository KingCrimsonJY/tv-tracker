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
  migrationsDir?: string;
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
  migrationsDir: string;
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
