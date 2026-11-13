import { expect, test } from 'vitest';
import { createApp } from './app.ts';
import { TrackerRepository } from './db/repository.ts';

const FAR_FUTURE = 9_999_999_999_999;
const signedIn = (repo: TrackerRepository, token: string) => repo.verifyAndTouchSession(token, 2000, FAR_FUTURE);

test('resetting the password through APP_PASSWORD_HASH signs every device out at the next start', () => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  try {
    const start = (envPasswordHash: string) =>
      createApp({ repo, envPasswordHash, setupCode: 'code', isProduction: false });

    start('scrypt:old');
    repo.createSession('phone', 1000, FAR_FUTURE);
    start('scrypt:old');
    expect(signedIn(repo, 'phone')).toBe(true);

    start('scrypt:new');
    expect(signedIn(repo, 'phone')).toBe(false);
  } finally {
    repo.close();
  }
});

test('sessions that predate this check survive the first start, and the first password ends none', () => {
  const repo = new TrackerRepository({ dbPath: ':memory:' });
  try {
    // An existing installation: a password and a session, nothing recorded yet.
    repo.setStoredPasswordHash('scrypt:stored');
    repo.createSession('laptop', 1000, FAR_FUTURE);
    expect(repo.endSessionsOfReplacedPassword('scrypt:stored')).toBe(false);
    expect(repo.endSessionsOfReplacedPassword('scrypt:stored')).toBe(false);
    expect(signedIn(repo, 'laptop')).toBe(true);

    expect(repo.endSessionsOfReplacedPassword('scrypt:other')).toBe(true);
    expect(signedIn(repo, 'laptop')).toBe(false);
  } finally {
    repo.close();
  }
});
