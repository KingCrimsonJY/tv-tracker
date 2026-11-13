import { afterEach, expect, test, vi } from 'vitest';
import { subscribeToDayChange } from './useToday.ts';

afterEach(() => vi.useRealTimers());

test('subscribers hear about the new local day at midnight, once per day, until they unsubscribe', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 13, 23, 59, 58));
  const listener = vi.fn();
  const unsubscribe = subscribeToDayChange(listener);

  vi.advanceTimersByTime(1000);
  expect(listener).not.toHaveBeenCalled();
  vi.advanceTimersByTime(2000);
  expect(listener).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(24 * 60 * 60 * 1000);
  expect(listener).toHaveBeenCalledTimes(2);

  unsubscribe();
  vi.advanceTimersByTime(48 * 60 * 60 * 1000);
  expect(listener).toHaveBeenCalledTimes(2);
});
