import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { makeBaseTvTitle, makeSampleSeasons } from '../src/domain/testFixtures.ts';
import { createApp } from './app.ts';
import { hashPassword } from './auth.ts';
import { TrackerRepository } from './db/repository.ts';

/** Requests a signed-in client can send that no screen sends: each must be refused and change nothing. */
const PASSWORD = 'integrity-password-123';
let repo: TrackerRepository;
let server: Server;
let base: string;
let token: string;

beforeEach(async () => {
  repo = new TrackerRepository({ dbPath: ':memory:' });
  const app = createApp({ repo, envPasswordHash: hashPassword(PASSWORD), setupCode: 'code', isProduction: false });
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  token = ((await login.json()) as { token: string }).token;
});
afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  repo.close();
});

const send = (method: string, path: string, body: unknown) =>
  fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
const create = (id: string, extra: Record<string, unknown> = {}) =>
  send('PUT', `/api/titles/${id}`, { title: makeBaseTvTitle({ id }), seasons: makeSampleSeasons(), ...extra });

async function expectRefused(response: Promise<Response>, status: number) {
  const before = repo.getState();
  expect((await response).status).toBe(status);
  expect(repo.getState()).toEqual(before);
}

test('a TMDB title keeps its episodes: they change only through a refresh', async () => {
  expect((await create('tmdb_tv_1')).status).toBe(200);
  await expectRefused(send('PUT', '/api/titles/tmdb_tv_1/seasons', makeSampleSeasons().slice(0, 1)), 409);

  // A title the user maintains still sets its episodes this way (editing the episode count).
  const custom = makeBaseTvTitle({ id: 'custom_1', source: 'custom', sourceId: null });
  expect((await send('PUT', '/api/titles/custom_1', { title: custom })).status).toBe(200);
  expect((await send('PUT', '/api/titles/custom_1/seasons', makeSampleSeasons().slice(1))).status).toBe(200);
});

test('playthrough ids are unique, on creation and in a playthrough change', async () => {
  const twice = [
    { id: 'p1', number: 1, startedAt: 1000 },
    { id: 'p1', number: 2, startedAt: 2000 },
  ];
  await expectRefused(
    send('PUT', '/api/titles/tmdb_tv_2', { title: makeBaseTvTitle({ id: 'tmdb_tv_2', playthroughs: twice }) }),
    400,
  );
  expect((await create('tmdb_tv_1')).status).toBe(200);
  await expectRefused(
    send('POST', '/api/titles/tmdb_tv_1/actions', {
      expectedActivePlaythroughId: 'p1',
      title: { playthroughs: twice },
    }),
    400,
  );
});

test('a new title brings only progress that belongs to it', async () => {
  const watched = (playthroughId: string, key: string) => ({
    [playthroughId]: { playthroughId, watched: { [key]: 1234 } },
  });
  await expectRefused(create('tmdb_tv_3', { progress: watched('ghost', 's1e1') }), 400);
  await expectRefused(create('tmdb_tv_3', { progress: watched('p1', 's99e99') }), 400);
  // The single-document form of older clients is read the same way.
  await expectRefused(create('tmdb_tv_3', { progress: { playthroughId: 'ghost', watched: {} } }), 400);

  expect((await create('tmdb_tv_3', { progress: watched('p1', 's1e1') })).status).toBe(200);
  expect(repo.getState().progressByTitle.tmdb_tv_3.p1.watched).toEqual({ s1e1: 1234 });
});

test('a list entry written again stays the entry of the same title in the same list', async () => {
  for (const id of ['tmdb_tv_1', 'tmdb_tv_2']) expect((await create(id)).status).toBe(200);
  const list = { kind: 'collection', pinned: false, collectionSort: 'manual', createdAt: 1 };
  expect((await send('PUT', '/api/lists/a', { ...list, name: 'A', rank: 'a0' })).status).toBe(200);
  expect((await send('PUT', '/api/lists/b', { ...list, name: 'B', rank: 'a1' })).status).toBe(200);
  const entry = { titleId: 'tmdb_tv_1', rank: 'a0', addedAt: 1 };
  expect((await send('PUT', '/api/lists/a/entries/e', entry)).status).toBe(200);

  await expectRefused(send('PUT', '/api/lists/a/entries/e', { ...entry, titleId: 'tmdb_tv_2' }), 409);
  await expectRefused(send('PUT', '/api/lists/b/entries/e', entry), 409);
  expect((await send('PUT', '/api/lists/a/entries/e', { ...entry, rank: 'a5', note: 'moved' })).status).toBe(200);
  expect(repo.getState().entriesByList.a).toMatchObject([{ id: 'e', titleId: 'tmdb_tv_1', rank: 'a5' }]);
});

test('a link stored directly is judged by the page behind its language prefix', async () => {
  for (const sourceId of [
    'https://m.bilibili.com/zh-Hant/medialist/play/946974?business=space',
    'https://m.bilibili.com/zh-Hans/medialist/play/946974?business=space_channel&business_id=2443008',
  ]) {
    const title = makeBaseTvTitle({ id: 'url_1', source: 'url', sourceId, mediaType: 'other' });
    const response = send('PUT', '/api/titles/url_1', { title });
    await expectRefused(response, 400);
  }
});

test('a backup that uses one entry id twice is invalid input, not a server error', async () => {
  expect((await create('tmdb_tv_1')).status).toBe(200);
  const backup = repo.exportData();
  const list = { name: 'L', kind: 'collection', pinned: false, rank: 'a0', collectionSort: 'manual', createdAt: 1 };
  const entry = { id: 'shared', titleId: 'tmdb_tv_1', rank: 'a0', addedAt: 1 };
  await expectRefused(
    send('POST', '/api/import', {
      ...backup,
      lists: { a: { ...list, id: 'a' }, b: { ...list, id: 'b', rank: 'a1' } },
      entriesByList: { a: [entry], b: [entry] },
    }),
    400,
  );
});
