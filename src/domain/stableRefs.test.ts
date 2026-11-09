import { expect, test } from 'vitest';
import { compareRank } from './ordering';
import { computeTitleState } from './status';
import { makeBaseTvTitle } from './testFixtures';
import { activeProgressOf, NO_SEASONS } from './stableRefs';

test('rank comparison is a consistent comparator, including ties', () => {
  expect(compareRank({ rank: 'a0' }, { rank: 'a1' })).toBe(-1);
  expect(compareRank({ rank: 'a1' }, { rank: 'a0' })).toBe(1);
  expect(compareRank({ rank: 'a0' }, { rank: 'a0' })).toBe(0);
});

test('titles without seasons or progress reuse their cached state across renders', () => {
  const title = makeBaseTvTitle({ mediaType: 'movie' });
  const first = computeTitleState(title, NO_SEASONS, activeProgressOf({}, title));
  expect(computeTitleState(title, NO_SEASONS, activeProgressOf({}, title))).toBe(first);
});
