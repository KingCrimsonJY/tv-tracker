import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { SESSION_TTL_MS } from './auth.ts';
import { TrackerRepository } from './db/repository.ts';

const TEST_SETUP_CODE = 'test-setup-code-123';
const VALID_PASSWORD = 'my-secret-password-10chars';

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
      setupCode: TEST_SETUP_CODE,
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

  it('rejects first-run setup without the correct setup code and rejects passwords under 10 characters', async () => {
    // 1. Missing setup code -> 400
    const missingCodeRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: VALID_PASSWORD }),
    });
    expect(missingCodeRes.status).toBe(400);

    // 2. Wrong setup code -> 403
    const wrongCodeRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: VALID_PASSWORD, setupCode: 'wrong-code' }),
    });
    expect(wrongCodeRes.status).toBe(403);

    // 3. Password under 10 characters -> 400
    const shortPassRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'short1234', setupCode: TEST_SETUP_CODE }),
    });
    expect(shortPassRes.status).toBe(400);

    // Verify setup is still needed
    const statusStillNeedsSetup = await (await fetch(`${baseUrl}/api/auth/status`)).json();
    expect(statusStillNeedsSetup).toEqual({ needsSetup: true, authenticated: false });
  });

  it('allows first-run password setup once with valid setupCode + password and rejects any second setup attempt', async () => {
    const statusBefore = await (await fetch(`${baseUrl}/api/auth/status`)).json();
    expect(statusBefore).toEqual({ needsSetup: true, authenticated: false });

    const setupRes1 = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: VALID_PASSWORD, setupCode: TEST_SETUP_CODE }),
    });
    expect(setupRes1.status).toBe(200);
    const body1 = (await setupRes1.json()) as { ok: boolean; token: string };
    expect(body1.ok).toBe(true);
    expect(typeof body1.token).toBe('string');

    // Second setup attempt must fail with 403
    const setupRes2 = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'another-valid-password', setupCode: TEST_SETUP_CODE }),
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
      body: JSON.stringify({ password: VALID_PASSWORD, setupCode: TEST_SETUP_CODE }),
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
      body: JSON.stringify({ password: VALID_PASSWORD, setupCode: TEST_SETUP_CODE }),
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
      body: JSON.stringify({ password: VALID_PASSWORD }),
    });
    expect(blockedRes.status).toBe(429);

    // Different IP is not blocked
    const otherIpRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.99',
      },
      body: JSON.stringify({ password: VALID_PASSWORD }),
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
      body: JSON.stringify({ password: VALID_PASSWORD }),
    });
    expect(unblockedRes.status).toBe(200);
  });

  it('enforces global login limit: 20 failed logins in an hour across different IPs blocks all logins for 15 minutes', async () => {
    await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: VALID_PASSWORD, setupCode: TEST_SETUP_CODE }),
    });

    // 20 failed logins each from a distinct spoofed IP
    for (let i = 1; i <= 20; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': `198.51.100.${i}`,
        },
        body: JSON.stringify({ password: 'wrong-password' }),
      });
      expect(res.status).toBe(401);
    }

    // 21st login from a brand-new IP with the correct password is blocked with 429
    const blockedGlobalRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '198.51.100.250',
      },
      body: JSON.stringify({ password: VALID_PASSWORD }),
    });
    expect(blockedGlobalRes.status).toBe(429);

    // Advance 15 minutes + 1s -> global block expires
    currentNow += 15 * 60 * 1000 + 1000;
    const allowedAfterCooldown = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '198.51.100.250',
      },
      body: JSON.stringify({ password: VALID_PASSWORD }),
    });
    expect(allowedAfterCooldown.status).toBe(200);
  });

  it('closes active SSE streams when logout-all (退出所有设备) is called', async () => {
    const setupRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: VALID_PASSWORD, setupCode: TEST_SETUP_CODE }),
    });
    const { token } = (await setupRes.json()) as { token: string };

    // Open an SSE stream
    const sseRes = await fetch(`${baseUrl}/api/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(sseRes.status).toBe(200);
    expect(sseRes.body).not.toBeNull();

    const reader = sseRes.body!.getReader();
    const firstChunk = await reader.read();
    expect(firstChunk.done).toBe(false);
    expect(new TextDecoder().decode(firstChunk.value)).toContain(': connected');

    // Trigger logout-all
    const logoutAllRes = await fetch(`${baseUrl}/api/auth/logout-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logoutAllRes.status).toBe(200);

    // The SSE stream should now close (reader.read() resolves with done: true)
    const nextChunk = await reader.read();
    expect(nextChunk.done).toBe(true);
  });

  it('rejects a cookie-authenticated POST/PATCH from another Origin with 403', async () => {
    const setupRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: VALID_PASSWORD, setupCode: TEST_SETUP_CODE }),
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

  it('returns 404 JSON for unknown /api routes', async () => {
    const setupRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: VALID_PASSWORD, setupCode: TEST_SETUP_CODE }),
    });
    const { token } = (await setupRes.json()) as { token: string };

    const unknownRes = await fetch(`${baseUrl}/api/non-existent-route`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(unknownRes.status).toBe(404);
    expect(unknownRes.headers.get('content-type')).toContain('application/json');
    const body = (await unknownRes.json()) as { error?: string };
    expect(typeof body.error).toBe('string');
  });

  it('validates /api/tmdb/:mediaType/:id parameters', async () => {
    const setupRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: VALID_PASSWORD, setupCode: TEST_SETUP_CODE }),
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
