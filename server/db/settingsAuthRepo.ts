import { DEFAULT_APP_SETTINGS } from '../../src/domain/schemas.ts';
import type { AppSettingsDoc, StateMutationResult } from '../../src/domain/types.ts';
import { ConflictError, type DbContext, type StoredAuthData } from './types.ts';

export function getSettings(ctx: DbContext): AppSettingsDoc {
  const row = ctx.db.prepare("SELECT data FROM settings WHERE key = 'app'").get() as
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

export function patchSettings(
  ctx: DbContext,
  patch: Partial<AppSettingsDoc>
): StateMutationResult {
  return ctx.runInTransaction(() => {
    const current = getSettings(ctx);
    const updated: AppSettingsDoc = {
      ...current,
      ...patch,
    };

    ctx.db
      .prepare(
        `INSERT INTO settings (key, data) VALUES ('app', ?)
         ON CONFLICT(key) DO UPDATE SET data = excluded.data`
      )
      .run(JSON.stringify(updated));

    const version = ctx.bumpVersionInTx();
    return {
      version,
      upserts: {
        settings: updated,
      },
      deletes: {},
    };
  });
}

export function getStoredPasswordHash(ctx: DbContext): string | null {
  const row = ctx.db.prepare("SELECT data FROM settings WHERE key = 'auth'").get() as
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

export function setStoredPasswordHash(
  ctx: DbContext,
  passwordHash: string,
  now = Date.now()
): void {
  ctx.runInTransaction(() => {
    const existing = getStoredPasswordHash(ctx);
    if (existing) {
      throw new ConflictError('Password has already been configured', 'PASSWORD_ALREADY_SET');
    }
    const data: StoredAuthData = { passwordHash, updatedAt: now };
    ctx.db
      .prepare("INSERT INTO settings (key, data) VALUES ('auth', ?)")
      .run(JSON.stringify(data));
  });
}

export function createSession(
  ctx: DbContext,
  tokenHash: string,
  now: number,
  expiresAt: number
): void {
  ctx.runInTransaction(() => {
    ctx.db
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

export function verifyAndTouchSession(
  ctx: DbContext,
  tokenHash: string,
  now: number,
  newExpiresAt: number
): boolean {
  const row = ctx.db
    .prepare('SELECT expires_at FROM sessions WHERE token_hash = ?')
    .get(tokenHash) as { expires_at: number } | undefined;

  if (!row) return false;

  if (row.expires_at <= now) {
    ctx.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    return false;
  }

  ctx.db
    .prepare('UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE token_hash = ?')
    .run(now, newExpiresAt, tokenHash);
  return true;
}

export function deleteSession(ctx: DbContext, tokenHash: string): void {
  ctx.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

export function deleteAllSessions(ctx: DbContext): void {
  ctx.db.prepare('DELETE FROM sessions').run();
}
