import { useEffect } from 'react';
import { apiFetch } from '../data/api.ts';
import type { StateMutationResult } from '../domain/types.ts';

const SSE_WATCHDOG_TIMEOUT_MS = 15_000;
const OFFLINE_OVERLAY_DELAY_MS = 5_000;

export function useSseEventStream(params: {
  authenticated: boolean;
  reconnectTrigger: number;
  /** The session ended on the server (expired, or signed out from another device). */
  onSignedOut: () => void;
  setServerUnreachable: (val: boolean) => void;
  applyServerMutation: (mutation: StateMutationResult) => void;
  refreshStateFromServer: () => Promise<void>;
}): void {
  const {
    authenticated,
    reconnectTrigger,
    onSignedOut,
    setServerUnreachable,
    applyServerMutation,
    refreshStateFromServer,
  } = params;

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    let connected = false;
    let abortController: AbortController | null = null;
    let offlineTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

    const clearWatchdog = () => {
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
    };
    const resetWatchdog = () => {
      clearWatchdog();
      if (!cancelled) {
        watchdogTimer = setTimeout(() => {
          if (!cancelled) abortController?.abort();
        }, SSE_WATCHDOG_TIMEOUT_MS);
      }
    };
    const startOfflineCountdown = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setServerUnreachable(true);
        return;
      }
      if (!offlineTimer && !cancelled) {
        offlineTimer = setTimeout(() => {
          if (!cancelled) setServerUnreachable(true);
        }, OFFLINE_OVERLAY_DELAY_MS);
      }
    };
    const clearOfflineCountdown = () => {
      if (offlineTimer) {
        clearTimeout(offlineTimer);
        offlineTimer = null;
      }
      if (!cancelled && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
        setServerUnreachable(false);
      }
    };

    const connectEventStream = async () => {
      if (cancelled) return;
      abortController = new AbortController();
      resetWatchdog();
      try {
        const res = await apiFetch('/api/events', {
          signal: abortController.signal,
          headers: { Accept: 'text/event-stream' },
        });
        if (res.status === 401) {
          clearWatchdog();
          if (!cancelled) onSignedOut();
          return;
        }
        if (!res.ok || !res.body) throw new Error(`SSE HTTP ${res.status}`);

        // Response headers alone do not prove the stream works: a proxy can answer 200 and then deliver
        // nothing. The server sends a checkpoint event immediately, so only received bytes (below) cancel
        // the offline countdown; a silent stream runs into the watchdog and is reported as unreachable.
        resetWatchdog();
        if (connected || reconnectTrigger > 0) await refreshStateFromServer();
        connected = true;

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          clearOfflineCountdown();
          resetWatchdog();

          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() || '';
          for (const block of blocks) {
            for (const line of block.split('\n')) {
              if (line.startsWith('data:')) {
                const jsonStr = line.slice(5).trim();
                if (!jsonStr) continue;
                try {
                  applyServerMutation(JSON.parse(jsonStr) as StateMutationResult);
                } catch {
                  // ignore malformed event
                }
              }
            }
          }
        }
        clearWatchdog();
        if (!cancelled) {
          startOfflineCountdown();
          retryTimer = setTimeout(() => connectEventStream(), 1500);
        }
      } catch {
        clearWatchdog();
        if (!cancelled) {
          startOfflineCountdown();
          retryTimer = setTimeout(() => connectEventStream(), 2000);
        }
      }
    };

    void connectEventStream();
    return () => {
      cancelled = true;
      clearWatchdog();
      abortController?.abort();
      if (offlineTimer) clearTimeout(offlineTimer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [authenticated, reconnectTrigger, onSignedOut, setServerUnreachable, applyServerMutation, refreshStateFromServer]);
}
