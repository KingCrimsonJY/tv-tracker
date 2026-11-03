export interface DoubanLookupInput {
  imdbId?: string;
  title?: string;
  year?: number | null;
  doubanId?: string;
}

export interface DoubanLookupResult {
  doubanId?: string;
  doubanUrl?: string;
  doubanRating?: string;
}

export function buildDoubanSearchUrl(title: string): string {
  return `https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(
    title.trim()
  )}`;
}

/**
 * Isolated best-effort Douban provider.
 * There is no official Douban API; this lookup may fail at any time due to
 * rate limits or anti-bot checks and MUST NEVER throw or break the page.
 */
export async function lookupDoubanBestEffort(
  input: DoubanLookupInput
): Promise<DoubanLookupResult> {
  try {
    let subjectId = input.doubanId?.trim();

    if (subjectId) {
      const m = subjectId.match(/\/subject\/(\d+)/);
      if (m) subjectId = m[1];
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3200);

    try {
      // 1. If we don't have a subjectId yet, try Douban's public suggest endpoint
      if (!subjectId) {
        const q = (input.imdbId || input.title || '').trim();
        if (q) {
          const suggestUrl = `https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(
            q
          )}`;
          const res = await fetch(suggestUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
              Accept: 'application/json,text/plain,*/*',
              Referer: 'https://movie.douban.com/',
            },
          });
          if (res.ok) {
            const list = (await res.json()) as Array<{
              id?: string;
              title?: string;
              year?: string;
            }>;
            if (Array.isArray(list) && list.length > 0) {
              const matched =
                (input.year
                  ? list.find((item) => item.year === String(input.year))
                  : undefined) || list[0];
              if (matched?.id) {
                subjectId = String(matched.id);
              }
            }
          }
        }
      }

      if (!subjectId) {
        return {};
      }

      const subjectUrl = `https://movie.douban.com/subject/${subjectId}/`;

      // 2. Try fetching the subject page to extract aggregateRating from JSON-LD or HTML
      const pageRes = await fetch(subjectUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          Referer: 'https://movie.douban.com/',
        },
      });

      if (!pageRes.ok) {
        return {
          doubanId: subjectId,
          doubanUrl: subjectUrl,
        };
      }

      const html = await pageRes.text();
      const ratingMatch =
        html.match(/property="v:average"\s*>\s*([0-9.]+)\s*</i) ||
        html.match(/"ratingValue"\s*:\s*"([0-9.]+)"/i);

      return {
        doubanId: subjectId,
        doubanUrl: subjectUrl,
        ...(ratingMatch?.[1] ? { doubanRating: ratingMatch[1] } : {}),
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    // Always fail silently and fall back to manual fields
    return {};
  }
}
