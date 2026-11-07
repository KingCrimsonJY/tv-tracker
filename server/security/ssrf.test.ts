import assert from 'node:assert/strict';
import { test, expect, vi } from 'vitest';
import http from 'node:http';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { resolveLinkMetadata } from '../providers/linkImport.ts';
import { type YtdlpExecFn, YtdlpExecutionError } from '../providers/ytdlp.ts';
import {
  assertSafePublicUrl,
  type DnsLookupFn,
  type FetchFn,
  isPrivateOrReservedIp,
  safeFetchFollowingRedirects,
  UnsafeUrlError,
} from './ssrf.ts';

const mockPublicDns: DnsLookupFn = async (hostname) => {
  if (hostname === 'internal.corp') {
    return [{ address: '10.0.0.42' }];
  }
  return [{ address: '93.184.216.34' }];
};

const mockFetch: FetchFn = async (input) => {
  const url = String(input);
  if (url === 'https://example.com/evil-redirect') {
    return new Response(null, {
      status: 302,
      headers: { Location: 'http://127.0.0.1:8080/internal' },
    });
  }
  return new Response('Not Found', { status: 404 });
};

test('1. isPrivateOrReservedIp identifies private, loopback, link-local, and IPv4-mapped IPv6 addresses', () => {
  assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('10.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('172.16.5.4'), true);
  assert.equal(isPrivateOrReservedIp('192.168.1.1'), true);
  assert.equal(isPrivateOrReservedIp('169.254.169.254'), true);
  assert.equal(isPrivateOrReservedIp('::1'), true);
  assert.equal(isPrivateOrReservedIp('fe80::1'), true);
  assert.equal(isPrivateOrReservedIp('fc00::1'), true);
  assert.equal(isPrivateOrReservedIp('::ffff:127.0.0.1'), true);
  assert.equal(isPrivateOrReservedIp('93.184.216.34'), false);
});

test('2. assertSafePublicUrl rejects non-http protocols and private/reserved DNS resolutions', async () => {
  await assert.rejects(
    () => assertSafePublicUrl('file:///etc/passwd'),
    (err: unknown) => err instanceof UnsafeUrlError,
  );
  await assert.rejects(
    () => assertSafePublicUrl('http://127.0.0.1:8080/test'),
    (err: unknown) => err instanceof UnsafeUrlError,
  );
  await assert.rejects(
    () => assertSafePublicUrl('http://169.254.169.254/latest/meta-data/'),
    (err: unknown) => err instanceof UnsafeUrlError,
  );
  await assert.rejects(
    () => assertSafePublicUrl('https://evil.example.com/video', async () => [{ address: '10.1.2.3' }]),
    (err: unknown) => err instanceof UnsafeUrlError,
  );

  const valid = await assertSafePublicUrl('https://www.bilibili.com/video/BV1xx411c7mD', async () => [
    { address: '93.184.216.34' },
  ]);
  assert.equal(valid.hostname, 'www.bilibili.com');
});

test('3. safeFetchFollowingRedirects and resolveLinkMetadata reject private/loopback IPs, evil redirects, and non-http schemes before running yt-dlp', async () => {
  await assert.rejects(
    () =>
      safeFetchFollowingRedirects(
        'https://example.com/evil-redirect',
        {},
        { lookupFn: mockPublicDns, fetchFn: mockFetch },
      ),
    (err: unknown) => err instanceof UnsafeUrlError,
  );

  let ytdlpCalled = false;
  const execFn: YtdlpExecFn = async () => {
    ytdlpCalled = true;
    return { stdout: '{}', stderr: '' };
  };

  for (const unsafeInput of [
    'http://127.0.0.1:8080/secret',
    'http://169.254.169.254/computeMetadata/v1/',
    'https://internal.corp/admin',
    'ftp://example.com/file',
  ]) {
    await assert.rejects(
      async () => {
        await resolveLinkMetadata(unsafeInput, {
          lookupFn: mockPublicDns,
          fetchFn: mockFetch,
          execFn,
        });
      },
      (err: unknown) => err instanceof UnsafeUrlError,
    );
  }
  assert.equal(ytdlpCalled, false);

  const execFail: YtdlpExecFn = async () => {
    throw new YtdlpExecutionError('unsupported url');
  };
  await assert.rejects(
    async () => {
      await resolveLinkMetadata('https://example.com/evil-redirect', {
        lookupFn: mockPublicDns,
        fetchFn: mockFetch,
        execFn: execFail,
      });
    },
    (err: unknown) => err instanceof UnsafeUrlError,
  );
});

test('an unsupported upstream HTTP status rejects without an uncaught response callback error', async () => {
  const incoming = new Readable({ read() {} }) as http.IncomingMessage;
  incoming.statusCode = 600;
  incoming.headers = {};
  const request = new EventEmitter() as http.ClientRequest;
  const spy = vi.spyOn(http, 'request').mockImplementation((...args) => {
    const callback = args.at(-1) as (response: http.IncomingMessage) => void;
    request.end = (() => {
      queueMicrotask(() => callback(incoming));
      return request;
    }) as typeof request.end;
    return request;
  });
  try {
    await expect(safeFetchFollowingRedirects('http://93.184.216.34/')).rejects.toThrow();
    expect(incoming.destroyed).toBe(true);
  } finally {
    spy.mockRestore();
    incoming.destroy();
  }
});
