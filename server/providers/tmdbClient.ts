export class TmdbRequestError extends Error {
  readonly status: number;
  constructor(status: number) { super('TMDB_UNAVAILABLE'); this.status = status; }
}

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p';
const TMDB_TIMEOUT_MS = 10_000;

export interface TmdbFetchOptions {
  fetchFn?: typeof fetch;
}

export function getOmdbKey(): string {
  const raw = (process.env.OMDB_API_KEY || '').trim().replace(/^['"]|['"]$/g, '').trim();
  if (
    !raw ||
    raw.startsWith('MY_') ||
    raw.startsWith('YOUR_') ||
    raw === 'undefined' ||
    raw === 'null'
  ) {
    return '';
  }
  return raw;
}

export function getTmdbToken(): string {
  const raw = (process.env.TMDB_READ_TOKEN || process.env.TMDB_API_KEY || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (
    !raw ||
    raw.startsWith('MY_') ||
    raw.startsWith('YOUR_') ||
    raw.startsWith('<') ||
    raw === 'undefined' ||
    raw === 'null'
  ) {
    return '';
  }
  return raw;
}

export function isTmdbConfigured(): boolean {
  return Boolean(getTmdbToken());
}

export function tmdbImageUrl(
  filePath: string | null | undefined,
  size: 'w300' | 'w342' | 'w500' | 'w1280'
): string | null {
  if (!filePath) return null;
  if (filePath.startsWith('http') || filePath.startsWith('data:')) return filePath;
  return `${TMDB_IMG_BASE}/${size}${filePath}`;
}

export async function fetchTmdbRawJson(
  endpoint: string,
  params: Record<string, string> = {},
  fetchFn: typeof fetch = fetch
): Promise<unknown> {
  const token = getTmdbToken();
  if (!token) throw new Error('TMDB_READ_TOKEN_NOT_CONFIGURED');

  const isV3ApiKey = /^[a-f0-9]{32}$/i.test(token);
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  if (isV3ApiKey) {
    url.searchParams.set('api_key', token);
    const res = await fetchFn(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
    });
    if (!res.ok) throw new TmdbRequestError(res.status);
    return await res.json();
  }

  const res = await fetchFn(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
  });

  if (res.status === 401) {
    const fallbackUrl = new URL(url.toString());
    fallbackUrl.searchParams.set('api_key', token);
    const retryRes = await fetchFn(fallbackUrl.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
    });
    if (retryRes.ok) return await retryRes.json();
  }

  if (!res.ok) throw new TmdbRequestError(res.status);
  return await res.json();
}
