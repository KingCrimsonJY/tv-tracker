import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, test, vi } from 'vitest';
import { en } from '../../i18n/messages/en';
import { toLocalDateString } from '../../domain/airing';
import { makeBaseTvTitle, makeSampleSeasons, TODAY } from '../../domain/testFixtures';
import { resolveSeasonSelection } from './seasonSelection';
import { selectPrimaryEpisode } from './primaryEpisode';
import { EpisodeRow } from './EpisodeRow';
import { SeasonPanel } from './SeasonPanel';
import { createScrollPositions } from '../../components/scrollPositions';

vi.mock('../../i18n', () => ({ useI18n: () => ({ t: en, locale: 'en', formatDate: (date: string) => date }) }));
afterEach(() => vi.unstubAllEnvs());

test('episode deep links select once, allow manual changes, and wait for loaded seasons', () => {
  const initial = { seasonNumber: 1, appliedLink: null };
  const waiting = resolveSeasonSelection(initial, [], 's3e1');
  expect(waiting).toBe(initial);
  const linked = resolveSeasonSelection(waiting, [1, 2, 3], 's3e1');
  expect(linked.seasonNumber).toBe(3);
  const selected = { ...linked, seasonNumber: 2 };
  expect(resolveSeasonSelection(selected, [1, 2, 3], 's3e1')).toBe(selected);
  expect(resolveSeasonSelection(selected, [1, 2, 3], 's1e1').seasonNumber).toBe(1);
  expect(resolveSeasonSelection(selected, [1], 's3e1').seasonNumber).toBe(1);
});

test('watched episodes can be unchecked even when their updated air date is in the future', () => {
  const episode = makeSampleSeasons()[2].episodes[2];
  const render = (isWatched: boolean) => renderToStaticMarkup(<EpisodeRow
    episode={episode} seasonNumber={2} isWatched={isWatched} aired={false}
    resumeSeconds={null} isHighlighted={false} onToggle={() => {}}
    onMarkUpToHere={() => {}} onRecordTime={() => {}}
  />);
  expect(render(false)).toMatch(/<input[^>]*disabled=""/);
  expect(render(true)).not.toMatch(/<input[^>]*disabled=""/);
});

test('ended shows use the same inferred aired rule for rows and primary actions', () => {
  const title = makeBaseTvTitle({ showStatus: 'Ended' });
  const season = { ...makeSampleSeasons()[1], episodes: [{ ...makeSampleSeasons()[1].episodes[0], airDate: null }] };
  const markup = renderToStaticMarkup(<SeasonPanel title={title} seasons={[season]}
    today={TODAY} highlightEpKey={null} onToggleEpisode={() => {}} onMarkSeason={() => {}}
    onMarkUpTo={() => {}} onOpenResumeForEpisode={() => {}} />);
  expect(markup).not.toMatch(/<input[^>]*disabled=""/);
  expect(markup).toContain('0/1 watched');
  expect(selectPrimaryEpisode(title, [season], undefined, 's1e1', TODAY)).toBe('s1e1');
});

test('a stale resume cannot make the primary action mark an unaired or already watched episode', () => {
  const title = makeBaseTvTitle({ resume: { episodeKey: 's2e3', seconds: 60, updatedAt: 1 } });
  const seasons = makeSampleSeasons();
  expect(selectPrimaryEpisode(title, seasons, undefined, 's1e1', TODAY)).toBe('s1e1');
  title.resume = { episodeKey: 's1e2', seconds: 60, updatedAt: 1 };
  expect(selectPrimaryEpisode(title, seasons, { playthroughId: 'p1', watched: { s1e2: 1 } }, 's1e1', TODAY)).toBe('s1e1');
  expect(selectPrimaryEpisode(title, seasons, undefined, 's1e1', TODAY)).toBe('s1e2');
});

test.each([['Asia/Tokyo', '2026-11-02'], ['America/Los_Angeles', '2026-11-01']])(
  'today follows the local calendar in %s', (zone, expected) => {
    vi.stubEnv('TZ', zone);
    expect(toLocalDateString(new Date('2026-11-02T00:30:00Z'))).toBe(expected);
  },
);

test('new navigation starts at the top and Back restores each history entry independently', () => {
  const positions = createScrollPositions();
  positions.remember('library-first', { x: 0, y: 620 });
  expect(positions.target('title', 'PUSH')).toEqual({ x: 0, y: 0 });
  positions.remember('title', { x: 0, y: 240 });
  expect(positions.target('library-first', 'POP')).toEqual({ x: 0, y: 620 });
  expect(positions.target('library-second', 'PUSH')).toEqual({ x: 0, y: 0 });
  expect(positions.target('title', 'POP')).toEqual({ x: 0, y: 240 });
});
