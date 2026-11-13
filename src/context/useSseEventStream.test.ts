import { afterEach, expect, test, vi } from 'vitest';
import { useEffect } from 'react';
import * as api from '../data/api.ts';
import { useSseEventStream } from './useSseEventStream.ts';
vi.mock('react', () => ({ useEffect: vi.fn() }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
test.each([0, 1])(
  'SSE connects with reconnect trigger %s and reconciles only on reconnect',
  async (reconnectTrigger) => {
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    vi.spyOn(api, 'apiFetch').mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            streamController = controller;
          },
        }),
      ),
    );
    const refresh = vi.fn().mockResolvedValue(undefined);
    useSseEventStream({
      authenticated: true,
      reconnectTrigger,
      onSignedOut: vi.fn(),
      setServerUnreachable: vi.fn(),
      applyServerMutation: vi.fn(),
      refreshStateFromServer: refresh,
    });
    const effect = vi.mocked(useEffect).mock.calls[0]?.[0];
    const cleanup = effect?.();
    await vi.waitFor(() => expect(api.apiFetch).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(reconnectTrigger ? 1 : 0);
    if (typeof cleanup === 'function') cleanup();
    streamController?.close();
  },
);

test('a stream that answers 200 but never delivers a byte is reported as unreachable', async () => {
  vi.useFakeTimers();
  try {
    // Like a proxy that accepts the connection and then stays silent: headers arrive, data never does.
    vi.spyOn(api, 'apiFetch').mockImplementation(
      async (_input, init) =>
        new Response(
          new ReadableStream({
            start(controller) {
              init?.signal?.addEventListener('abort', () => controller.error(new Error('aborted')));
            },
          }),
        ),
    );
    const setServerUnreachable = vi.fn();
    useSseEventStream({
      authenticated: true,
      reconnectTrigger: 0,
      onSignedOut: vi.fn(),
      setServerUnreachable,
      applyServerMutation: vi.fn(),
      refreshStateFromServer: vi.fn().mockResolvedValue(undefined),
    });
    const cleanup = vi.mocked(useEffect).mock.calls.at(-1)?.[0]();

    // 15 s watchdog, then the 5 s offline countdown; reconnecting meanwhile must not cancel it.
    await vi.advanceTimersByTimeAsync(15_000 + 5_000 + 500);
    expect(vi.mocked(api.apiFetch).mock.calls.length).toBeGreaterThan(1);
    expect(setServerUnreachable).toHaveBeenLastCalledWith(true);
    expect(setServerUnreachable).not.toHaveBeenCalledWith(false);
    if (typeof cleanup === 'function') cleanup();
  } finally {
    vi.useRealTimers();
  }
});

test('received data cancels the offline countdown', async () => {
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  vi.spyOn(api, 'apiFetch').mockResolvedValue(
    new Response(
      new ReadableStream({
        start(controller) {
          streamController = controller;
        },
      }),
    ),
  );
  const setServerUnreachable = vi.fn();
  const applyServerMutation = vi.fn();
  useSseEventStream({
    authenticated: true,
    reconnectTrigger: 0,
    onSignedOut: vi.fn(),
    setServerUnreachable,
    applyServerMutation,
    refreshStateFromServer: vi.fn().mockResolvedValue(undefined),
  });
  const cleanup = vi.mocked(useEffect).mock.calls.at(-1)?.[0]();
  await vi.waitFor(() => expect(api.apiFetch).toHaveBeenCalledTimes(1));
  expect(setServerUnreachable).not.toHaveBeenCalled();
  streamController?.enqueue(
    new TextEncoder().encode('data: {"checkpoint":true,"version":1,"upserts":{},"deletes":{}}\n\n'),
  );
  await vi.waitFor(() => expect(applyServerMutation).toHaveBeenCalledTimes(1));
  expect(setServerUnreachable).toHaveBeenLastCalledWith(false);
  if (typeof cleanup === 'function') cleanup();
  streamController?.close();
});
