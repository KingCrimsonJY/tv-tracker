import { expect, test } from 'vitest';
import { isDevelopmentMode } from './runtimeMode.ts';
test('npm start without NODE_ENV uses production and dev requires explicit opt-in', () => {
  expect(isDevelopmentMode(['node', 'server.ts'], '')).toBe(false);
  expect(isDevelopmentMode(['node', 'server.ts'], 'production')).toBe(false);
  expect(isDevelopmentMode(['tsx', 'server.ts', '--dev'], '')).toBe(true);
  expect(isDevelopmentMode(['node', 'server.ts'], 'development')).toBe(true);
});
