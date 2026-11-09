import { expect, test } from 'vitest';
import { hasInAppHistory } from './useBackNavigation';

test('a page opened directly has no in-app history to go back to', () => {
  expect(hasInAppHistory('default')).toBe(false);
  expect(hasInAppHistory('k3x9a')).toBe(true);
});
