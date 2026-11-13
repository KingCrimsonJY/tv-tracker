import http from 'node:http';
import net from 'node:net';
import { assertSafePublicUrl, createPublicOnlyLookup, type DnsLookupFn, UnsafeUrlError } from './ssrf.ts';

/**
 * A forward proxy on the loopback interface for programs this server runs but does not control (yt-dlp).
 * Such a program follows redirects and makes follow-up requests on its own, so validating the link it is
 * handed is not enough. Pointed at this proxy, every connection it opens is held to the rule the server's
 * own requests follow: public addresses only, checked again against the address actually connected to.
 */
export interface EgressProxy {
  url: string;
  close: () => Promise<void>;
}

export interface EgressProxyOptions {
  lookupFn?: DnsLookupFn;
  /** Opens the outbound connection. Tests replace it; the lookup it is given must be used. */
  connect?: (options: net.TcpNetConnectOpts) => net.Socket;
}

const IDLE_TIMEOUT_MS = 60_000;
const HOP_HEADERS = ['proxy-connection', 'proxy-authorization', 'proxy-authenticate'];

export function startEgressProxy(options: EgressProxyOptions = {}): Promise<EgressProxy> {
  const lookup = createPublicOnlyLookup(options.lookupFn);
  const connect = options.connect ?? ((opts) => net.connect(opts));
  const open = (host: string, port: number): net.Socket => {
    const socket = connect({ host, port, lookup });
    socket.setTimeout(IDLE_TIMEOUT_MS, () => socket.destroy());
    return socket;
  };
  const hostOf = (target: URL): string => target.hostname.replace(/^\[|\]$/g, '');
  // One connection per request, opened by `open` so that it gets the checking lookup.
  const agent = new http.Agent({ keepAlive: false });
  agent.createConnection = (opts) => open(String(opts.host), Number(opts.port));

  const server = http.createServer((req, res) => {
    // Plain http arrives as a request for an absolute URL.
    void (async () => {
      let target: URL;
      try {
        target = await assertSafePublicUrl(req.url ?? '', options.lookupFn);
        if (target.protocol !== 'http:') throw new UnsafeUrlError('Only plain http is forwarded as a request');
      } catch {
        res.writeHead(403).end();
        req.resume();
        return;
      }
      const headers = { ...req.headers };
      for (const name of HOP_HEADERS) delete headers[name];
      const upstream = http.request(
        {
          agent,
          host: hostOf(target),
          port: Number(target.port) || 80,
          method: req.method,
          path: target.pathname + target.search,
          headers,
        },
        (incoming) => {
          // Redirects are passed back untouched: the client asks for the new location through this proxy too.
          res.writeHead(incoming.statusCode ?? 502, incoming.headers);
          incoming.pipe(res);
        },
      );
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      req.pipe(upstream);
    })();
  });

  // https (and anything else tunnelled) arrives as CONNECT host:port.
  server.on('connect', (req, client: net.Socket, head: Buffer) => {
    client.on('error', () => {});
    void (async () => {
      let target: URL;
      try {
        target = await assertSafePublicUrl('https://' + (req.url ?? ''), options.lookupFn);
      } catch {
        client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
        return;
      }
      const upstream = open(hostOf(target), Number(target.port) || 443);
      let established = false;
      upstream.once('connect', () => {
        established = true;
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) upstream.write(head);
        upstream.pipe(client);
        client.pipe(upstream);
      });
      upstream.on('error', () => {
        // Before the tunnel is up the client is still waiting for an HTTP answer.
        if (established) client.destroy();
        else client.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      });
      upstream.on('close', () => {
        if (established) client.destroy();
      });
      client.on('close', () => upstream.destroy());
    })();
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      // The proxy alone must not keep the process alive.
      server.unref();
      const { port } = server.address() as net.AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
            server.closeAllConnections();
          }),
      });
    });
  });
}

/** An operator who sets a proxy for the process decides what leaves the machine; yt-dlp then uses that one. */
export function hasOperatorProxy(env: NodeJS.ProcessEnv = process.env): boolean {
  return ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY'].some(
    (name) => Boolean(env[name]?.trim()) || Boolean(env[name.toLowerCase()]?.trim()),
  );
}

let shared: Promise<EgressProxy> | undefined;

/** The address of the process-wide proxy, started on first use; null when the operator's own proxy is in force. */
export async function sharedEgressProxyUrl(): Promise<string | null> {
  if (hasOperatorProxy()) return null;
  shared ??= startEgressProxy();
  try {
    return (await shared).url;
  } catch (err) {
    shared = undefined;
    throw err;
  }
}
