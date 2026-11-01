import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Checks whether an IPv4 or IPv6 address is loopback, private, link-local,
 * unspecified, CGNAT, or multicast/reserved.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const trimmed = ip.trim().toLowerCase();

  // Handle IPv6 zone index (e.g. fe80::1%eth0)
  const cleanIp = trimmed.split('%')[0];

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
    // Loopback ::1 or unspecified ::
    if (
      cleanIp === '::1' ||
      cleanIp === '::' ||
      cleanIp === '0:0:0:0:0:0:0:1' ||
      cleanIp === '0:0:0:0:0:0:0:0'
    ) {
      return true;
    }

    // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
    if (cleanIp.startsWith('::ffff:')) {
      const v4Part = cleanIp.slice('::ffff:'.length);
      if (net.isIP(v4Part) === 4) {
        return isPrivateOrReservedIp(v4Part);
      }
      // Hex form ::ffff:7f00:0001
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

    // Unique local fc00::/7 (fc00... or fd00...)
    if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd')) {
      return true;
    }

    // Link-local fe80::/10 (fe8, fe9, fea, feb)
    if (
      cleanIp.startsWith('fe8') ||
      cleanIp.startsWith('fe9') ||
      cleanIp.startsWith('fea') ||
      cleanIp.startsWith('feb')
    ) {
      return true;
    }

    // Multicast ff00::/8
    if (cleanIp.startsWith('ff')) {
      return true;
    }

    return false;
  }

  // Invalid IP format -> reject
  return true;
}

/**
 * Validates that a URL uses http/https and that its hostname resolves
 * exclusively to public IP addresses.
 */
export async function assertSafePublicUrl(
  rawUrl: string,
  lookupFn: (hostname: string) => Promise<Array<{ address: string }>> = (h) =>
    dns.lookup(h, { all: true, verbatim: true })
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('无效的链接格式');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('仅支持 http 或 https 协议的链接');
  }

  if (parsed.username || parsed.password) {
    throw new Error('不支持包含认证信息的链接');
  }

  // Strip IPv6 brackets if present
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal'
  ) {
    throw new Error('禁止访问内网或本地主机地址');
  }

  // Direct IP literal in URL
  if (net.isIP(hostname) !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error('禁止访问私有、环回或链路本地 IP 地址');
    }
    return parsed;
  }

  // Resolve DNS records and verify every resolved IP
  let records: Array<{ address: string }>;
  try {
    records = await lookupFn(hostname);
  } catch {
    throw new Error('无法解析目标域名');
  }

  if (!records || records.length === 0) {
    throw new Error('无法解析目标域名');
  }

  for (const rec of records) {
    if (isPrivateOrReservedIp(rec.address)) {
      throw new Error('目标域名解析为私有或受限 IP 地址，已拒绝访问');
    }
  }

  return parsed;
}

/**
 * Fetches a URL while manually following up to `maxRedirects` redirects,
 * re-validating each hop's scheme, hostname, and resolved IP addresses against SSRF.
 */
export async function safeFetchFollowingRedirects(
  initialUrl: string,
  init: RequestInit = {},
  maxRedirects = 5
): Promise<{ response: Response; finalUrl: string }> {
  let currentUrlObj = await assertSafePublicUrl(initialUrl);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = await fetch(currentUrlObj.toString(), {
      ...init,
      redirect: 'manual',
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('重定向缺少目标地址');
      }
      if (hop === maxRedirects) {
        throw new Error('重定向次数过多');
      }
      const nextUrlStr = new URL(location, currentUrlObj).toString();
      currentUrlObj = await assertSafePublicUrl(nextUrlStr);
      continue;
    }

    return { response, finalUrl: currentUrlObj.toString() };
  }

  throw new Error('重定向次数过多');
}
