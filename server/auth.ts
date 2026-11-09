import crypto from 'node:crypto';
import type { Request, Response } from 'express';

export const SESSION_COOKIE_NAME = 'zhenji_session';
export const SESSION_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 365 days
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX_FAILURES = 5;
export const GLOBAL_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
export const GLOBAL_RATE_LIMIT_MAX_FAILURES = 20;
export const GLOBAL_BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
export const MIN_PASSWORD_LENGTH = 10;

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const trimmed = storedHash.trim().replace(/^['"]|['"]$/g, '');
    const parts = trimmed.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false;
    }
    const [, salt, expectedHex] = parts;
    if (!salt || !expectedHex) return false;

    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (expectedBuf.length !== SCRYPT_KEYLEN) return false;

    const actualBuf = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
    if (actualBuf.length !== expectedBuf.length) return false;

    return crypto.timingSafeEqual(actualBuf, expectedBuf);
  } catch {
    return false;
  }
}

export function verifySetupCode(provided: string, expected: string): boolean {
  const a = Buffer.from(provided.trim(), 'utf-8');
  const b = Buffer.from(expected.trim(), 'utf-8');
  if (a.length === 0 || a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateSessionToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  return { token, tokenHash };
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

export function setSessionCookie(res: Response, token: string, isProduction: boolean): void {
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAgeSec}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isProduction) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: Response, isProduction: boolean): void {
  const parts = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
  if (isProduction) {
    parts.push('Secure');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function getClientIp(req: Request, trustProxy: boolean): string {
  if (trustProxy) {
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp.trim()) {
      return cfIp.trim();
    }
    // Clients can prepend arbitrary entries; the trusted proxy appends the address it saw last.
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
      const last = xff.split(',').at(-1)?.trim();
      if (last) return last;
    }
  }
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

export function isSameOriginRequest(req: Request, trustProxy = false): boolean {
  const originHeader = req.headers.origin;
  if (!originHeader || typeof originHeader !== 'string') {
    return false;
  }
  let originUrl: URL;
  try {
    originUrl = new URL(originHeader);
  } catch {
    return false;
  }

  // Only a trusted reverse proxy may override the Host the browser connected to.
  const forwardedHost = trustProxy ? req.headers['x-forwarded-host'] : undefined;
  const rawHost = (typeof forwardedHost === 'string' && forwardedHost.split(',')[0]?.trim()) || req.headers.host || '';
  if (!rawHost) return false;

  return originUrl.host.toLowerCase() === rawHost.toLowerCase();
}

export class LoginRateLimiter {
  private readonly failures = new Map<string, number[]>();
  private globalFailures: number[] = [];
  private globalBlockedUntil = 0;

  private readonly windowMs: number;
  private readonly maxFailures: number;
  private readonly globalWindowMs: number;
  private readonly globalMaxFailures: number;
  private readonly globalBlockDurationMs: number;

  constructor(
    windowMs = RATE_LIMIT_WINDOW_MS,
    maxFailures = RATE_LIMIT_MAX_FAILURES,
    globalWindowMs = GLOBAL_RATE_LIMIT_WINDOW_MS,
    globalMaxFailures = GLOBAL_RATE_LIMIT_MAX_FAILURES,
    globalBlockDurationMs = GLOBAL_BLOCK_DURATION_MS,
  ) {
    this.windowMs = windowMs;
    this.maxFailures = maxFailures;
    this.globalWindowMs = globalWindowMs;
    this.globalMaxFailures = globalMaxFailures;
    this.globalBlockDurationMs = globalBlockDurationMs;
  }

  private pruneIp(ip: string, now: number): number[] {
    const list = this.failures.get(ip) || [];
    const cutoff = now - this.windowMs;
    const active = list.filter((ts) => ts > cutoff);
    if (active.length === 0) {
      this.failures.delete(ip);
    } else {
      this.failures.set(ip, active);
    }
    return active;
  }

  private pruneGlobal(now: number): void {
    if (this.globalBlockedUntil > 0 && now >= this.globalBlockedUntil) {
      this.globalBlockedUntil = 0;
      this.globalFailures = [];
      return;
    }
    const cutoff = now - this.globalWindowMs;
    this.globalFailures = this.globalFailures.filter((ts) => ts > cutoff);
  }

  public isBlocked(ip: string, now = Date.now()): boolean {
    this.pruneGlobal(now);
    if (this.globalBlockedUntil > now) {
      return true;
    }
    const active = this.pruneIp(ip, now);
    return active.length >= this.maxFailures;
  }

  public recordFailure(ip: string, now = Date.now()): void {
    this.pruneGlobal(now);
    this.globalFailures.push(now);
    if (this.globalFailures.length >= this.globalMaxFailures) {
      this.globalBlockedUntil = now + this.globalBlockDurationMs;
    }

    const active = this.pruneIp(ip, now);
    active.push(now);
    this.failures.set(ip, active);
  }

  public clear(ip: string): void {
    this.failures.delete(ip);
  }
}
