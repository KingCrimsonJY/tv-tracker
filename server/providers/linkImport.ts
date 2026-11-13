import { assertSupportedLinkType } from './linkScope.ts';
import type { LinkImportResult } from '../../src/domain/types.ts';
import {
  assertSafePublicUrl,
  type DnsLookupFn,
  type FetchFn,
  safeFetchFollowingRedirects,
  readResponseText,
  UnsafeUrlError,
} from '../security/ssrf.ts';
import { resolveWithYtdlp, type YtdlpExecFn } from './ytdlp.ts';

import { resolveBilibiliMetadata } from './bilibili.ts';
import { classifyLinkFailure, LinkImportError } from './linkErrors.ts';
import { normalizeLinkUrl, isBangumiUrl } from './linkUrls.ts';

export type { LinkImportResult };

export interface LinkImportDependencies {
  lookupFn?: DnsLookupFn;
  fetchFn?: FetchFn;
  execFn?: YtdlpExecFn;
  ytdlpPath?: string;
  forceImport?: boolean;
}

/**
 * Extracts the first http:// or https:// URL from a pasted string,
 * such as social app share snippets containing text and a short URL.
 */
export function extractHttpUrlFromText(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
  if (!match) return trimmed;
  return match[0].replace(/[)\]\u3011\u300b\uff0c\u3002\uff01\uff1f\uff1b,;!?]+$/u, '');
}

export function decodeHtmlEntities(str: string): string {
  const codePoint = (value: number, original: string) =>
    Number.isInteger(value) && value >= 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff)
      ? String.fromCodePoint(value)
      : original;
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (original, dec) => codePoint(Number(dec), original))
    .replace(/&#x([0-9a-f]+);/gi, (original, hex) => codePoint(parseInt(hex, 16), original));
}

export function extractMetaContent(html: string, keys: string | string[]): string | null {
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const key of keyList) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex1 = new RegExp(
      `<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]+content=(?:"([^"]*)"|'([^']*)')`,
      'i',
    );
    const m1 = regex1.exec(html);
    const val1 = m1?.[1] ?? m1?.[2];
    if (val1) return decodeHtmlEntities(val1.trim());

    const regex2 = new RegExp(
      `<meta[^>]+content=(?:"([^"]*)"|'([^']*)')[^>]+(?:property|name|itemprop)=["']${escaped}["']`,
      'i',
    );
    const m2 = regex2.exec(html);
    const val2 = m2?.[1] ?? m2?.[2];
    if (val2) return decodeHtmlEntities(val2.trim());
  }
  return null;
}

function normalizeImageUrl(raw: string | null, baseUrl: string): string | null {
  if (!raw) return null;
  let url = raw.trim();
  if (!url) return null;
  if (url.startsWith('//')) {
    url = `https:${url}`;
  } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
    try {
      url = new URL(url, baseUrl).toString();
    } catch {
      return null;
    }
  }
  if (url.startsWith('http://') && (url.includes('.hdslb.com/') || url.includes('.biliimg.com/'))) {
    url = `https://${url.slice('http://'.length)}`;
  }
  return url.slice(0, 1000);
}

/**
 * Generic Open Graph / meta tag scraper used when yt-dlp is unavailable or fails.
 */
