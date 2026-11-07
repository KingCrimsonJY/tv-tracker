import { afterEach, expect, test, vi } from 'vitest';
import { useEffect } from 'react';
import * as api from '../data/api.ts';
import { useSseEventStream } from './useSseEventStream.ts';
vi.mock('react', () => ({ useEffect: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });
test('the first SSE connection reconciles state before consuming events', async () => {
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  vi.spyOn(api, 'apiFetch').mockResolvedValue(new Response(new ReadableStream({ start(controller) { streamController = controller; } })));
  const refresh = vi.fn().mockResolvedValue(undefined);
  useSseEventStream({ authenticated: true, reconnectTrigger: 0, setAuthenticated: vi.fn(), setServerUnreachable: vi.fn(), applyServerMutation: vi.fn(), refreshStateFromServer: refresh });
  const effect = vi.mocked(useEffect).mock.calls[0]?.[0];
  const cleanup = effect?.();
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  if (typeof cleanup === 'function') cleanup();
  streamController?.close();
});
