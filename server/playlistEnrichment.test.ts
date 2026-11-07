import { afterEach, expect, test, vi } from 'vitest';
import { createPlaylistEnricher } from './playlistEnrichment.ts';
import { TrackerRepository } from './db/repository.ts';
import { makeBaseTvTitle } from '../src/domain/testFixtures.ts';
import type { LinkImportResult } from '../src/domain/types.ts';
import { createTrackerStore } from '../src/data/store.ts';
import { LinkImportError } from './providers/linkErrors.ts';
const repos: TrackerRepository[] = [];
afterEach(() => { for (const repo of repos.splice(0)) repo.close(); });
const detail: LinkImportResult = { kind: 'video', title: 'Filled title', posterUrl: null, overview: '', sourceUrl: 'https://youtube.com/watch?v=abcdefghijk', year: 2024, runtimeMin: 5, episodes: [], fallbackUsed: 'yt-dlp' };
function setup() {
  const repo = new TrackerRepository({ dbPath: ':memory:' }); repos.push(repo);
  const title = makeBaseTvTitle({ source: 'url', sourceId: 'https://www.youtube.com/playlist?list=PLabc' });
  repo.putTitle(title.id, { title, seasons: [{ seasonNumber: 1, name: null, episodes: ['abcdefghijk', 'lmnopqrstuv'].map((id, i) => ({ key: `s1e${i + 1}`, number: i + 1, name: null, runtime: null, airDate: null, stillPath: null, overview: {}, sourceVideoId: id })) }] });
  return { repo, title };
}

test('background metadata appears on every device without delaying title creation', async () => {
  const { repo, title } = setup();
  const devices = [createTrackerStore(repo.getState()), createTrackerStore(repo.getState())];
  let release: ((value: LinkImportResult) => void) | undefined;
  const loadVideo = vi.fn().mockImplementationOnce(() => new Promise<LinkImportResult>(resolve => { release = resolve; })).mockResolvedValue(detail);
  const queue = createPlaylistEnricher({ repo, loadVideo, broadcast: mutation => devices.forEach(device => device.applyMutation(mutation)) });
  queue.schedule(title.id);
  await vi.waitFor(() => expect(loadVideo).toHaveBeenCalledTimes(1));
  expect(repo.getTitle(title.id)).toBeTruthy();
  expect(devices[0].getState().seasonsByTitle[title.id][0].episodes[0].name).toBeNull();
  release?.(detail); await queue.idle(); queue.stop();
  for (const device of devices) {
    expect(device.getState().seasonsByTitle[title.id][0].episodes[0]).toMatchObject({ name: { en: 'Filled title' }, runtime: 5 });
    expect(device.getState()).toEqual(repo.getState());
  }
});

test.each(['delete', 'manual'])('background result cannot resurrect or alter a title after %s', async operation => {
  const { repo, title } = setup();
  let release: ((value: LinkImportResult) => void) | undefined;
  const loadVideo = vi.fn(() => new Promise<LinkImportResult>(resolve => { release = resolve; }));
  const broadcast = vi.fn(); const queue = createPlaylistEnricher({ repo, loadVideo, broadcast });
  queue.schedule(title.id); await vi.waitFor(() => expect(loadVideo).toHaveBeenCalledTimes(1));
  if (operation === 'delete') repo.deleteTitle(title.id); else repo.convertToManual(title.id);
  const before = repo.getState(); release?.(detail); await queue.idle(); queue.stop();
  expect(repo.getState()).toEqual(before); expect(broadcast).not.toHaveBeenCalled();
});

test('anti-bot restrictions stop further detail requests while preserving all entries', async () => {
  const { repo, title } = setup(); const before = repo.getState();
  const loadVideo = vi.fn().mockRejectedValue(new LinkImportError('LINK_LOGIN_REQUIRED', 'blocked'));
  const queue = createPlaylistEnricher({ repo, loadVideo, broadcast: vi.fn() });
  queue.schedule(title.id); await queue.idle(); queue.stop();
  expect(loadVideo).toHaveBeenCalledTimes(1); expect(repo.getState()).toEqual(before);
});
