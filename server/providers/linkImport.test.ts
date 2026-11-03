import assert from 'node:assert/strict';
import { test } from 'vitest';
import { UnsafeUrlError, type DnsLookupFn, type FetchFn } from '../security/ssrf.ts';
import { isHostOrSubdomain, resolveLinkMetadata } from './linkImport.ts';

const mockPublicDns: DnsLookupFn = async (hostname) => {
  if (hostname === 'internal.corp') {
    return [{ address: '10.0.0.42' }];
  }
  return [{ address: '93.184.216.34' }];
};

const mockFetch: FetchFn = async (input) => {
  const url = String(input);

  // YouTube oEmbed fixture
  if (url.startsWith('https://www.youtube.com/oembed')) {
    return new Response(
      JSON.stringify({
        title: '💥 Part one: Billy Elliot The Musical is back! 💥',
        author_name: 'The Royal Ballet School',
        thumbnail_url: 'https://i.ytimg.com/vi/KdyJYuKT44M/hqdefault.jpg',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Bilibili b23.tv redirect fixture
  if (url === 'https://b23.tv/abc123') {
    return new Response(null, {
      status: 302,
      headers: { Location: 'https://www.bilibili.com/video/BV1aFXaYmEFt/' },
    });
  }

  // Bilibili web-interface API fixture
  if (url.startsWith('https://api.bilibili.com/x/web-interface/view?bvid=BV1aFXaYmEFt')) {
    return new Response(
      JSON.stringify({
        code: 0,
        data: {
          title: '这就是全网吹的1000以内音质吊打的oppo enco x3啊？我TM想骂人',
          pic: 'http://i0.hdslb.com/bfs/archive/526dd045023c31ec1b12df96f99bfe7d74025e86.jpg',
          desc: '-',
          owner: { name: '爱乐堂堂' },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Generic Open Graph HTML fixture with relative og:image
  if (url === 'https://example.com/movies/solaris') {
    const html = `<!doctype html>
      <html>
        <head>
          <title>Solaris (1972)</title>
          <meta property="og:title" content="飞向太空 Solaris &amp; Co." />
          <meta property="og:description" content="塔可夫斯基科幻经典" />
          <meta property="og:image" content="/assets/posters/solaris.jpg" />
        </head>
        <body>Hello</body>
      </html>`;
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Large streaming HTML (> 512 KB) to test 512 KB cap
  if (url === 'https://example.com/huge') {
    const head = `<head><meta property="og:title" content="Huge Page Title" /><meta property="og:image" content="relative/poster.png" /></head>`;
    const padding = 'A'.repeat(700 * 1024);
    return new Response(head + padding, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Malicious redirect to private IP
  if (url === 'https://example.com/evil-redirect') {
    return new Response(null, {
      status: 302,
      headers: { Location: 'http://127.0.0.1:8080/internal' },
    });
  }

  return new Response('Not Found', { status: 404 });
};

test('isHostOrSubdomain matches exact domain or subdomain only, never substring', () => {
  assert.equal(isHostOrSubdomain('youtube.com', 'youtube.com'), true);
  assert.equal(isHostOrSubdomain('www.youtube.com', 'youtube.com'), true);
  assert.equal(isHostOrSubdomain('m.youtube.com', 'youtube.com'), true);
  assert.equal(isHostOrSubdomain('notyoutube.com', 'youtube.com'), false);
  assert.equal(isHostOrSubdomain('youtube.com.evil.org', 'youtube.com'), false);
  assert.equal(isHostOrSubdomain('bilibili.com', 'bilibili.com'), true);
  assert.equal(isHostOrSubdomain('www.bilibili.com', 'bilibili.com'), true);
  assert.equal(isHostOrSubdomain('fakebilibili.com', 'bilibili.com'), false);
});

test('linkImport: resolves YouTube video with tracking params offline', async () => {
  const result = await resolveLinkMetadata(
    'https://www.youtube.com/watch?v=KdyJYuKT44M&pp=ugUEEgJlbg%3D%3D',
    { lookupFn: mockPublicDns, fetchFn: mockFetch }
  );
  assert.equal(result.title, '💥 Part one: Billy Elliot The Musical is back! 💥');
  assert.equal(result.posterUrl, 'https://i.ytimg.com/vi/KdyJYuKT44M/hqdefault.jpg');
  assert.equal(result.overview, 'YouTube · The Royal Ballet School');
  assert.equal(result.sourceUrl, 'https://www.youtube.com/watch?v=KdyJYuKT44M');
  assert.equal(result.suggestedMediaType, 'other');
});

test('linkImport: resolves YouTube youtu.be short url offline', async () => {
  const result = await resolveLinkMetadata('https://youtu.be/KdyJYuKT44M', {
    lookupFn: mockPublicDns,
    fetchFn: mockFetch,
  });
  assert.equal(result.title, '💥 Part one: Billy Elliot The Musical is back! 💥');
  assert.equal(result.posterUrl, 'https://i.ytimg.com/vi/KdyJYuKT44M/hqdefault.jpg');
  assert.equal(result.sourceUrl, 'https://www.youtube.com/watch?v=KdyJYuKT44M');
});

test('linkImport: resolves Bilibili BV video url and b23.tv short url offline', async () => {
  const result = await resolveLinkMetadata('https://www.bilibili.com/video/BV1aFXaYmEFt/', {
    lookupFn: mockPublicDns,
    fetchFn: mockFetch,
  });
  assert.equal(result.title, '这就是全网吹的1000以内音质吊打的oppo enco x3啊？我TM想骂人');
  assert.equal(
    result.posterUrl,
    'https://i0.hdslb.com/bfs/archive/526dd045023c31ec1b12df96f99bfe7d74025e86.jpg'
  );
  assert.equal(result.overview, 'UP主：爱乐堂堂');
  assert.equal(result.sourceUrl, 'https://www.bilibili.com/video/BV1aFXaYmEFt/');

  const shortResult = await resolveLinkMetadata('https://b23.tv/abc123', {
    lookupFn: mockPublicDns,
    fetchFn: mockFetch,
  });
  assert.equal(shortResult.title, '这就是全网吹的1000以内音质吊打的oppo enco x3啊？我TM想骂人');
});

test('linkImport: resolves Open Graph tags, relative og:image, and streams max 512 KB offline', async () => {
  const ogResult = await resolveLinkMetadata('https://example.com/movies/solaris', {
    lookupFn: mockPublicDns,
    fetchFn: mockFetch,
  });
  assert.equal(ogResult.title, '飞向太空 Solaris & Co.');
  assert.equal(ogResult.overview, '塔可夫斯基科幻经典');
  assert.equal(ogResult.posterUrl, 'https://example.com/assets/posters/solaris.jpg');

  const hugeResult = await resolveLinkMetadata('https://example.com/huge', {
    lookupFn: mockPublicDns,
    fetchFn: mockFetch,
  });
  assert.equal(hugeResult.title, 'Huge Page Title');
  assert.equal(hugeResult.posterUrl, 'https://example.com/relative/poster.png');
});

test('linkImport: throws UnsafeUrlError for private/loopback IPs, redirects, and bad schemes', async () => {
  await assert.rejects(
    async () => {
      await resolveLinkMetadata('http://127.0.0.1:8080/secret', {
        lookupFn: mockPublicDns,
        fetchFn: mockFetch,
      });
    },
    (err: unknown) => err instanceof UnsafeUrlError
  );

  await assert.rejects(
    async () => {
      await resolveLinkMetadata('http://169.254.169.254/computeMetadata/v1/', {
        lookupFn: mockPublicDns,
        fetchFn: mockFetch,
      });
    },
    (err: unknown) => err instanceof UnsafeUrlError
  );

  await assert.rejects(
    async () => {
      await resolveLinkMetadata('https://internal.corp/admin', {
        lookupFn: mockPublicDns,
        fetchFn: mockFetch,
      });
    },
    (err: unknown) => err instanceof UnsafeUrlError
  );

  await assert.rejects(
    async () => {
      await resolveLinkMetadata('https://example.com/evil-redirect', {
        lookupFn: mockPublicDns,
        fetchFn: mockFetch,
      });
    },
    (err: unknown) => err instanceof UnsafeUrlError
  );

  await assert.rejects(
    async () => {
      await resolveLinkMetadata('ftp://example.com/file', {
        lookupFn: mockPublicDns,
        fetchFn: mockFetch,
      });
    },
    (err: unknown) => err instanceof UnsafeUrlError
  );
});
