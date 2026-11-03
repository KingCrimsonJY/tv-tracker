import {
  assertSafePublicUrl,
  safeFetchFollowingRedirects,
  UnsafeUrlError,
  type DnsLookupFn,
  type FetchFn,
} from '../security/ssrf.ts';

export interface LinkImportResult {
  title: string;
  posterUrl: string | null;
  overview: string;
  sourceUrl: string;
  suggestedMediaType: 'movie' | 'tv' | 'other';
}

export interface ResolveLinkOptions {
  timeoutMs?: number;
  lookupFn?: DnsLookupFn;
  fetchFn?: FetchFn;
}

const MAX_HTML_BYTES = 512 * 1024; // 512 KB

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

export function isHostOrSubdomain(hostname: string, domain: string): boolean {
  const h = hostname.toLowerCase();
  const d = domain.toLowerCase();
  return h === d || h.endsWith(`.${d}`);
}

async function readStreamUpToLimit(response: Response, maxBytes = MAX_HTML_BYTES): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    return text.slice(0, maxBytes);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  const chunks: string[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        if (totalBytes + value.byteLength >= maxBytes) {
          const remaining = maxBytes - totalBytes;
          if (remaining > 0) {
            chunks.push(decoder.decode(value.subarray(0, remaining), { stream: false }));
          }
          await reader.cancel().catch(() => {});
          break;
        }
        totalBytes += value.byteLength;
        chunks.push(decoder.decode(value, { stream: true }));
      }
    }
    chunks.push(decoder.decode());
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }

  return chunks.join('');
}

const YOUTUBE_REGEX =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|(?:embed|shorts|live)\/))([a-zA-Z0-9_-]{6,15})/i;
const BILI_BV_REGEX = /(BV[0-9a-zA-Z]{10})/i;
const BILI_AV_REGEX = /(?:^|\/|\?|&)av([0-9]+)/i;
const BILI_AID_REGEX = /[?&]aid=([0-9]+)/i;

/**
 * Resolves metadata for an imported URL with strict SSRF defenses.
 * Supports specialized fast paths for YouTube and Bilibili, and Open Graph scraping
 * with graceful fallback for any other public webpage.
 */
