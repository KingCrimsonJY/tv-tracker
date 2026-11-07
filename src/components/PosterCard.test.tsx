import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { makeBaseTvTitle, makeSampleSeasons } from '../domain/testFixtures';
import { en } from '../i18n/messages/en';
import { PosterCard } from './PosterCard';

vi.mock('../i18n', () => ({ useI18n: () => ({ t: en, locale: 'en' }) }));

test.each([
  [2, 0],
  [6, 1],
  [282, 50],
])(
  'a 564-episode collection with %i watched reports %i percent without a visual minimum',
  (watchedCount, percentage) => {
    const episode = makeSampleSeasons()[1].episodes[0];
    const episodes = Array.from({ length: 564 }, (_, index) => ({
      ...episode,
      number: index + 1,
      key: `s1e${index + 1}`,
    }));
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <PosterCard
          title={makeBaseTvTitle()}
          seasons={[{ seasonNumber: 1, name: null, episodes }]}
          progress={{
            playthroughId: 'p1',
            watched: Object.fromEntries(episodes.slice(0, watchedCount).map((item) => [item.key, 1])),
          }}
        />
      </MemoryRouter>,
    );

    expect(markup).toContain(`${watchedCount}/564`);
    expect(markup).toMatch(new RegExp(`aria-label="Severance watch progress"[^>]*aria-valuenow="${percentage}"`));
  },
);
