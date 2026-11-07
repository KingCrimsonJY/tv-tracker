import express from 'express';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createApp } from '../app.ts';
import { generateSessionToken, hashPassword, SESSION_TTL_MS } from '../auth.ts';
import { TrackerRepository } from '../db/repository.ts';
import { seedPerfFixture, PERF_TITLE_COUNT } from './perf-fixture.ts';
import { measureBrowser } from './perf-browser.ts';

// Always allocate an owned temporary database; never read, overwrite, or delete DATA_DIR.
const runDir = mkdtempSync(path.join(tmpdir(), 'zhenji-perf-'));
const repo = new TrackerRepository({ dataDir: runDir });
const now = Date.now();
seedPerfFixture(repo, now);
repo.setStoredPasswordHash(hashPassword('perf-only-not-a-user-password'));
const { token, tokenHash } = generateSessionToken();
repo.createSession(tokenHash, now, now + SESSION_TTL_MS);
const app = createApp({ repo, isProduction: true });
app.use('/perf-assets', express.static(path.resolve('public')));
app.use(express.static(path.resolve('dist')));
app.get('*', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('PERF_LISTEN_FAILED');
const baseUrl = `http://127.0.0.1:${address.port}`;
try {
  const response = await fetch(baseUrl + '/api/state', { headers: { Authorization: 'Bearer ' + token } });
  const state = await response.text();
  const report = {
    fixture: {
      titles: PERF_TITLE_COUNT,
      ordinaryEpisodes: 40,
      longShowEpisodes: 150,
      longPlaylistEpisodes: 564,
      movies: 12,
    },
    profile: {
      cpuSlowdown: 4,
      latencyMs: 150,
      downloadBitsPerSecond: 1_600_000,
      uploadBitsPerSecond: 750_000,
      viewport: '390x844',
      coldCache: true,
    },
    stateBytes: Buffer.byteLength(state),
    stateGzipBytes: gzipSync(state).length,
    ...(await measureBrowser(baseUrl, token)),
  };
  const output = path.resolve(process.env.PERF_OUTPUT_DIR || runDir);
  mkdirSync(output, { recursive: true });
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  console.log('Report: ' + path.join(output, 'report.json'));
} finally {
  const stop: unknown = app.locals.stopBackgroundTasks;
  if (typeof stop === 'function') stop();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  repo.close();
}
