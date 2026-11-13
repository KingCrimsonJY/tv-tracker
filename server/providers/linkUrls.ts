import { assertSafePublicUrl, safeFetchFollowingRedirects, type SafeFetchOptions } from '../security/ssrf.ts';
import { LinkImportError } from './linkErrors.ts';

export function isBilibiliUrl(url: URL): boolean {
  return ['www.bilibili.com', 'bilibili.com', 'm.bilibili.com', 'space.bilibili.com', 'live.bilibili.com'].includes(
    url.hostname,
  );
}

export function isBangumiUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return isBilibiliUrl(url) && /\/(?:bangumi)\/(?:play|media)\//.test(url.pathname);
  } catch {
    return false;
  }
}

/**
 * The old player address of an uploader list: `/medialist/play/<uploader>?business=…&business_id=<id>`.
 * Favorites use the same path and are told apart by `fid` or `business=space_fav`; they, and any other kind
 * that is neither a series nor a collection, are not such a list. `business` names the id space reliably
 * only for a series.
 */
export function legacyUploaderList(url: URL): { uploader: string; id: string; series: boolean } | null {
  const uploader = /^\/medialist\/play\/(\d+)\/?$/.exec(url.pathname)?.[1];
  const id = url.searchParams.get('business_id') ?? '';
  const business = url.searchParams.get('business');
  if (!uploader || !/^\d+$/.test(id) || url.searchParams.has('fid')) return null;
  if (business !== null && business !== 'space_series' && business !== 'space_collection') return null;
  return { uploader, id, series: business === 'space_series' };
}

function canonicalizeLinkUrl(input: URL): URL {
  const url = new URL(input);
  url.hash = '';
  if (isBilibiliUrl(url)) {
    if (url.hostname === 'm.bilibili.com' || url.hostname === 'bilibili.com') url.hostname = 'www.bilibili.com';
    url.protocol = 'https:';
    // Before any path is recognised: a rule that ran first would miss the address behind the prefix.
    url.pathname = url.pathname.replace(/^\/(?:zh-Hans|zh-Hant)\//, '/');
    const collection = /^\/list\/(\d+)\/?$/.exec(url.pathname);
    const sid = url.searchParams.get('sid');
    if (collection && sid && /^\d+$/.test(sid)) {
      url.hostname = 'space.bilibili.com';
      url.pathname = `/${collection[1]}/lists/${sid}`;
      url.searchParams.delete('sid');
    }
    // Sent to yt-dlp as it is, the uploader in the old address is never compared with the list's owner; as a
    // list address it is read like any other. Addresses that are not such a list keep every parameter, so
    // the scope check still sees what they are.
    const legacy = legacyUploaderList(url);
    if (legacy) {
      url.hostname = 'space.bilibili.com';
      url.pathname = `/${legacy.uploader}/lists/${legacy.id}`;
      url.search = legacy.series ? '?type=series' : '';
    }
    // Share tracking parameters may contain identifiers; retain only content selectors.
    const keep = new Set(['p', 'bvid', 'aid', 'sid', 'type', 'fid', 'business', 'business_id']);
    for (const key of [...url.searchParams.keys()]) if (!keep.has(key)) url.searchParams.delete(key);
  }
  return url;
}

export async function normalizeLinkUrl(raw: string, deps: SafeFetchOptions = {}): Promise<string> {
  let url = await assertSafePublicUrl(raw, deps.lookupFn);
  if (url.hostname === 'b23.tv' || url.hostname === 'www.b23.tv') {
    // BV/AV/episode aliases are deterministic; random share codes need a checked redirect.
    const alias = /^\/(BV[\da-z]+|av\d+|ss\d+|ep\d+)\/?$/i.exec(url.pathname)?.[1];
    if (alias) {
      const targetPath = /^(?:ss|ep)/i.test(alias) ? 'bangumi/play' : 'video';
      url = new URL('https://www.bilibili.com/' + targetPath + '/' + alias + url.search);
    } else {
      const { response, finalUrl } = await safeFetchFollowingRedirects(
        url.toString(),
        {
          signal: AbortSignal.timeout(10_000),
          headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://www.bilibili.com/' },
        },
        deps,
      );
      await response.body?.cancel();
      url = new URL(finalUrl);
      if (!response.ok || !isBilibiliUrl(url)) {
        throw new LinkImportError('LINK_UNAVAILABLE', 'The Bilibili share link is unavailable.');
      }
    }
  }
  return (await assertSafePublicUrl(canonicalizeLinkUrl(url).toString(), deps.lookupFn)).toString();
}
