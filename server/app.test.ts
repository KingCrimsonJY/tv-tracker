import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { SESSION_TTL_MS } from './auth.ts';
import { TrackerRepository } from './db/repository.ts';

describe('Express API & Auth Routes (in-memory SQLite)', () => {
  let repo: TrackerRepository;
  let server: Server;
  let baseUrl: string;
  let hostHeader: string;
  let currentNow: number;

  beforeEach(async () => {
    currentNow = 1710000000000;
    repo = new TrackerRepository({ dbPath: ':memory:' });
    const app = createApp({
      repo,
      nowFn: () => currentNow,
      envPasswordHash: '',
      trustProxy: true,
      isProduction: false,
    });

    server = await new Promise<Server>((resolve) => {
      const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
    });
    const addr = server.address() as AddressInfo;
    hostHeader = `127.0.0.1:${addr.port}`;
    baseUrl = `http://${hostHeader}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    repo.close();
  });

  it('rejects unauthenticated requests to /api/state with 401', async () => {
    const res = await fetch(`${baseUrl}/api/state`);
    expect(res.status).toBe(401);
  });

  it('allows first-run password setup once and rejects any second setup attempt', async () => {
    const statusBefore = await (await fetch(`${baseUrl}/api/auth/status`)).json();
    expect(statusBefore).toEqual({ needsSetup: true, authenticated: false });

    const setupRes1 = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'my-secret-password' }),
    });
    expect(setupRes1.status).toBe(200);
    const body1 = (await setupRes1.json()) as { ok: boolean; token: string };
    expect(body1.ok).toBe(true);
    expect(typeof body1.token).toBe('string');

    // Second setup attempt must fail with 403
    const setupRes2 = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'another-password' }),
    });
    expect(setupRes2.status).toBe(403);

    const statusAfter = await (
      await fetch(`${baseUrl}/api/auth/status`, {
        headers: { Authorization: `Bearer ${body1.token}` },
      })
    ).json();
    expect(statusAfter).toEqual({ needsSetup: false, authenticated: true });
  });

  it('expires sessions after 365 days of inactivity', async () => {
    const setupRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'my-secret-password' }),
    });
    const { token } = (await setupRes.json()) as { token: string };

    // Valid right now
    const okRes = await fetch(`${baseUrl}/api/state`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(okRes.status).toBe(200);

    // Advance time past SESSION_TTL_MS + 1ms
    currentNow += SESSION_TTL_MS + 1000;

    const expiredRes = await fetch(`${baseUrl}/api/state`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(expiredRes.status).toBe(401);
  });

  it('rate-limits failed logins after 5 attempts within 15 minutes per client IP', async () => {
    await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });

    // 5 failed login attempts from IP 203.0.113.50
    for (let i = 0; i < 5; i++) {
      const failRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '203.0.113.50',
        },
        body: JSON.stringify({ password: 'wrong-password' }),
      });
      expect(failRes.status).toBe(401);
    }

    // 6th attempt from same IP is blocked with 429 even with correct password
    const blockedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.50',
      },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    expect(blockedRes.status).toBe(429);

    // Different IP is not blocked
    const otherIpRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.99',
      },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    expect(otherIpRes.status).toBe(200);

    // After 15 minutes + 1s, the first IP is unblocked
    currentNow += 15 * 60 * 1000 + 1000;
    const unblockedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.50',
      },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    expect(unblockedRes.status).toBe(200);
  });

  it('rejects a cookie-authenticated POST/PATCH from another Origin with 403', async () => {
    const setupRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'my-secret-password' }),
    });
    const setCookie = setupRes.headers.get('set-cookie') || '';
    const cookiePair = setCookie.split(';')[0];
    expect(cookiePair).toContain('zhenji_session=');

    // Cross-origin POST with cookie and mismatched Origin -> 403
    const crossOriginPost = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: cookiePair,
        Origin: 'https://malicious.example.com',
      },
    });
    expect(crossOriginPost.status).toBe(403);

    // Cookie-authenticated PATCH without Origin header -> 403
    const missingOriginPatch = await fetch(`${baseUrl}/api/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookiePair,
      },
      body: JSON.stringify({ includeSpecials: true }),
    });
    expect(missingOriginPatch.status).toBe(403);

    // Same-origin PATCH with matching Origin -> 200
    const sameOriginPatch = await fetch(`${baseUrl}/api/settings`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookiePair,
        Origin: baseUrl,
      },
      body: JSON.stringify({ includeSpecials: true }),
    });
    expect(sameOriginPatch.status).toBe(200);
  });

  it('validates /api/tmdb/:mediaType/:id parameters', async () => {
    const setupRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'my-secret-password' }),
    });
    const { token } = (await setupRes.json()) as { token: string };

    const badMediaType = await fetch(`${baseUrl}/api/tmdb/person/123`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(badMediaType.status).toBe(400);

    const badId = await fetch(`${baseUrl}/api/tmdb/tv/123abc`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(badId.status).toBe(400);
  });
});
