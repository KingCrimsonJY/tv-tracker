import { expect, test } from 'vitest';
import { normalizeTmdbImages, responsiveImage } from './images';
test('normalizes legacy artwork without changing arbitrary URLs or text', () => {
  const legacy = 'https://image.tmdb.org/t/p/w500/poster.jpg';
  expect(
    normalizeTmdbImages({
      posterPath: legacy,
      names: { original: legacy },
      posters: { en: legacy },
      overview: { en: legacy },
    }),
  ).toEqual({
    posterPath: '/poster.jpg',
    names: { original: legacy },
    posters: { en: '/poster.jpg' },
    overview: { en: legacy },
  });
  expect(responsiveImage('/poster.jpg').srcSet).toContain('/w185/poster.jpg 185w');
  expect(responsiveImage('/backdrop.jpg', 'backdrop').sizes).toContain('100vw');
  expect(responsiveImage('https://i.ytimg.com/vi/abc/hqdefault.jpg')).toEqual({
    src: 'https://i.ytimg.com/vi/abc/hqdefault.jpg',
  });
});
