import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { AppStateSnapshot } from '../domain/types';
import { trackerStore } from './store';

const sameItems = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((item, index) => Object.is(item, b[index]));

/**
 * Read part of the synchronized state and re-render only when that part changes. A selector may return a
 * tuple of several slices; the tuple is compared item by item, so it does not need to be memoized.
 * Define selectors outside the component (or with `useCallback`) so the subscription is stable.
 */
export function useTrackerState<T>(selector: (state: AppStateSnapshot) => T): T {
  const cache = useRef<{ value: T } | null>(null);
  const getSnapshot = useCallback(() => {
    const value = selector(trackerStore.getState());
    const cached = cache.current;
    if (
      cached &&
      (Object.is(cached.value, value) ||
        (Array.isArray(cached.value) && Array.isArray(value) && sameItems(cached.value, value)))
    ) {
      return cached.value;
    }
    cache.current = { value };
    return value;
  }, [selector]);
  return useSyncExternalStore(trackerStore.subscribe, getSnapshot, getSnapshot);
}
