import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { Readable } from 'node:stream';

export class UnsafeUrlError extends Error {
  public readonly code: 'UNSAFE_URL' | 'UNRESOLVABLE_HOST';
  constructor(
    message: string,
    code: 'UNSAFE_URL' | 'UNRESOLVABLE_HOST' = 'UNSAFE_URL'
  ) {
    super(message);
    this.name = 'UnsafeUrlError';
    this.code = code;
  }
}

export type DnsLookupFn = (hostname: string) => Promise<Array<{ address: string }>>;
export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const defaultLookupFn: DnsLookupFn = (h) => dns.lookup(h, { all: true, verbatim: true });
// Resolve and validate inside the socket lookup itself: a second DNS answer
// cannot redirect a previously validated public hostname into the local network.
const defaultFetchFn: FetchFn = async (input, init = {}) => {
  const url = await assertSafePublicUrl(input);
  return new Promise<Response>((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https.request : http.request)(url, {
      method: init.method || 'GET',
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      signal: init.signal ?? undefined,
      lookup: (hostname, options, callback) => {
        dns.lookup(hostname, { all: true, verbatim: true }).then(records => {
          if (!records.length || records.some(record => isPrivateOrReservedIp(record.address))) {
            callback(new UnsafeUrlError('Connection resolved to a restricted address'), '');
            return;
          }
          const candidates = options.family ? records.filter(record => record.family === options.family) : records;
          if (!candidates.length) {
            callback(new UnsafeUrlError('No address for requested IP family', 'UNRESOLVABLE_HOST'), '');
            return;
          }
          callback(null, options.all ? candidates : candidates[0].address, candidates[0].family);
        }, err => callback(err, ''));
      },
    }, incoming => {
      try {
        const headers = new Headers();
        for (const [name, value] of Object.entries(incoming.headers)) {
          if (Array.isArray(value)) value.forEach(v => headers.append(name, v));
          else if (value !== undefined) headers.set(name, value);
        }
        const status = incoming.statusCode || 502;
        const noBody = init.method === 'HEAD' || [204, 205, 304].includes(status);
        if (noBody) incoming.resume();
        resolve(new Response(noBody ? null : Readable.toWeb(incoming) as ReadableStream<Uint8Array>, { status, headers }));
      } catch (err) {
        incoming.destroy();
        reject(err);
      }
    });
    request.on('error', reject);
    request.end();
  });
};

/**
 * Checks whether an IPv4 or IPv6 address is loopback, private, link-local,
 * unspecified, CGNAT, or multicast/reserved.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const trimmed = ip.trim().toLowerCase();

  // Handle IPv6 zone index (e.g. fe80::1%eth0)
  let cleanIp = trimmed.split('%')[0];
  if (net.isIP(cleanIp) === 6) cleanIp = new URL('http://[' + cleanIp + ']').hostname.slice(1, -1);

  const version = net.isIP(cleanIp);
  if (version === 4) {
    const parts = cleanIp.split('.').map((n) => Number.parseInt(n, 10));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b, c] = parts;
    // 0.0.0.0/8 (unspecified / current network)
    if (a === 0) return true;
    // 10.0.0.0/8 (private)
    if (a === 10) return true;
    // 100.64.0.0/10 (Carrier-Grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 127.0.0.0/8 (loopback)
    if (a === 127) return true;
    // 169.254.0.0/16 (link-local & cloud metadata 169.254.169.254)
    if (a === 169 && b === 254) return true;
    // 172.16.0.0/12 (private)
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.0.0.0/24 (IETF protocol assignments)
    if (a === 192 && b === 0 && c === 0) return true;
    // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
    if (a === 192 && b === 0 && c === 2) return true;
    if (a === 198 && b === 51 && c === 100) return true;
    if (a === 203 && b === 0 && c === 113) return true;
    // 192.168.0.0/16 (private)
    if (a === 192 && b === 168) return true;
    // 198.18.0.0/15 (benchmarking)
    if (a === 198 && (b === 18 || b === 19)) return true;
    // 224.0.0.0/4 (multicast) & 240.0.0.0/4 (reserved/broadcast)
    if (a >= 224) return true;

    return false;
  }

  if (version === 6) {
    if (cleanIp.startsWith('::ffff:')) {
      const v4Part = cleanIp.slice('::ffff:'.length);
      if (net.isIP(v4Part) === 4) {
        return isPrivateOrReservedIp(v4Part);
      }
      const hexParts = v4Part.split(':');
      if (hexParts.length === 2) {
        const hi = Number.parseInt(hexParts[0], 16);
        const lo = Number.parseInt(hexParts[1], 16);
        if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
          const reconstructed = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
          return isPrivateOrReservedIp(reconstructed);
        }
      }
      return true;
    }

    // Only global unicast; exclude documentation and transition ranges.
    return !/^[23][0-9a-f]{3}:/.test(cleanIp) ||
      /^(?:2001:db8:|2001:(?:0:|:)|2002:|3fff:)/.test(cleanIp);
  }

  return true;
}

/**
 * Validates that a URL uses http/https and that its hostname resolves
 * exclusively to public IP addresses. Throws UnsafeUrlError on violation.
 */
