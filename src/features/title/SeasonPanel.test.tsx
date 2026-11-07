import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { en } from '../../i18n/messages/en';
import { makeBaseTvTitle, makeSampleSeasons, TODAY } from '../../domain/testFixtures';
import { SeasonPanel } from './SeasonPanel';

vi.mock('../../i18n', () => ({
  useI18n: () => ({ t: en, locale: 'en', formatDate: (date: string) => date }),
}));

test('specials show the same aired progress in the disclosure header and season body', () => {
  const [specialSeason, ...seasons] = makeSampleSeasons();
  const markup = renderToStaticMarkup(
    <SeasonPanel
      title={makeBaseTvTitle()}
      seasons={seasons}
      specialSeason={specialSeason}
      activeProgress={{ playthroughId: 'p1', watched: { s0e1: 1000 } }}
      today={TODAY}
      highlightEpKey={null}
      onToggleEpisode={() => {}}
      onMarkSeason={() => {}}
      onMarkUpTo={() => {}}
      onOpenResumeForEpisode={() => {}}
    />,
  );

  expect(markup).toContain('Specials (1/1 watched)');
  expect(markup).toMatch(/aria-label="Season 0 watch progress"[^>]*aria-valuenow="100"/);
});
