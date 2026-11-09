import type { ProgressDoc, SeasonDoc, TitleDoc } from './types.ts';

/**
 * Shared fallbacks for derived views. computeTitleState caches by object identity, so a fresh `[]` or a
 * placeholder progress object on every render would recompute every movie and unstarted title. Never mutate.
 */
export const NO_SEASONS: SeasonDoc[] = [];

export function activeProgressOf(
  progressByTitle: Record<string, Record<string, ProgressDoc>>,
  title: Pick<TitleDoc, 'id' | 'activePlaythroughId'>,
): ProgressDoc | undefined {
  return progressByTitle[title.id]?.[title.activePlaythroughId];
}
