import { useCallback, useRef, useState } from 'react';

/**
 * Track an async confirm action for a HeroUI Button's `isPending`. Repeated presses while the action
 * runs are ignored, so a double tap on "Delete" or "Import" cannot send the request twice.
 */
export function usePendingAction(): [boolean, (action: () => Promise<unknown> | unknown) => Promise<void>] {
  const running = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const run = useCallback(async (action: () => Promise<unknown> | unknown) => {
    if (running.current) return;
    running.current = true;
    setIsPending(true);
    try {
      await action();
    } finally {
      running.current = false;
      setIsPending(false);
    }
  }, []);
  return [isPending, run];
}
