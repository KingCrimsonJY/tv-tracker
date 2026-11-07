import { expect, test, vi } from 'vitest';
import { resolveLinkMetadata } from './linkImport.ts';
import { assertSupportedLinkType } from './linkScope.ts';
import { mapYtdlpJsonToLinkResult } from './ytdlp.ts';
const lookupFn = async () => [{ address: '93.184.216.34' }];

test.each([
  ['https://live.bilibili.com/123', 'LINK_LIVE_UNSUPPORTED'],
  ['https://www.youtube.com/@creator/live', 'LINK_LIVE_UNSUPPORTED'],
  ['https://space.bilibili.com/123/favlist?fid=456', 'LINK_FAVORITES_UNSUPPORTED'],
  ['https://www.bilibili.com/medialist/detail/ml123', 'LINK_FAVORITES_UNSUPPORTED'],
  ['https://www.bilibili.com/list/ml123', 'LINK_FAVORITES_UNSUPPORTED'],
  ['https://youtube.com/playlist?list=FLabc', 'LINK_FAVORITES_UNSUPPORTED'],
  ['https://youtube.com/playlist?list=LL', 'LINK_FAVORITES_UNSUPPORTED'],
  ['https://www.bilibili.com/watchlater/', 'LINK_WATCH_LATER_UNSUPPORTED'],
  ['https://www.bilibili.com/list/watchlater', 'LINK_WATCH_LATER_UNSUPPORTED'],
  ['https://youtube.com/playlist?list=WL', 'LINK_WATCH_LATER_UNSUPPORTED'],
  ['https://space.bilibili.com/123/video', 'LINK_FEED_UNSUPPORTED'],
  ['https://space.bilibili.com/123', 'LINK_FEED_UNSUPPORTED'],
  ['https://youtube.com/@creator/shorts', 'LINK_FEED_UNSUPPORTED'],
  ['https://youtube.com/channel/UCabc/videos', 'LINK_FEED_UNSUPPORTED'],
  ['https://youtube.com/user/creator', 'LINK_FEED_UNSUPPORTED'],
  ['https://youtube.com/playlist?list=UUabc', 'LINK_FEED_UNSUPPORTED'],
])('rejects %s before any provider call', async (url, code) => {
  const fetchFn = vi.fn(); const execFn = vi.fn();
  await expect(resolveLinkMetadata(url, { lookupFn, fetchFn, execFn })).rejects.toMatchObject({ code });
  expect(fetchFn).not.toHaveBeenCalled(); expect(execFn).not.toHaveBeenCalled();
});

test.each(['is_live', 'is_upcoming'])('rejects YouTube %s metadata, including live playlist entries', status => {
  expect(() => mapYtdlpJsonToLinkResult({ title: 'Live', live_status: status }, 'https://youtube.com/watch?v=abcdefghijk')).toThrow('LINK_LIVE_UNSUPPORTED');
  expect(() => mapYtdlpJsonToLinkResult({ title: 'Playlist', entries: [{ id: 'abcdefghijk', live_status: status }] }, 'https://youtube.com/playlist?list=PLabc')).toThrow('LINK_LIVE_UNSUPPORTED');
});

test.each([
  'https://youtube.com/watch?v=abcdefghijk', 'https://youtu.be/abcdefghijk',
  'https://youtube.com/shorts/abcdefghijk', 'https://youtube.com/live/abcdefghijk',
  'https://youtube.com/playlist?list=PLabc', 'https://www.bilibili.com/video/BV1bK411W797?p=2',
  'https://space.bilibili.com/123/lists/456?type=season', 'https://space.bilibili.com/123/channel/seriesdetail?sid=456',
  'https://www.bilibili.com/cheese/play/ss123', 'https://www.bilibili.com/bangumi/play/ss123',
])('keeps supported content URL %s', url => { expect(() => assertSupportedLinkType(url)).not.toThrow(); });
