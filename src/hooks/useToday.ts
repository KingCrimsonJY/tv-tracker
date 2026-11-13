import { useSyncExternalStore } from 'react';
import { toLocalDateString } from '../domain/airing';

/**
 * The local calendar day as state. What has aired, and with it every derived status, depends on the day, but
 * nothing in the tracker state changes at midnight: a page left open overnight would keep showing yesterday.
 * Components that derive anything from the day read it here and compute again when it changes.
 */
const listeners = new Set<() => void>();
let announcedDay = toLocalDateString();
let timer: ReturnType<typeof setTimeout> | null = null;

function announceIfDayChanged(): void {
  const day = toLocalDateString();
  if (day === announcedDay) return;
  announcedDay = day;
  for (const listener of [...listeners]) listener();
}

function msUntilNextDay(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
}

function scheduleNextCheck(): void {
  timer = setTimeout(() => {
    announceIfDayChanged();
    scheduleNextCheck();
  }, msUntilNextDay() + 250);
}

export function subscribeToDayChange(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    announcedDay = toLocalDateString();
    scheduleNextCheck();
    // Timers do not run while a device sleeps or a tab is frozen, so also look when the page comes back.
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', announceIfDayChanged);
    if (typeof window !== 'undefined') window.addEventListener('focus', announceIfDayChanged);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    if (timer) clearTimeout(timer);
    timer = null;
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', announceIfDayChanged);
    if (typeof window !== 'undefined') window.removeEventListener('focus', announceIfDayChanged);
  };
}

const currentDay = (): string => toLocalDateString();

/** Today as `YYYY-MM-DD` in the device's time zone; the component renders again when the day changes. */
export function useToday(): string {
  return useSyncExternalStore(subscribeToDayChange, currentDay, currentDay);
}
