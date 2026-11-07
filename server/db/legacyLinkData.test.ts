import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from 'vitest';
import { TrackerRepository } from './repository.ts';
import { makeBaseTvTitle, makeSampleSeasons } from '../../src/domain/testFixtures.ts';

test('migration removes retired live status and placeholder dates without deleting titles or watched marks', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'link-migration-'));
  const migrations = path.join(root, 'migrations'); fs.mkdirSync(migrations);
  const current = path.resolve(import.meta.dirname, 'migrations');
  for (const name of fs.readdirSync(current).filter(name => Number(name.slice(0, 3)) <= 5)) fs.copyFileSync(path.join(current, name), path.join(migrations, name));
  const dataDir = path.join(root, 'data');
  const old = new TrackerRepository({ dataDir, migrationsDir: migrations });
  const seasons = makeSampleSeasons(); seasons[0].episodes[0].airDate = '2020-01-01';
  const title = { ...makeBaseTvTitle({ source: 'url' }), liveStatus: 'live' };
  old.putTitle(title.id, { title, seasons, progress: { p1: { playthroughId: 'p1', watched: { s0e1: 99 } } } }); old.close();
  const upgraded = new TrackerRepository({ dataDir });
  try {
    expect(upgraded.getTitle(title.id)).not.toHaveProperty('liveStatus');
    expect(upgraded.getState().seasonsByTitle[title.id][0].episodes[0].airDate).toBeNull();
    expect(upgraded.getState().progressByTitle[title.id].p1.watched).toEqual({ s0e1: 99 });
  } finally { upgraded.close(); fs.rmSync(root, { recursive: true }); }
});

test.each([1, 2])('v%s import clears custom/link placeholders but preserves real TMDB dates', version => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  try {
    const seasons = makeSampleSeasons(); seasons[0].episodes[0].airDate = '2020-01-01';
    for (const source of ['custom', 'url', 'tmdb'] as const) {
      const title = makeBaseTvTitle({ id: source, source }); repo.putTitle(source, { title, seasons });
    }
    const payload = repo.exportData(); repo.importData({ ...payload, version });
    expect(repo.getState().seasonsByTitle.custom[0].episodes[0].airDate).toBeNull();
    expect(repo.getState().seasonsByTitle.url[0].episodes[0].airDate).toBeNull();
    expect(repo.getState().seasonsByTitle.tmdb[0].episodes[0].airDate).toBe('2020-01-01');
  } finally { repo.close(); }
});
