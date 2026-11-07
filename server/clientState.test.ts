import { expect, test } from 'vitest';
import { TrackerRepository } from './db/repository';
import { makeBaseTvTitle, makeSampleSeasons } from '../src/domain/testFixtures';
import { clientSnapshot, clientMutation } from './clientState';
test('the library and events are compact while detail reads and v2 exports retain episode metadata', () => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  try {
    const title = makeBaseTvTitle();
    const seasons = makeSampleSeasons();
    seasons[0].episodes[0].overview = { en: 'Full episode synopsis', zh: '完整剧情' };
    seasons[0].episodes[0].stillPath = '/still.jpg';
    const mutation = repo.putTitle(title.id, { title, seasons });
    const compact = clientSnapshot(repo.getState()).seasonsByTitle[title.id][0].episodes[0];
    expect(compact).toMatchObject({ name: null, overview: {}, stillPath: null });
    expect(clientMutation(mutation).upserts.seasonsByTitle?.[title.id][0].episodes[0]).toEqual(compact);
    expect(repo.getSeasons(title.id)).toEqual(seasons);
    expect(repo.exportData().seasonsByTitle[title.id]).toEqual(seasons);
    expect(() => repo.patchTitle(title.id, { upstreamChange: { signature: 'missing', fetchedAt: 1 } })).toThrow(
      'STRUCTURE_CONFLICT',
    );
    repo.patchTitle(title.id, { upstreamChange: { signature: 'example', seasons, fetchedAt: 1 } });
    repo.applyTitleAtomicAction(title.id, {
      title: { lastActivityAt: 2 },
      progress: { playthroughId: 'p1', set: { s1e1: 1 } },
    });
    expect(repo.getTitle(title.id)?.upstreamChange?.seasons).toBeUndefined();
    expect(repo.exportData().titles[title.id].upstreamChange?.seasons).toEqual(seasons);
  } finally {
    repo.close();
  }
});
