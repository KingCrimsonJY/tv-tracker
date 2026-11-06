import type { LinkImportResult } from '../../src/domain/types.ts';
import {
  assertSafePublicUrl,
  type DnsLookupFn,
  type FetchFn,
  safeFetchFollowingRedirects,
  UnsafeUrlError,
} from '../security/ssrf.ts';
import {
  resolveWithYtdlp,
  type YtdlpExecFn,
  YtdlpNotInstalledError,
} from './ytdlp.ts';

export type { LinkImportResult };

export const YTDLP_MISSING_WARNING = 'YTDLP_MISSING';

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

export const extractFirstHttpUrl = extractHttpUrlFromText;

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

export function extractMetaContent(html: string, keys: string | string[]): string | null {
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const key of keyList) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex1 = new RegExp(
      `<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]+content=(?:"([^"]*)"|'([^']*)')`,
      'i'
    );
    const m1 = regex1.exec(html);
    const val1 = m1?.[1] ?? m1?.[2];
    if (val1) return decodeHtmlEntities(val1.trim());

    const regex2 = new RegExp(
      `<meta[^>]+content=(?:"([^"]*)"|'([^']*)')[^>]+(?:property|name|itemprop)=["']${escaped}["']`,
      'i'
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
  if (
    url.startsWith('http://') &&
    (url.includes('.hdslb.com/') || url.includes('.biliimg.com/'))
  ) {
    url = `https://${url.slice('http://'.length)}`;
  }
  return url.slice(0, 1000);
}

/**
 * Generic Open Graph / meta tag scraper used when yt-dlp is unavailable or fails.
 */
export async function scrapeOpenGraph(
  targetUrl: string,
  deps: Pick<LinkImportDependencies, 'lookupFn' | 'fetchFn'> = {}
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
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = (await response.text()).slice(0, 400_000);

    const ogTitle = extractMetaContent(html, ['og:title', 'twitter:title', 'title']);
    const titleTagMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    const fallbackTitle = titleTagMatch?.[1]
      ? decodeHtmlEntities(titleTagMatch[1].replace(/\s+/g, ' ').trim())
      : null;

    const rawTitle =
      ogTitle ||
      fallbackTitle ||
      (() => {
        try {
          return new URL(finalUrl).hostname;
        } catch {
          return finalUrl;
        }
      })();

    const cleanTitle = rawTitle
      .replace(/\s*[-_|]\s*(\u54d4\u54e9\u54d4\u54e9|bilibili|YouTube).*$/i, '')
      .trim()
      .slice(0, 200);

    const rawImage = extractMetaContent(html, [
      'og:image',
      'og:image:secure_url',
      'twitter:image',
      'image',
    ]);
    const posterUrl = normalizeImageUrl(rawImage, finalUrl);

    const rawDesc =
      extractMetaContent(html, ['og:description', 'twitter:description', 'description']) || '';
    const siteName = extractMetaContent(html, ['og:site_name']) || null;
    const cleanDesc = rawDesc === '-' ? '' : rawDesc;

    return {
      kind: 'video',
      title: cleanTitle || rawTitle.slice(0, 200),
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
 * 2. Runs yt-dlp with `--dump-single-json --skip-download --flat-playlist`.
 * 3. If yt-dlp is missing or fails, falls back to generic Open Graph scrape, then manual entry.
 */
export async function resolveLinkMetadata(
  rawInput: string,
  deps: LinkImportDependencies = {}
): Promise<LinkImportResult> {
  const extracted = extractHttpUrlFromText(rawInput);
  const safeUrl = await assertSafePublicUrl(extracted, deps.lookupFn);
  const normalizedUrl = safeUrl.toString();

  let warning: string | undefined;

  try {
    return await resolveWithYtdlp(normalizedUrl, {
      binaryPath: deps.ytdlpPath,
      lookupFn: deps.lookupFn,
      execFn: deps.execFn,
      forceImport: deps.forceImport,
    });
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      throw err;
    }
    if (err instanceof YtdlpNotInstalledError) {
      warning = YTDLP_MISSING_WARNING;
    }
  }

  try {
    const ogResult = await scrapeOpenGraph(normalizedUrl, {
      lookupFn: deps.lookupFn,
      fetchFn: deps.fetchFn,
    });
    return warning ? { ...ogResult, warning } : ogResult;
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      throw err;
    }
    const hostname = safeUrl.hostname;
    return {
      kind: 'video',
      title: hostname,
      posterUrl: null,
      overview: '',
      uploader: null,
      sourceUrl: normalizedUrl,
      year: null,
      runtimeMin: null,
      episodes: [],
      fallbackUsed: 'manual',
      ...(warning ? { warning } : {}),
    };
  }
}
