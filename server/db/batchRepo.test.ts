import type { AddressInfo } from 'node:net';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createApp } from '../app.ts';
import { generateSessionToken, SESSION_TTL_MS } from '../auth.ts';
import { makeBaseTvTitle, makeSampleSeasons, TODAY } from '../../src/domain/testFixtures.ts';
import type { StateMutationResult, TitleDoc } from '../../src/domain/types.ts';
import { TrackerRepository } from './repository.ts';

const NOW = 1_800_000_000_000;
const status = (value: 'watched' | 'unwatched' | 'paused' | 'dropped' | 'active') =>
  ({ type: 'status', status: value, todayStr: TODAY, now: NOW }) as const;

let repo: TrackerRepository;
const addTitle = (overrides: Partial<TitleDoc>, withSeasons = true) => {
  const title = makeBaseTvTitle(overrides);
  repo.putTitle(title.id, { title, seasons: withSeasons ? makeSampleSeasons() : [] });
  return title.id;
};
const addList = (id: string) =>
  repo.putList(id, { name: id, kind: 'collection', pinned: false, rank: 'a0', collectionSort: 'added', createdAt: 1 });

beforeEach(() => {
  repo = new TrackerRepository({ dbPath: ':memory:' });
});
afterEach(() => repo.close());

describe('library batch: status', () => {
  test('marks every selected title watched in one version, skipping unreleased and missing titles', () => {
    const show = addTitle({ id: 'show', showStatus: 'Ended' });
    const movie = addTitle({ id: 'movie', mediaType: 'movie', releaseDate: '2020-01-01' }, false);
    const upcoming = addTitle({ id: 'upcoming', mediaType: 'movie', releaseDate: '2999-01-01' }, false);
    const before = repo.getVersion();

    const mutation = repo.applyTitleBatch([show, movie, upcoming, 'deleted-elsewhere', show], status('watched'));

    expect(mutation.version).toBe(before + 1);
    expect(Object.keys(mutation.upserts.titles ?? {}).sort()).toEqual(['movie', 'show']);
    expect(mutation.upserts.progressByTitle?.movie.p1.movieWatchedAt).toBe(NOW);
    const watched = repo.getState().progressByTitle.show.p1.watched;
    expect(Object.keys(watched).length).toBeGreaterThan(0);
    expect(Object.values(watched).every((at) => at === NOW)).toBe(true);
    expect(repo.getTitle(show)).toMatchObject({ updatedAt: NOW, lastActivityAt: NOW });
    expect(repo.getTitle(show)?.playthroughs[0].completedAt).toBe(NOW);
    expect(repo.getTitle(upcoming)?.updatedAt).not.toBe(NOW);
    expect(repo.getState().progressByTitle.upcoming?.p1?.movieWatchedAt).toBeUndefined();
  });

  test('pausing, dropping and resuming change only titles that are not already there', () => {
    const a = addTitle({ id: 'a' });
    const b = addTitle({ id: 'b', manualState: 'paused' });

    const paused = repo.applyTitleBatch([a, b], status('paused'));
    expect(Object.keys(paused.upserts.titles ?? {})).toEqual(['a']);
    expect(paused.upserts.progressByTitle).toBeUndefined();

    const version = repo.getVersion();
    const again = repo.applyTitleBatch([a, b], status('paused'));
    expect(again).toEqual({ version, upserts: {}, deletes: {} });
    expect(repo.getVersion()).toBe(version);

    repo.applyTitleBatch([a], status('dropped'));
    expect(repo.getTitle(a)?.manualState).toBe('dropped');
    repo.applyTitleBatch([a, b], status('active'));
    expect([repo.getTitle(a)?.manualState, repo.getTitle(b)?.manualState]).toEqual([null, null]);
  });

  test('marking unwatched clears the active viewing and reopens it', () => {
    const show = addTitle({ id: 'show', showStatus: 'Ended' });
    repo.applyTitleBatch([show], status('watched'));
    repo.applyTitleBatch([show], status('unwatched'));
    expect(repo.getState().progressByTitle.show.p1.watched).toEqual({});
    expect(repo.getTitle(show)?.playthroughs[0].completedAt).toBeUndefined();
  });

  test('a failure on any title leaves every title and the version untouched', () => {
    const first = addTitle({ id: 'first', showStatus: 'Ended' });
    const broken = addTitle({ id: 'broken', showStatus: 'Ended' });
    const db = (repo as unknown as { db: DatabaseSync }).db;
    db.prepare("UPDATE seasons SET data = 'not json' WHERE title_id = ?").run(broken);
    const version = repo.getVersion();

    expect(() => repo.applyTitleBatch([first, broken], status('watched'))).toThrow();

    expect(repo.getVersion()).toBe(version);
    const stored = db.prepare('SELECT data FROM progress WHERE title_id = ?').get(first) as
      { data: string } | undefined;
    expect(stored ? (JSON.parse(stored.data) as { watched: object }).watched : {}).toEqual({});
    expect(repo.getTitle(first)?.updatedAt).not.toBe(NOW);
  });
});

