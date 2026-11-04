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

export const YTDLP_MISSING_WARNING = '未安装 yt-dlp，已使用基础解析';
const MAX_HTML_BYTES = 512 * 1024; // 512 KB cap

export interface LinkImportDependencies {
  lookupFn?: DnsLookupFn;
  fetchFn?: FetchFn;
  execFn?: YtdlpExecFn;
  ytdlpPath?: string;
  forceImport?: boolean;
}

/**
 * Extracts the first http(s):// URL from pasted share text such as:
 * "【标题-哔哩哔哩】 https://b23.tv/AbCdEf"
 * If no http(s):// substring is found, returns the trimmed input so URL validation
 * can report an appropriate error (e.g. UnsafeUrlError on ftp://).
 */
export function extractFirstHttpUrl(rawInput: string): string {
  const trimmed = rawInput.trim();
  const match = trimmed.match(/https?:\/\/[^\s"'<>【】（）[\]]+/i);
  if (!match) {
    return trimmed.slice(0, 2048);
  }
  const cleaned = match[0].replace(/[，。！？；：、,.!?;:)+】）\]]+$/u, '');
  return (cleaned || match[0]).slice(0, 2048);
}

export function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_m, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : _m;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : _m;
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export function extractMetaContent(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)\\s*=\\s*(?:"${escaped}"|'${escaped}')[^>]+content\\s*=\\s*(?:"([^"]*)"|'([^']*)')`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+content\\s*=\\s*(?:"([^"]*)"|'([^']*)')[^>]+(?:property|name)\\s*=\\s*(?:"${escaped}"|'${escaped}')`,
      'i'
    ),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    const val = match?.[1] ?? match?.[2];
    if (val && val.trim()) {
      return decodeHtmlEntities(val);
    }
  }
  return '';
}

function extractTitleTag(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1].replace(/\s+/g, ' ')) : '';
}

async function readHtmlUpToLimit(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    return text.slice(0, maxBytes);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let totalBytes = 0;
  let result = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes >= maxBytes) {
          const remaining = maxBytes - (totalBytes - value.byteLength);
          if (remaining > 0) {
            result += decoder.decode(value.subarray(0, remaining), { stream: false });
          }
          await reader.cancel().catch(() => undefined);
          break;
        }
        result += decoder.decode(value, { stream: true });
        if (/<\/head>/i.test(result)) {
          await reader.cancel().catch(() => undefined);
          break;
        }
      }
    }
    result += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return result;
}

function resolveRelativeUrl(candidate: string, baseUrl: URL): string | null {
  if (!candidate) return null;
  try {
    let resolved = new URL(candidate, baseUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return null;
    }
    if (
      resolved.protocol === 'http:' &&
      (resolved.hostname.endsWith('.hdslb.com') || resolved.hostname.endsWith('.biliimg.com'))
    ) {
      resolved = new URL(resolved.toString().replace(/^http:\/\//i, 'https://'));
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

async function scrapeOpenGraphMetadata(
  safeUrl: URL,
  lookupFn: DnsLookupFn | undefined,
  fetchFn: FetchFn | undefined
): Promise<Omit<LinkImportResult, 'warning'> | null> {
  const { response, finalUrl } = await safeFetchFollowingRedirects(
    safeUrl.toString(),
    {
      headers: {
        'User-Agent':
          'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php) Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
    },
    { lookupFn, fetchFn }
  );

  if (!response.ok) {
    return null;
  }

  const finalUrlObj = new URL(finalUrl);
  const html = await readHtmlUpToLimit(response, MAX_HTML_BYTES);
  const title =
    extractMetaContent(html, 'og:title') ||
    extractMetaContent(html, 'twitter:title') ||
    extractTitleTag(html);

  if (!title) {
    return null;
  }

  const rawImage =
    extractMetaContent(html, 'og:image') || extractMetaContent(html, 'twitter:image');
  const posterUrl = resolveRelativeUrl(rawImage, finalUrlObj);
  const overview =
    extractMetaContent(html, 'og:description') ||
    extractMetaContent(html, 'twitter:description') ||
    extractMetaContent(html, 'description') ||
    '';

  return {
    kind: 'video',
    title: title.slice(0, 200),
    posterUrl: posterUrl ? posterUrl.slice(0, 1000) : null,
    overview: overview.slice(0, 2000),
    sourceUrl: finalUrl.slice(0, 2048),
    episodes: [],
    fallbackUsed: 'og',
  };
}

export async function resolveLinkMetadata(
  rawInput: string,
  deps: LinkImportDependencies = {}
): Promise<LinkImportResult> {
  const { lookupFn, fetchFn } = deps;

  const candidateUrlStr = extractFirstHttpUrl(rawInput);
  const safeUrl = await assertSafePublicUrl(candidateUrlStr, lookupFn);

  let warning: string | undefined;

  // Step 1: Primary resolver — yt-dlp subprocess
  try {
    return await resolveWithYtdlp(safeUrl.toString(), {
      binaryPath: deps.ytdlpPath,
      lookupFn,
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

  // Step 2: Fallback #1 — Generic Open Graph scrape
  try {
    const ogResult = await scrapeOpenGraphMetadata(safeUrl, lookupFn, fetchFn);
    if (ogResult) {
      return {
        ...ogResult,
        ...(warning ? { warning } : {}),
      };
    }
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      throw err;
    }
  }

  // Step 3: Fallback #2 — Manual entry seed with URL prefilled
  return {
    kind: 'video',
    title: safeUrl.hostname,
    posterUrl: null,
    overview: '',
    sourceUrl: safeUrl.toString().slice(0, 2048),
    episodes: [],
    fallbackUsed: 'manual',
    ...(warning ? { warning } : {}),
  };
}
