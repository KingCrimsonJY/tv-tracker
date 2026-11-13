import http from 'node:http';
import net from 'node:net';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { buildYtdlpArgs, resolveWithYtdlp, type YtdlpExecFn } from '../providers/ytdlp.ts';
import { type EgressProxy, hasOperatorProxy, startEgressProxy } from './egressProxy.ts';
import type { DnsLookupFn } from './ssrf.ts';

const publicDns: DnsLookupFn = async (hostname) =>
  hostname === 'intranet.example' ? [{ address: '10.0.0.7' }] : [{ address: '93.184.216.34' }];

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  vi.unstubAllEnvs();
});

const portOf = (server: net.Server) => (server.address() as net.AddressInfo).port;
const listen = <T extends net.Server>(server: T): Promise<T> =>
  new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      cleanups.push(() => new Promise<void>((done) => server.close(() => done())));
      resolve(server);
    });
  });

/** Stands in for a public site: the proxy validates the name, the test decides where the bytes really go. */
async function proxyInFrontOf(upstream: net.Server): Promise<EgressProxy> {
  const proxy = await startEgressProxy({
    lookupFn: publicDns,
    connect: () => net.connect({ host: '127.0.0.1', port: portOf(upstream) }),
  });
  cleanups.push(proxy.close);
  return proxy;
}

function get(proxy: EgressProxy, url: string): Promise<{ status: number; location?: string; body: string }> {
  return new Promise((resolve, reject) => {
    const { hostname, port } = new URL(proxy.url);
    const host = URL.canParse(url) ? new URL(url).host : hostname;
    const req = http.request({ host: hostname, port, path: url, headers: { host } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, location: res.headers.location, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

function connect(proxy: EgressProxy, target: string): Promise<{ status: number; socket: net.Socket }> {
  return new Promise((resolve, reject) => {
    const { hostname, port } = new URL(proxy.url);
    const req = http.request({ host: hostname, port, method: 'CONNECT', path: target });
    req.on('connect', (res, socket) => {
      cleanups.push(() => void socket.destroy());
      resolve({ status: res.statusCode ?? 0, socket });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('egress proxy for yt-dlp', () => {
  test('a redirect is handed back, and the loopback address it points to is refused', async () => {
    const seen: string[] = [];
    const upstream = await listen(
      http.createServer((req, res) => {
        seen.push(req.url ?? '');
        if (req.url === '/redirect') res.writeHead(302, { location: 'http://127.0.0.1:8080/internal' }).end();
        else res.end('public page');
      }),
    );
    const proxy = await proxyInFrontOf(upstream);

    expect(await get(proxy, 'http://video.example/watch')).toMatchObject({ status: 200, body: 'public page' });
    const redirect = await get(proxy, 'http://video.example/redirect');
    expect(redirect).toMatchObject({ status: 302, location: 'http://127.0.0.1:8080/internal' });
    // What yt-dlp does next: ask for the new location, again through the proxy.
    expect((await get(proxy, redirect.location ?? '')).status).toBe(403);
    expect(seen).toEqual(['/watch', '/redirect']);
  });

  test.each([
    'http://127.0.0.1/',
    'http://localhost:3000/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://192.168.1.1/',
    'http://intranet.example/',
    '/relative',
  ])('refuses a plain request for %s', async (url) => {
    const proxy = await proxyInFrontOf(await listen(http.createServer((_req, res) => res.end('reached'))));
    expect(await get(proxy, url)).toMatchObject({ status: 403, body: '' });
  });

  test.each([
    '127.0.0.1:443',
    'localhost:443',
    '169.254.169.254:80',
    '[::1]:443',
    '10.1.2.3:443',
    'intranet.example:443',
  ])('refuses a tunnel to %s', async (target) => {
    const proxy = await proxyInFrontOf(await listen(net.createServer((socket) => socket.end('reached'))));
    expect((await connect(proxy, target)).status).toBe(403);
  });

  test('tunnels to a public host', async () => {
    const echo = await listen(net.createServer((socket) => socket.pipe(socket)));
    const proxy = await proxyInFrontOf(echo);
    const { status, socket } = await connect(proxy, 'video.example:443');
    expect(status).toBe(200);
    const reply = new Promise<string>((resolve) => socket.once('data', (chunk) => resolve(String(chunk))));
    socket.write('ping');
    expect(await reply).toBe('ping');
  });

  test('a name that is public when checked and private when connected to is not reached', async () => {
    // DNS rebinding: the first answer passes validation, the second is what the socket would connect to.
    let answers = 0;
    const proxy = await startEgressProxy({
      lookupFn: async () => [{ address: answers++ === 0 ? '93.184.216.34' : '127.0.0.1' }],
    });
    cleanups.push(proxy.close);
    expect((await connect(proxy, 'rebind.example:443')).status).toBe(502);
  });

  test('an operator proxy in the environment is recognised in either case', () => {
    expect(hasOperatorProxy({})).toBe(false);
    expect(hasOperatorProxy({ ALL_PROXY: '  ' })).toBe(false);
    expect(hasOperatorProxy({ HTTPS_PROXY: 'http://10.0.0.1:7890' })).toBe(true);
    expect(hasOperatorProxy({ all_proxy: 'socks5://10.0.0.1:1080' })).toBe(true);
  });
});

describe('yt-dlp is always sent through the proxy', () => {
  const run = async (options: { egressProxyUrl?: string | null } = {}) => {
    let args: readonly string[] = [];
    const execFn: YtdlpExecFn = async (_file, given) => {
      args = given;
      return { stdout: '', stderr: '' };
    };
    await resolveWithYtdlp('https://video.example/watch?v=1', { execFn, lookupFn: publicDns, ...options }).catch(
      () => {},
    );
    return args;
  };

  test('the proxy option comes before the link, which stays the last argument', () => {
    const args = buildYtdlpArgs('https://video.example/watch?v=1', 'http://127.0.0.1:4000');
    expect(args.slice(args.indexOf('--proxy'), args.indexOf('--proxy') + 2)).toEqual([
      '--proxy',
      'http://127.0.0.1:4000',
    ]);
    expect(args.slice(-2)).toEqual(['--', 'https://video.example/watch?v=1']);
    expect(buildYtdlpArgs('https://video.example/watch?v=1')).not.toContain('--proxy');
  });

  test('by default it gets the loopback proxy; with an operator proxy it is left to that one', async () => {
    for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy']) {
      vi.stubEnv(name, '');
    }
    const args = await run();
    expect(args[args.indexOf('--proxy') + 1]).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    vi.stubEnv('HTTPS_PROXY', 'http://10.0.0.1:7890');
    expect(await run()).not.toContain('--proxy');
  });
});
