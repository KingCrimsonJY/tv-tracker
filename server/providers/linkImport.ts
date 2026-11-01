import { assertSafePublicUrl, safeFetchFollowingRedirects } from '../security/ssrf.ts';

export interface LinkImportResult {
  title: string;
  posterUrl: string | null;
  overview: string;
  sourceUrl: string;
  suggestedMediaType: 'movie' | 'tv' | 'other';
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
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
  timeoutMs = 8000
): Promise<LinkImportResult> {
  const safeInitialUrl = await assertSafePublicUrl(rawUrl);
  const hostname = safeInitialUrl.hostname.toLowerCase();

  const isYouTube =
    hostname.includes('youtube.com') || hostname === 'youtu.be' || hostname.endsWith('.youtu.be');
  const isBilibili =
    hostname.includes('bilibili.com') || hostname === 'b23.tv' || hostname.endsWith('.b23.tv');

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

          const { response: ytRes } = await safeFetchFollowingRedirects(oembedUrl, {
            signal: controller.signal,
          });

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
        } catch {
          // oEmbed network error or timeout: fall back to video ID metadata
        }

        // Reliable fallback if oEmbed is unreachable
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

      // Resolve b23.tv short link if necessary
      if (hostname === 'b23.tv' || hostname.endsWith('.b23.tv')) {
        try {
          const { finalUrl } = await safeFetchFollowingRedirects(currentUrl, {
            signal: controller.signal,
          });
          currentUrl = finalUrl;
        } catch {
          // Keep currentUrl
        }
      }

      const bvMatch = currentUrl.match(BILI_BV_REGEX);
      const avMatch = currentUrl.match(BILI_AV_REGEX) || currentUrl.match(BILI_AID_REGEX);

      if (bvMatch || avMatch) {
        const queryParam = bvMatch ? `bvid=${bvMatch[1]}` : `aid=${avMatch![1]}`;
        const apiUrl = `https://api.bilibili.com/x/web-interface/view?${queryParam}`;

        try {
          const { response: biliRes } = await safeFetchFollowingRedirects(apiUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
              Referer: 'https://www.bilibili.com/',
              Accept: 'application/json',
            },
          });

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
        } catch {
          // Bilibili API call failed; fall back to Open Graph or BVID fallback
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

    // 3. General Open Graph / HTML metadata scrape
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
      }
    );

    if (htmlRes.ok) {
      const finalUrlObj = new URL(finalUrl);
      const html = (await htmlRes.text()).slice(0, 180000);

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

      let ogImage = extractMeta('og:image') || extractMeta('twitter:image') || null;
      if (ogImage && ogImage.startsWith('//')) {
        ogImage = `https:${ogImage}`;
      } else if (ogImage && ogImage.startsWith('/')) {
        ogImage = `${finalUrlObj.origin}${ogImage}`;
      }

      const ogDesc =
        extractMeta('og:description') ||
        extractMeta('description') ||
        extractMeta('twitter:description') ||
        '';

      return {
        title: cleanedTitle || finalUrlObj.hostname,
        posterUrl: ogImage,
        overview: ogDesc,
        sourceUrl: finalUrlObj.toString(),
        suggestedMediaType: 'other',
      };
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('仅支持') ||
        err.message.includes('仅允许') ||
        err.message.includes('禁止访问') ||
        err.message.includes('重定向') ||
        err.message.includes('私有或受限') ||
        err.message.includes('认证信息'))
    ) {
      throw err;
    }
    // Upstream connection/timeout errors fall through to basic URL fallback
  } finally {
    clearTimeout(timer);
  }

  // 4. Safe fallback if upstream is slow or unresponsive
  return {
    title: safeInitialUrl.hostname + (safeInitialUrl.pathname !== '/' ? safeInitialUrl.pathname : ''),
    posterUrl: null,
    overview: `来自链接：${safeInitialUrl.toString()}`,
    sourceUrl: safeInitialUrl.toString(),
    suggestedMediaType: 'other',
  };
}