describe('library batch: lists and deletion', () => {
  test('appends titles to a list in selection order and never adds one twice', () => {
    const ids = ['c', 'a', 'b'].map((id) => addTitle({ id }));
    addList('list');
    repo.putListEntry('list', 'existing', { titleId: 'a', rank: 'a5', addedAt: 1 });
    const before = repo.getVersion();

    const mutation = repo.applyTitleBatch([...ids, 'missing'], { type: 'addToList', listId: 'list', now: NOW });

    expect(mutation.version).toBe(before + 1);
    const entries = mutation.upserts.entriesByList?.list ?? [];
    expect(entries.map((entry) => entry.titleId)).toEqual(['a', 'c', 'b']);
    expect(entries.map((entry) => entry.rank)).toEqual([...entries.map((entry) => entry.rank)].sort());
    expect(entries.slice(1).every((entry) => entry.addedAt === NOW)).toBe(true);
    expect(repo.getState().entriesByList.list).toEqual(entries);

    const again = repo.applyTitleBatch(ids, { type: 'addToList', listId: 'list', now: NOW });
    expect(again).toEqual({ version: before + 1, upserts: {}, deletes: {} });
  });

  test('adding to a list that no longer exists fails without writing', () => {
    const id = addTitle({ id: 'a' });
    const version = repo.getVersion();
    expect(() => repo.applyTitleBatch([id], { type: 'addToList', listId: 'gone', now: NOW })).toThrowError(
      expect.objectContaining({ code: 'LIST_NOT_FOUND' }),
    );
    expect(repo.getVersion()).toBe(version);
  });

  test('deletes titles with their seasons, progress and list entries in one version', () => {
    const ids = ['a', 'b', 'c'].map((id) => addTitle({ id }));
    addList('list');
    repo.applyTitleBatch(ids, { type: 'addToList', listId: 'list', now: NOW });
    const before = repo.getVersion();

    const mutation = repo.applyTitleBatch(['a', 'b', 'missing'], { type: 'delete' });

    expect(mutation.version).toBe(before + 1);
    expect(mutation.deletes.titles).toEqual(['a', 'b']);
    expect(mutation.deletes.entries).toHaveLength(2);
    const state = repo.getState();
    expect(Object.keys(state.titles)).toEqual(['c']);
    expect(Object.keys(state.seasonsByTitle)).toEqual(['c']);
    expect(state.entriesByList.list.map((entry) => entry.titleId)).toEqual(['c']);
  });
});

describe('POST /api/titles/batch', () => {
  test('validates the request, answers with one mutation and broadcasts it once', async () => {
    const ids = Array.from({ length: 40 }, (_, index) => addTitle({ id: 'title-' + index }));
    const { token, tokenHash } = generateSessionToken();
    repo.createSession(tokenHash, Date.now(), Date.now() + SESSION_TTL_MS);
    const app = createApp({ repo, envPasswordHash: '', setupCode: 'x', isProduction: false, epoch: 'e' });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    const post = (body: unknown) =>
      fetch(base + '/api/titles/batch', { method: 'POST', headers, body: JSON.stringify(body) });
    const events: StateMutationResult[] = [];
    const stream = new AbortController();
    try {
      const sse = await fetch(base + '/api/events', { headers, signal: stream.signal });
      const reader = sse.body?.getReader();
      void (async () => {
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const chunk = await reader?.read().catch(() => undefined);
          if (!chunk || chunk.done) return;
          buffer += decoder.decode(chunk.value, { stream: true });
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() ?? '';
          for (const block of blocks) {
            if (block.startsWith('data:')) events.push(JSON.parse(block.slice(5)) as StateMutationResult);
          }
        }
      })();

      for (const invalid of [
        { titleIds: [], action: { type: 'delete' } },
        { titleIds: Array.from({ length: 1001 }, (_, index) => 'x' + index), action: { type: 'delete' } },
        { titleIds: ['a'], action: { type: 'status', status: 'finished', todayStr: TODAY, now: NOW } },
        { titleIds: ['a'], action: { type: 'status', status: 'watched', todayStr: 'today', now: NOW } },
        { titleIds: ['a'], action: { type: 'delete' }, extra: true },
      ]) {
        expect((await post(invalid)).status).toBe(400);
      }

      const before = repo.getVersion();
      const response = await post({ titleIds: ids, action: status('paused') });
      const mutation = (await response.json()) as StateMutationResult;
      expect(response.status).toBe(200);
      expect(mutation).toMatchObject({ version: before + 1, epoch: 'e' });
      expect(Object.keys(mutation.upserts.titles ?? {})).toHaveLength(40);

      // Repeating it changes nothing, so nothing is broadcast.
      expect(
        ((await (await post({ titleIds: ids, action: status('paused') })).json()) as StateMutationResult).upserts,
      ).toEqual({});
      expect((await post({ titleIds: ids, action: { type: 'addToList', listId: 'gone', now: NOW } })).status).toBe(404);

      await new Promise((resolve) => setTimeout(resolve, 50));
      const broadcasts = events.filter((event) => !event.checkpoint);
      expect(broadcasts).toHaveLength(1);
      expect(broadcasts[0].version).toBe(before + 1);
      expect(Object.keys(broadcasts[0].upserts.titles ?? {})).toHaveLength(40);
    } finally {
      stream.abort();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      const stop: unknown = app.locals.stopBackgroundTasks;
      if (typeof stop === 'function') stop();
    }
  });
});
