import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { gzipSync } from 'node:zlib';
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
      epoch: 'test-epoch-initial',
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
    const missingCodeRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: VALID_PASSWORD }),
    });
    expect(missingCodeRes.status).toBe(400);

    const wrongCodeRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: VALID_PASSWORD, setupCode: 'wrong-code' }),
    });
    expect(wrongCodeRes.status).toBe(403);

    const shortPassRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'short1234', setupCode: TEST_SETUP_CODE }),
    });
    expect(shortPassRes.status).toBe(400);

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

    const okRes = await fetch(`${baseUrl}/api/state`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(okRes.status).toBe(200);

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

    for (let i = 0; i < 5; i++) {
      const failRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.50' },
        body: JSON.stringify({ password: 'wrong-password' }),
      });
      expect(failRes.status).toBe(401);
    }

    const blockedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.50' },
      body: JSON.stringify({ password: VALID_PASSWORD }),
    });
    expect(blockedRes.status).toBe(429);

    const otherIpRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.99' },
      body: JSON.stringify({ password: VALID_PASSWORD }),
    });
    expect(otherIpRes.status).toBe(200);

    currentNow += 15 * 60 * 1000 + 1000;
    const unblockedRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.50' },
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

    for (let i = 1; i <= 20; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `198.51.100.${i}` },
        body: JSON.stringify({ password: 'wrong-password' }),
      });
      expect(res.status).toBe(401);
    }

    const blockedGlobalRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.250' },
      body: JSON.stringify({ password: VALID_PASSWORD }),
    });
    expect(blockedGlobalRes.status).toBe(429);

    currentNow += 15 * 60 * 1000 + 1000;
    const allowedAfterCooldown = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.250' },
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

    const sseRes = await fetch(`${baseUrl}/api/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(sseRes.status).toBe(200);
    if (!sseRes.body) throw new Error('Missing SSE body');

    const reader = sseRes.body.getReader();
    const firstChunk = await reader.read();
    expect(firstChunk.done).toBe(false);
    expect(new TextDecoder().decode(firstChunk.value)).toContain('"version":0');

    const logoutAllRes = await fetch(`${baseUrl}/api/auth/logout-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logoutAllRes.status).toBe(200);

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

    const crossOriginPost = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookiePair, Origin: 'https://malicious.example.com' },
    });
    expect(crossOriginPost.status).toBe(403);

    const missingOriginPatch = await fetch(`${baseUrl}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookiePair },
      body: JSON.stringify({ includeSpecials: true }),
    });
    expect(missingOriginPatch.status).toBe(403);

    const sameOriginPatch = await fetch(`${baseUrl}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookiePair, Origin: baseUrl },
      body: JSON.stringify({ includeSpecials: true }),
    });
    expect(sameOriginPatch.status).toBe(200);
  });

  it('POST /api/titles/:id/actions applies progress + title in one transaction and rolls back completely when one part is invalid', async () => {
    const setupRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: VALID_PASSWORD, setupCode: TEST_SETUP_CODE }),
    });
    const { token } = (await setupRes.json()) as { token: string };
    const authHeader = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const putRes = await fetch(`${baseUrl}/api/titles/tmdb_tv_100`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({
        title: {
          id: 'tmdb_tv_100',
          source: 'tmdb',
          sourceId: '100',
          mediaType: 'tv',
          names: { original: 'Severance', zh: '人生切割术' },
          displayLang: null,
          year: 2022,
          runtimeMin: 50,
          genres: [],
          posterPath: null,
          backdropPath: null,
          overview: {},
          showStatus: 'Returning Series',
          externalIds: {},
          ratings: {},
          manualState: 'paused',
          playthroughs: [{ id: 'p1', number: 1, startedAt: 1000 }],
          activePlaythroughId: 'p1',
          resume: null,
          metaFetchedAt: 1000,
          addedAt: 1000,
          updatedAt: 1000,
          lastActivityAt: 1000,
        },
        seasons: [],
        progress: { p1: { playthroughId: 'p1', watched: {} } },
      }),
    });
    expect(putRes.status).toBe(200);

    const okActionRes = await fetch(`${baseUrl}/api/titles/tmdb_tv_100/actions`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        progress: { playthroughId: 'p1', set: { s1e1: 5000 } },
        title: { manualState: null, lastActivityAt: 5000 },
      }),
    });
    expect(okActionRes.status).toBe(200);
    const okMutation = (await okActionRes.json()) as { epoch: string; version: number };
    expect(okMutation.epoch).toBe('test-epoch-initial');
    expect(okMutation.version).toBe(2);

    // Atomic action where progress is valid (setting s1e2) but title has an invalid activePlaythroughId
    const badActionRes = await fetch(`${baseUrl}/api/titles/tmdb_tv_100/actions`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        progress: { playthroughId: 'p1', set: { s1e2: 6000 } },
        title: { activePlaythroughId: 'non_existent_playthrough' },
      }),
    });
    expect(badActionRes.status).toBe(409);

    const stateAfterFailed = repo.getState();
    expect(stateAfterFailed.version).toBe(2);
    expect(stateAfterFailed.progressByTitle['tmdb_tv_100'].p1.watched).toEqual({ s1e1: 5000 });
    expect(stateAfterFailed.titles['tmdb_tv_100'].activePlaythroughId).toBe('p1');
  });

  it('returns 404 JSON for unknown /api routes and validates /api/tmdb/:mediaType/:id', async () => {
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

    const badMediaType = await fetch(`${baseUrl}/api/tmdb/person/123`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(badMediaType.status).toBe(400);

    const badId = await fetch(`${baseUrl}/api/tmdb/tv/123abc`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(badId.status).toBe(400);
  });

  it('does not leak internal error messages in 500 responses', async () => {
    const setupRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: VALID_PASSWORD, setupCode: TEST_SETUP_CODE }),
    });
    const cookiePair = (setupRes.headers.get('set-cookie') || '').split(';')[0];
    repo.getState = () => {
      throw new Error('SQLITE_CORRUPT at /srv/private/tracker.db');
    };
    const res = await fetch(`${baseUrl}/api/state`, { headers: { Cookie: cookiePair } });
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).toContain('INTERNAL_ERROR');
    expect(body).not.toContain('/srv/private');
  });

  it('answers malformed JSON with 400 and never logs the request body', async () => {
    const logged: unknown[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      logged.push(...args);
    };
    try {
      for (const path of ['/api/auth/login', '/api/auth/setup', '/api/import']) {
        const res = await fetch(`${baseUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: baseUrl },
          body: '{"password":"secret-marker-123",',
        });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ code: 'VALIDATION_ERROR' });
      }
    } finally {
      console.error = originalError;
    }
    expect(JSON.stringify(logged.map(String))).not.toContain('secret-marker-123');
  });

  it('answers corrupt or truncated gzip bodies with 400', async () => {
    const valid = gzipSync(JSON.stringify({ password: 'secret-marker-456' }));
    for (const body of [Buffer.from('not gzip at all'), valid.subarray(0, valid.length - 8)]) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip', Origin: baseUrl },
        body,
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ code: 'VALIDATION_ERROR' });
    }
  });
});
