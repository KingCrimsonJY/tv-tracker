import { expect, test, vi } from 'vitest';
import type { LinkImportResult } from '../../src/domain/types.ts';
vi.mock('./linkUrls.ts', () => ({
  normalizeLinkUrl: async (url: string) => url,
  isBangumiUrl: () => false,
}));
vi.mock('./bilibili.ts', () => ({ resolveBilibiliMetadata: vi.fn() }));
import { resolveBilibiliMetadata } from './bilibili.ts';
import { resolveLinkMetadata } from './linkImport.ts';

const result: LinkImportResult = {
  kind: 'video',
  title: 'Public video',
  sourceUrl: 'https://example.com/video',
  posterUrl: null,
  overview: '',
  year: 2024,
  runtimeMin: 10,
  episodes: [],
  fallbackUsed: 'bilibili',
};
test('cached metadata is isolated from caller changes and explicit refresh bypasses it', async () => {
  const provider = vi.mocked(resolveBilibiliMetadata).mockResolvedValue(result);
  const first = await resolveLinkMetadata('https://example.com/cache-isolation');
  first.title = 'Changed locally';
  const second = await resolveLinkMetadata('https://example.com/cache-isolation');
  expect(second.title).toBe('Public video');
  expect(provider).toHaveBeenCalledTimes(1);
  await resolveLinkMetadata('https://example.com/cache-isolation', { forceImport: true });
  expect(provider).toHaveBeenCalledTimes(2);
});
test('concurrent previews share one pending provider request', async () => {
  const provider = vi.mocked(resolveBilibiliMetadata).mockClear();
  let complete!: (value: LinkImportResult) => void;
  provider.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const first = resolveLinkMetadata('https://example.com/pending');
  const second = resolveLinkMetadata('https://example.com/pending');
  await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1));
  complete({ ...result, title: 'Shared result' });
  expect((await first).title).toBe('Shared result');
  expect((await second).title).toBe('Shared result');
});
