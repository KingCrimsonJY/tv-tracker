import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, test, vi } from 'vitest';
import { registerProviderRoutes } from './providerRoutes.ts';
import { TrackerRepository } from './db/repository.ts';
import { makeBaseTvTitle } from '../src/domain/testFixtures.ts';
import { LinkImportError } from './providers/linkErrors.ts';

const servers: Server[] = [];
const repos: TrackerRepository[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  for (const repo of repos.splice(0)) repo.close();
});

test.each(['success', 'unavailable'])('stale link %s cannot change a re-linked title', async (outcome) => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  repos.push(repo);
  const title = makeBaseTvTitle({ source: 'url', sourceId: 'https://www.youtube.com/watch?v=abcdefghijk' });
  repo.putTitle(title.id, { title });
  let release: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const execFn = vi.fn(async () => {
    await waiting;
    if (outcome === 'unavailable') throw new LinkImportError('LINK_UNAVAILABLE', 'Deleted');
    return { stdout: JSON.stringify({ id: 'abcdefghijk', title: 'Old source', duration: 120 }), stderr: '' };
  });
  const broadcastMutation = vi.fn((mutation) => mutation);
  const app = express();
  app.use(express.json());
  registerProviderRoutes(app, {
    repo,
    broadcastMutation,
    linkDeps: { execFn, lookupFn: async () => [{ address: '93.184.216.34' }] },
  });
  const server = await new Promise<Server>((resolve) => {
    const current = app.listen(0, '127.0.0.1', () => resolve(current));
  });
  servers.push(server);
  const request = fetch(
    `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/titles/${title.id}/refresh-link`,
    { method: 'POST' },
  );
  await vi.waitFor(() => expect(execFn).toHaveBeenCalled());
  repo.patchTitle(title.id, { sourceId: 'https://www.youtube.com/watch?v=lmnopqrstuv' });
  const before = repo.getState();
  release?.();
  const response = await request;
  await response.text();
  expect(response.ok).toBe(false);
  expect(repo.getState()).toEqual(before);
  expect(broadcastMutation).not.toHaveBeenCalled();
});