export async function resolveLinkMetadata(
  rawUrl: string,
  options: ResolveLinkOptions | number = {}
): Promise<LinkImportResult> {
  const opts: ResolveLinkOptions =
    typeof options === 'number' ? { timeoutMs: options } : options;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const safeFetchOpts = {
    lookupFn: opts.lookupFn,
    fetchFn: opts.fetchFn,
  };

  const safeInitialUrl = await assertSafePublicUrl(rawUrl, opts.lookupFn);
  const hostname = safeInitialUrl.hostname.toLowerCase();

  const isYouTube =
    isHostOrSubdomain(hostname, 'youtube.com') || isHostOrSubdomain(hostname, 'youtu.be');
  const isBilibili =
    isHostOrSubdomain(hostname, 'bilibili.com') || isHostOrSubdomain(hostname, 'b23.tv');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // 1. YouTube specialized fast path
    if (isYouTube) {
      const ytMatch = safeInitialUrl.toString().match(YOUTUBE_REGEX);
      const videoId = ytMatch?.[1];

      if (videoId) {
        const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const fallbackThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        try {
          const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
            canonicalUrl
          )}&format=json`;

          const { response: ytRes } = await safeFetchFollowingRedirects(
            oembedUrl,
            { signal: controller.signal },
            safeFetchOpts
          );

          if (ytRes.ok) {
            const ytData = (await ytRes.json()) as {
              title?: string;
              author_name?: string;
              thumbnail_url?: string;
            };

            return {
              title: ytData.title?.trim() || `YouTube 视频 (${videoId})`,
              posterUrl: ytData.thumbnail_url || fallbackThumbnail,
              overview: ytData.author_name
                ? `YouTube · ${ytData.author_name}`
                : '通过 YouTube 链接导入',
              sourceUrl: canonicalUrl,
              suggestedMediaType: 'other',
            };
          }
        } catch (err) {
          if (err instanceof UnsafeUrlError) {
            throw err;
          }
          // oEmbed network error or timeout: fall back to video ID metadata
        }

        return {
          title: `YouTube 视频 (${videoId})`,
          posterUrl: fallbackThumbnail,
          overview: '通过 YouTube 链接导入',
          sourceUrl: canonicalUrl,
          suggestedMediaType: 'other',
        };
      }
    }

    // 2. Bilibili specialized fast path via public web-interface API
    if (isBilibili) {
      let currentUrl = safeInitialUrl.toString();

      if (isHostOrSubdomain(hostname, 'b23.tv')) {
        try {
          const { finalUrl } = await safeFetchFollowingRedirects(
            currentUrl,
            { signal: controller.signal },
            safeFetchOpts
          );
          currentUrl = finalUrl;
        } catch (err) {
          if (err instanceof UnsafeUrlError) {
            throw err;
          }
        }
      }

      const bvMatch = currentUrl.match(BILI_BV_REGEX);
      const avMatch = currentUrl.match(BILI_AV_REGEX) || currentUrl.match(BILI_AID_REGEX);

      if (bvMatch || avMatch) {
        const queryParam = bvMatch ? `bvid=${bvMatch[1]}` : `aid=${avMatch![1]}`;
        const apiUrl = `https://api.bilibili.com/x/web-interface/view?${queryParam}`;

        try {
          const { response: biliRes } = await safeFetchFollowingRedirects(
            apiUrl,
            {
              signal: controller.signal,
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                Referer: 'https://www.bilibili.com/',
                Accept: 'application/json',
              },
            },
            safeFetchOpts
          );

          if (biliRes.ok) {
            const biliData = (await biliRes.json()) as {
              code?: number;
              data?: {
                title?: string;
                pic?: string;
                desc?: string;
                owner?: { name?: string };
              };
            };

            if (biliData.code === 0 && biliData.data) {
              const d = biliData.data;
              let cover = (d.pic || '').trim();
              if (cover.startsWith('http:')) {
                cover = cover.replace(/^http:/, 'https:');
              }

              const cleanedTitle = (d.title || '')
                .replace(/_哔哩哔哩_bilibili$/i, '')
                .replace(/\s*-\s*bilibili$/i, '')
                .trim();

              const desc =
                d.desc && d.desc.trim() !== '-'
                  ? d.desc.trim()
                  : d.owner?.name
                    ? `UP主：${d.owner.name}`
                    : '通过哔哩哔哩链接导入';

              return {
                title: cleanedTitle || (bvMatch ? `哔哩哔哩 (${bvMatch[1]})` : '哔哩哔哩视频'),
                posterUrl: cover || null,
                overview: desc,
                sourceUrl: safeInitialUrl.toString(),
                suggestedMediaType: 'other',
              };
            }
          }
        } catch (err) {
          if (err instanceof UnsafeUrlError) {
            throw err;
          }
        }

        if (bvMatch) {
          return {
            title: `哔哩哔哩 (${bvMatch[1]})`,
            posterUrl: null,
            overview: '通过哔哩哔哩链接导入',
            sourceUrl: safeInitialUrl.toString(),
            suggestedMediaType: 'other',
          };
        }
      }
    }

    // 3. General Open Graph / HTML metadata scrape (stream up to 512 KB)
    const { response: htmlRes, finalUrl } = await safeFetchFollowingRedirects(
      safeInitialUrl.toString(),
      {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
      },
      safeFetchOpts
    );

    if (htmlRes.ok) {
      const finalUrlObj = new URL(finalUrl);
      const html = await readStreamUpToLimit(htmlRes, MAX_HTML_BYTES);

      const extractMeta = (prop: string): string | null => {
        const r1 = new RegExp(
          `<meta[^>]+(?:property|name|itemprop)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
          'i'
        );
        const r2 = new RegExp(
          `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name|itemprop)=["']${prop}["']`,
          'i'
        );
        const m = html.match(r1) || html.match(r2);
        return m?.[1] ? decodeHtmlEntities(m[1].trim()) : null;
      };

      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const ogTitle =
        extractMeta('og:title') ||
        extractMeta('twitter:title') ||
        (titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1].trim()) : null) ||
        finalUrlObj.toString();

      const cleanedTitle = ogTitle
        .replace(/_哔哩哔哩_bilibili$/i, '')
        .replace(/\s*-\s*YouTube$/i, '')
        .trim();

      const rawOgImage = extractMeta('og:image') || extractMeta('twitter:image') || null;
      let resolvedOgImage: string | null = null;
      if (rawOgImage) {
        try {
          resolvedOgImage = new URL(rawOgImage, finalUrl).toString();
        } catch {
          resolvedOgImage = null;
        }
      }

      const ogDesc =
        extractMeta('og:description') ||
        extractMeta('description') ||
        extractMeta('twitter:description') ||
        '';

      return {
        title: cleanedTitle || finalUrlObj.hostname,
        posterUrl: resolvedOgImage,
        overview: ogDesc,
        sourceUrl: finalUrlObj.toString(),
        suggestedMediaType: 'other',
      };
    }
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      throw err;
    }
    // Upstream connection/timeout errors fall through to basic URL fallback
  } finally {
    clearTimeout(timer);
  }

  return {
    title:
      safeInitialUrl.hostname + (safeInitialUrl.pathname !== '/' ? safeInitialUrl.pathname : ''),
    posterUrl: null,
    overview: `来自链接：${safeInitialUrl.toString()}`,
    sourceUrl: safeInitialUrl.toString(),
    suggestedMediaType: 'other',
  };
}