export async function scrapeOpenGraph(
  targetUrl: string,
  deps: Pick<LinkImportDependencies, 'lookupFn' | 'fetchFn'> = {},
): Promise<LinkImportResult> {
  const safeInitial = await assertSafePublicUrl(targetUrl, deps.lookupFn);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const { response, finalUrl } = await safeFetchFollowingRedirects(
      safeInitial.toString(),
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        signal: controller.signal,
      },
      {
        maxRedirects: 5,
        lookupFn: deps.lookupFn,
        fetchFn: deps.fetchFn,
      },
    );

    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType && !/html/i.test(contentType)) {
      await response.body?.cancel();
      throw new LinkImportError('LINK_PARSE_FAILED', 'The source did not return a web page.');
    }
    const html = await readResponseText(response, 400_000);

    const ogTitle = extractMetaContent(html, ['og:title', 'twitter:title', 'title']);
    const titleTagMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    const fallbackTitle = titleTagMatch?.[1] ? decodeHtmlEntities(titleTagMatch[1].replace(/\s+/g, ' ').trim()) : null;

    const rawTitle = ogTitle || fallbackTitle || '';

    const cleanTitle = rawTitle
      .replace(/\s*[-_|]\s*(\u54d4\u54e9\u54d4\u54e9|bilibili|YouTube).*$/i, '')
      .trim()
      .slice(0, 200);

    if (
      !cleanTitle ||
      cleanTitle === new URL(finalUrl).hostname ||
      /^(?:YouTube|bilibili|\u54d4\u54e9\u54d4\u54e9|404|not found|access denied|sign in)(?:\s|$)/i.test(cleanTitle) ||
      /\u89c6\u9891\u53bb\u54ea\u4e86|\u64ad\u5355\u53bb\u54ea\u4e86|\u4e8c\u6b21\u5143\u5f39\u5e55\u76f4\u64ad\u5e73\u53f0/.test(
        cleanTitle,
      )
    ) {
      throw new LinkImportError('LINK_UNAVAILABLE', 'No usable content metadata was found.');
    }

    const rawImage = extractMetaContent(html, ['og:image', 'og:image:secure_url', 'twitter:image', 'image']);
    const posterUrl = normalizeImageUrl(rawImage, finalUrl);

    const rawDesc = extractMetaContent(html, ['og:description', 'twitter:description', 'description']) || '';
    const siteName = extractMetaContent(html, ['og:site_name']) || null;
    const cleanDesc = rawDesc === '-' ? '' : rawDesc;

    return {
      kind: isBangumiUrl(finalUrl) ? 'tmdb-suggestion' : 'video',
      title: cleanTitle,
      posterUrl,
      overview: cleanDesc.slice(0, 2000),
      uploader: siteName ? siteName.slice(0, 200) : null,
      sourceUrl: finalUrl.slice(0, 2048),
      year: null,
      runtimeMin: null,
      episodes: [],
      fallbackUsed: 'og',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Primary link metadata resolver:
 * 1. Extracts HTTP/HTTPS URL and validates SSRF safety.
 * 2. Uses public Bilibili metadata, then runs yt-dlp with `--dump-single-json --skip-download --flat-playlist`.
 * 3. If extraction fails, accepts meaningful public Open Graph metadata with a warning; otherwise returns an explicit error.
 */
async function resolveNormalizedMetadata(
  normalizedUrl: string,
  deps: LinkImportDependencies = {},
): Promise<LinkImportResult> {
  assertSupportedLinkType(normalizedUrl);
  let nativeFailure: LinkImportError | undefined;
  try {
    const result = await resolveBilibiliMetadata(normalizedUrl, deps);
    if (result) return result;
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw err;
    nativeFailure = classifyLinkFailure(err);
    if (
      [
        'LINK_EMPTY_PLAYLIST',
        'LINK_PLAYLIST_TOO_LARGE',
        'LINK_LIVE_UNSUPPORTED',
        'LINK_FAVORITES_UNSUPPORTED',
        'LINK_WATCH_LATER_UNSUPPORTED',
        'LINK_FEED_UNSUPPORTED',
      ].includes(nativeFailure.code)
    )
      throw nativeFailure;
  }

  let failure: LinkImportError;
  try {
    return await resolveWithYtdlp(normalizedUrl, {
      binaryPath: deps.ytdlpPath,
      lookupFn: deps.lookupFn,
      execFn: deps.execFn,
      forceImport: deps.forceImport,
    });
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw err;
    failure = classifyLinkFailure(err);
    if (
      nativeFailure &&
      (['LINK_UNAVAILABLE', 'LINK_LOGIN_REQUIRED'].includes(nativeFailure.code) ||
        (failure.code === 'LINK_PARSE_FAILED' && nativeFailure.code !== 'LINK_PARSE_FAILED'))
    ) {
      failure = nativeFailure;
    }
  }

  if (
    [
      'LINK_EMPTY_PLAYLIST',
      'LINK_PLAYLIST_TOO_LARGE',
      'LINK_LIVE_UNSUPPORTED',
      'LINK_FAVORITES_UNSUPPORTED',
      'LINK_WATCH_LATER_UNSUPPORTED',
      'LINK_FEED_UNSUPPORTED',
    ].includes(failure.code)
  )
    throw failure;

  // Restrictions are actionable failures, not successful generic page imports.
  // Bangumi pages can still supply a title for a clearly labelled TMDB suggestion.
  const restricted = [
    'LINK_REGION_RESTRICTED',
    'LINK_AGE_RESTRICTED',
    'LINK_PAYMENT_REQUIRED',
    'LINK_LOGIN_REQUIRED',
    'LINK_UNAVAILABLE',
    'LINK_RATE_LIMITED',
  ];
  if (restricted.includes(failure.code) && !isBangumiUrl(normalizedUrl)) throw failure;
  try {
    const result = await scrapeOpenGraph(normalizedUrl, deps);
    return {
      ...result,
      ...(deps.forceImport ? { kind: 'video' as const } : {}),
      warning: failure.code,
    };
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw err;
    throw failure;
  }
}

// Small, process-local cache: avoids repeatedly requesting the same public
// metadata while the user previews an import. Explicit refresh always bypasses it.
const metadataCache = new Map<string, { expiresAt: number; result: LinkImportResult }>();
const pendingMetadata = new Map<string, Promise<LinkImportResult>>();
const CACHE_ENTRY_BUDGET = 10_000;

export async function resolveLinkMetadata(
  rawInput: string,
  deps: LinkImportDependencies = {},
): Promise<LinkImportResult> {
  const normalizedUrl = await normalizeLinkUrl(extractHttpUrlFromText(rawInput), deps);
  // Injected dependencies must remain isolated (tests and callers with custom providers).
  if (deps.fetchFn || deps.execFn || deps.lookupFn || deps.ytdlpPath) {
    return resolveNormalizedMetadata(normalizedUrl, deps);
  }
  const key = normalizedUrl + (deps.forceImport ? '#refresh' : '');
  const cached = metadataCache.get(key);
  if (!deps.forceImport && cached && cached.expiresAt > Date.now()) return structuredClone(cached.result);
  const pending = pendingMetadata.get(key);
  if (pending) return structuredClone(await pending);
  if (pendingMetadata.size >= 4)
    throw new LinkImportError('LINK_RATE_LIMITED', 'Too many link requests are in progress.');
  const promise = resolveNormalizedMetadata(normalizedUrl, deps);
  pendingMetadata.set(key, promise);
  try {
    const result = await promise;
    if (!deps.forceImport) {
      const ttl = result.warning ? 30_000 : 300_000;
      metadataCache.set(key, { expiresAt: Date.now() + ttl, result: structuredClone(result) });
      let weight = [...metadataCache.values()].reduce((sum, item) => sum + item.result.episodes.length + 1, 0);
      for (const [cacheKey, item] of metadataCache) {
        if (item.expiresAt <= Date.now() || metadataCache.size > 64 || weight > CACHE_ENTRY_BUDGET) {
          weight -= item.result.episodes.length + 1;
          metadataCache.delete(cacheKey);
        }
      }
    }
    return result;
  } finally {
    pendingMetadata.delete(key);
  }
}
