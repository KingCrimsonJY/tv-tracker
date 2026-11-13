import { expect, test } from 'vitest';
import { isImageReference } from './images.ts';

test('a poster field accepts nothing, an http(s) address or a TMDB file path, and nothing else', () => {
  for (const ok of ['', '  ', 'https://i.ytimg.com/vi/x/maxres.jpg', 'http://example.com/a.png', '/pPHpeI2X1qEd.jpg']) {
    expect(isImageReference(ok), ok).toBe(true);
  }
  for (const bad of [
    'not-a-valid-url',
    'poster.jpg',
    'ftp://example.com/a.jpg',
    'javascript:alert(1)',
    '/nested/path.jpg',
    '/no-extension',
  ]) {
    expect(isImageReference(bad), bad).toBe(false);
  }
});
