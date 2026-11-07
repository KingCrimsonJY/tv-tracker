import { useCallback, useLayoutEffect, useRef } from 'react';
export function useStableCallback<T extends unknown[]>(callback: (...args: T) => void): (...args: T) => void {
  const current = useRef(callback);
  useLayoutEffect(() => {
    current.current = callback;
  }, [callback]);
  return useCallback((...args: T) => current.current(...args), []);
}
