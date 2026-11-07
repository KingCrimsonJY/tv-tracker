import { expect, test } from 'vitest';
import { linkResultToManualSeed } from './linkImportModel.ts';

test('single videos keep year and runtime through the confirmation form', () => {
  const seed = linkResultToManualSeed({
    kind: 'video', title: 'Short', posterUrl: null, overview: '', sourceUrl: 'https://youtube.com/shorts/abc',
    year: 2023, runtimeMin: 1, episodes: [], fallbackUsed: 'yt-dlp',
  });
  expect(seed).toMatchObject({ year: 2023, runtimeMin: 1, mediaType: 'other', episodeCount: 0 });
});
test('one-entry lists remain episodic and partial metadata keeps its warning', () => {
  const seed = linkResultToManualSeed({
    kind: 'playlist', title: 'List', posterUrl: null, overview: '', sourceUrl: 'https://youtube.com/playlist?list=abc',
    year: null, runtimeMin: null, episodes: [{ name: 'First', sourceVideoId: 'one' }],
    fallbackUsed: 'yt-dlp', warning: 'LINK_METADATA_INCOMPLETE',
  });
  expect(seed).toMatchObject({ mediaType: 'other', episodeCount: 1, warning: 'LINK_METADATA_INCOMPLETE' });
});
