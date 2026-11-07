import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';
import { makeBaseTvTitle } from '../../domain/testFixtures';
import { en } from '../../i18n/messages/en';
import { UpstreamPanel } from './UpstreamPanel';

vi.mock('../../i18n', () => ({ useI18n: () => ({ t: en, translateError: () => '' }) }));
vi.mock('../../context/TrackerContext', () => ({
  useTracker: () => ({
    setStructureLock: vi.fn(),
    resolveStructure: vi.fn(),
    changeTitleSource: vi.fn(),
    progressByTitle: {},
  }),
}));

test('an unavailable generic video offers both TMDB media types and manual maintenance', () => {
  const markup = renderToStaticMarkup(
    <UpstreamPanel title={makeBaseTvTitle({ source: 'url', mediaType: 'other', sourceUnavailable: true })} />,
  );
  expect(markup).toContain('Source unavailable');
  expect(markup).toContain('Maintain manually');
  expect(markup).toContain('Re-link to TMDB');
});

test('an available title does not offer source recovery actions', () => {
  const markup = renderToStaticMarkup(<UpstreamPanel title={makeBaseTvTitle()} />);
  expect(markup).toBe('');
  expect(markup).not.toContain('Maintain manually');
});
