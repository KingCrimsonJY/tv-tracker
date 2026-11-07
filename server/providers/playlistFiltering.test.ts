import { expect, test } from 'vitest';
import { mapYtdlpJsonToLinkResult } from './ytdlp.ts';
const url = 'https://www.youtube.com/playlist?list=PLexample';
test('mixed playlists skip live and upcoming entries while retaining videos and completed live replays', () => {
  const result = mapYtdlpJsonToLinkResult(
    {
      title: 'Mix',
      _type: 'playlist',
      playlist_count: 5,
      entries: [
        { id: 'normal', title: 'Video', duration: 60 },
        { id: 'live', title: 'Live', is_live: true },
        { id: 'soon', title: 'Premiere', live_status: 'is_upcoming' },
        { id: 'replay', title: 'Replay', duration: 300, live_status: 'was_live' },
        { id: 'live2', title: 'Live 2', live_status: 'is_live' },
      ],
    },
    url,
  );
  expect(result.skippedCount).toBe(3);
  expect(result.episodes.map((ep) => ep.sourceVideoId)).toEqual(['normal', 'replay']);
  expect(result.warning).toBeUndefined();
});
test('a playlist containing only unwatchable live entries cannot create an empty title', () => {
  expect(() =>
    mapYtdlpJsonToLinkResult({ title: 'Live', _type: 'playlist', entries: [{ title: 'Live', is_live: true }] }, url),
  ).toThrow('LINK_EMPTY_PLAYLIST');
});
