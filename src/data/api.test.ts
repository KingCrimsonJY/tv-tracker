import { expect, test } from 'vitest';
import { assertSessionEstablished } from './api.ts';

test('a login whose cookie the browser dropped is reported instead of silently returning to sign-in', async () => {
  await expect(assertSessionEstablished(async () => ({ authenticated: false }))).rejects.toMatchObject({
    code: 'SESSION_COOKIE_REJECTED',
  });
  await expect(assertSessionEstablished(async () => ({ authenticated: true }))).resolves.toBeUndefined();
});