export async function assertSafePublicUrl(
  rawUrl: string,
  lookupFn: DnsLookupFn = defaultLookupFn
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('Invalid URL format', 'UNSAFE_URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeUrlError('Only http or https URLs are supported', 'UNSAFE_URL');
  }

  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError('URLs with embedded credentials are not allowed', 'UNSAFE_URL');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal'
  ) {
    throw new UnsafeUrlError('Access to localhost or internal hosts is forbidden', 'UNSAFE_URL');
  }

  if (net.isIP(hostname) !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new UnsafeUrlError(
        'Access to private, loopback, or link-local IP addresses is forbidden',
        'UNSAFE_URL'
      );
    }
    return parsed;
  }

  let records: Array<{ address: string }>;
  try {
    records = await lookupFn(hostname);
  } catch {
    throw new UnsafeUrlError('Could not resolve target hostname', 'UNRESOLVABLE_HOST');
  }

  if (!records || records.length === 0) {
    throw new UnsafeUrlError('Could not resolve target hostname', 'UNRESOLVABLE_HOST');
  }

  for (const rec of records) {
    if (isPrivateOrReservedIp(rec.address)) {
      throw new UnsafeUrlError(
        'Target hostname resolved to a private or restricted IP address',
        'UNSAFE_URL'
      );
    }
  }

  return parsed;
}

export interface SafeFetchOptions {
  maxRedirects?: number;
  lookupFn?: DnsLookupFn;
  fetchFn?: FetchFn;
}

/**
 * Fetches a URL while manually following up to `maxRedirects` redirects,
 * re-validating each hop's scheme, hostname, and resolved IP addresses against SSRF.
 */
export async function safeFetchFollowingRedirects(
  initialUrl: string,
  init: RequestInit = {},
  options: SafeFetchOptions | number = {}
): Promise<{ response: Response; finalUrl: string }> {
  const opts: SafeFetchOptions =
    typeof options === 'number' ? { maxRedirects: options } : options;
  const maxRedirects = opts.maxRedirects ?? 5;
  const lookupFn = opts.lookupFn ?? defaultLookupFn;
  const fetchFn = opts.fetchFn ?? defaultFetchFn;

  let currentUrlObj = await assertSafePublicUrl(initialUrl, lookupFn);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = await fetchFn(currentUrlObj.toString(), {
      ...init,
      redirect: 'manual',
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) {
        throw new UnsafeUrlError('Redirect response missing Location header', 'UNSAFE_URL');
      }
      if (hop === maxRedirects) {
        throw new UnsafeUrlError('Too many redirects', 'UNSAFE_URL');
      }
      const nextUrlStr = new URL(location, currentUrlObj).toString();
      currentUrlObj = await assertSafePublicUrl(nextUrlStr, lookupFn);
      continue;
    }

    return { response, finalUrl: currentUrlObj.toString() };
  }

  throw new UnsafeUrlError('Too many redirects', 'UNSAFE_URL');
}

/** Bound bytes while streaming, rather than buffering an entire untrusted response. */
export async function readResponseText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  try {
    while (bytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value.subarray(0, maxBytes - bytes);
      bytes += chunk.length;
      text += decoder.decode(chunk, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
