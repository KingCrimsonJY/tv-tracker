import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { AppStateSnapshot } from '../domain/types';
import { trackerStore } from './store';

const identity = (state: AppStateSnapshot) => state;
export function useTrackerSelection<T = AppStateSnapshot>(
  selector: (state: AppStateSnapshot) => T = identity as (state: AppStateSnapshot) => T,
): T {
  const cache = useRef<{ value: T } | null>(null);
  const getSnapshot = useCallback(() => {
    const value = selector(trackerStore.getState());
    const old = cache.current?.value;
    if (
      cache.current &&
      (Object.is(old, value) ||
        (Array.isArray(old) &&
          Array.isArray(value) &&
          old.length === value.length &&
          old.every((item, index) => Object.is(item, value[index]))))
    )
      return cache.current.value;
    cache.current = { value };
    return value;
  }, [selector]);
  return useSyncExternalStore(trackerStore.subscribe, getSnapshot, getSnapshot);
}
