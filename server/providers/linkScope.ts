import { LinkImportError } from './linkErrors.ts';

export function assertSupportedLinkType(input: string): void {
  const url = new URL(input);
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  const reject = (code: 'LINK_LIVE_UNSUPPORTED' | 'LINK_FAVORITES_UNSUPPORTED' | 'LINK_WATCH_LATER_UNSUPPORTED' | 'LINK_FEED_UNSUPPORTED'): never => { throw new LinkImportError(code, code); };
  if (host === 'live.bilibili.com') reject('LINK_LIVE_UNSUPPORTED');
  if (host.endsWith('.bilibili.com') || host === 'bilibili.com') {
    if (/watchlater/i.test(path)) reject('LINK_WATCH_LATER_UNSUPPORTED');
    if (/favlist|\/(?:medialist\/(?:detail|play)|list)\/ml\d+/i.test(path) || url.searchParams.has('fid') || url.searchParams.get('business') === 'space_fav') reject('LINK_FAVORITES_UNSUPPORTED');
    if (host === 'space.bilibili.com' && !/^\/\d+\/(?:lists\/\d+|channel\/(?:collectiondetail|seriesdetail))\/?$/.test(path)) reject('LINK_FEED_UNSUPPORTED');
  }
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host)) {
    const list = url.searchParams.get('list') || '';
    if (list === 'WL' || /watch_later/i.test(path)) reject('LINK_WATCH_LATER_UNSUPPORTED');
    if (list === 'LL' || list.startsWith('FL')) reject('LINK_FAVORITES_UNSUPPORTED');
    if (/^\/(?:@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)\/live\/?$/.test(path)) reject('LINK_LIVE_UNSUPPORTED');
    if (/^\/(?:@|channel\/|c\/|user\/|feed\/)/.test(path) || list.startsWith('UU')) reject('LINK_FEED_UNSUPPORTED');
  }
}
