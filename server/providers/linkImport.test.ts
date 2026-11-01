import assert from 'node:assert/strict';
import nodeTest from 'node:test';
import { resolveLinkMetadata } from './linkImport.ts';

const vitestModule = process.env.VITEST ? await import('vitest') : null;
const registerTest: (name: string, fn: () => void | Promise<void>) => void =
  vitestModule ? vitestModule.test : (name, fn) => { nodeTest(name, fn); };

registerTest('linkImport: resolves YouTube video with tracking params', async () => {
  const result = await resolveLinkMetadata(
    'https://www.youtube.com/watch?v=KdyJYuKT44M&pp=ugUEEgJlbg%3D%3D'
  );
  assert.ok(result.title.length > 0);
  assert.ok(result.posterUrl?.includes('KdyJYuKT44M'));
  assert.equal(result.sourceUrl, 'https://www.youtube.com/watch?v=KdyJYuKT44M');
  assert.equal(result.suggestedMediaType, 'other');
});

registerTest('linkImport: resolves YouTube youtu.be short url', async () => {
  const result = await resolveLinkMetadata('https://youtu.be/KdyJYuKT44M');
  assert.ok(result.title.length > 0);
  assert.ok(result.posterUrl?.includes('KdyJYuKT44M'));
  assert.equal(result.sourceUrl, 'https://www.youtube.com/watch?v=KdyJYuKT44M');
});

registerTest('linkImport: resolves Bilibili BV video url', async () => {
  const result = await resolveLinkMetadata('https://www.bilibili.com/video/BV1aFXaYmEFt/');
  assert.ok(result.title.length > 0);
  assert.ok(result.posterUrl?.startsWith('https://'));
  assert.ok(result.sourceUrl.includes('BV1aFXaYmEFt'));
  assert.equal(result.suggestedMediaType, 'other');
});

registerTest('linkImport: rejects private or loopback IP targets', async () => {
  await assert.rejects(
    async () => {
      await resolveLinkMetadata('http://127.0.0.1:8080/secret');
    },
    /禁止访问|私有或受限/
  );

  await assert.rejects(
    async () => {
      await resolveLinkMetadata('http://169.254.169.254/computeMetadata/v1/');
    },
    /禁止访问|私有或受限/
  );
});

registerTest('linkImport: rejects non-http protocols', async () => {
  await assert.rejects(
    async () => {
      await resolveLinkMetadata('ftp://example.com/file');
    },
    /协议/
  );
});
