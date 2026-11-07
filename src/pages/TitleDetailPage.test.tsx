import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { expect, test, vi } from 'vitest';
import { makeBaseTvTitle, makeSampleSeasons, TODAY } from '../domain/testFixtures';
import { computeTitleState } from '../domain/progress';
import { en } from '../i18n/messages/en';
import { SeasonPanel } from '../features/title/SeasonPanel';
import { UpstreamPanel } from '../features/title/UpstreamPanel';
import { TitleDetailPage } from './TitleDetailPage';

let currentTitle = makeBaseTvTitle();
const seasons = makeSampleSeasons();

vi.mock('../i18n', () => ({ useI18n: () => ({ t: en, locale: 'en' }) }));
vi.mock('../features/title/useTitleDetail', () => ({
  useTitleDetail: () => ({
    title: currentTitle,
    titleState: computeTitleState(currentTitle, seasons, undefined, { todayStr: TODAY }),
    seasons,
    regularSeasons: seasons.slice(1),
    specialSeason: seasons[0],
    overviewText: '',
  }),
}));

type ElementWithChildren = ReactElement<{ children?: ReactNode }>;

function inspectSiblings(node: ReactNode, elements: ElementWithChildren[] = []) {
  const keys = new Set<string>();
  Children.forEach(node, (child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return;
    if (child.key !== null) {
      expect(keys.has(child.key), `duplicate sibling key: ${child.key}`).toBe(false);
      keys.add(child.key);
    }
    elements.push(child);
    inspectSiblings(child.props.children, elements);
  });
  return elements;
}

test.each([
  { id: 'tmdb_tv_95396', source: 'tmdb', mediaType: 'tv' },
  { id: 'url_test_playlist', source: 'url', mediaType: 'other' },
] as const)('detail panels have distinct identities for $source titles', async (overrides) => {
  currentTitle = makeBaseTvTitle(overrides);
  const elements = inspectSiblings(await TitleDetailPage({}));
  const panels = elements.filter((element) => element.type === SeasonPanel || element.type === UpstreamPanel);
  expect(panels).toHaveLength(2);
  expect(panels.every((panel) => panel.key !== null)).toBe(true);
});

test('panel identities survive metadata updates and reset when changing titles', async () => {
  const panelKeys = async () =>
    inspectSiblings(await TitleDetailPage({}))
      .filter((element) => element.type === SeasonPanel || element.type === UpstreamPanel)
      .map((element) => element.key);
  currentTitle = makeBaseTvTitle();
  const original = await panelKeys();
  currentTitle = { ...currentTitle, structureLocked: true };
  expect(await panelKeys()).toEqual(original);
  currentTitle = { ...currentTitle, id: 'tmdb_tv_2' };
  const changed = await panelKeys();
  expect(changed).toHaveLength(original.length);
  changed.forEach((key, index) => expect(key).not.toBe(original[index]));
});
