import { generateKeyBetween } from 'fractional-indexing';
import {
  computeTitleState,
  isEpisodic,
  pickBackdrop,
  pickPoster,
  resolveDisplayTitle,
  resolveLocalizedText,
  resolveOverviewText,
} from './progress';
import type {
  CollectionSort,
  DefaultTitleLang,
  ListEntryDoc,
  ProgressDoc,
  SeasonDoc,
  TitleDoc,
  UiLocale,
} from './types';

export { isEpisodic, pickBackdrop, pickPoster, resolveDisplayTitle, resolveLocalizedText, resolveOverviewText };

/**
 * Generates a fractional rank key to append at the end of a sorted list of ranks.
 */
export function getNextRank(existingRanks: string[]): string {
  if (existingRanks.length === 0) {
    return generateKeyBetween(null, null);
  }
  const sorted = [...existingRanks].sort();
  const last = sorted[sorted.length - 1];
  return generateKeyBetween(last, null);
}

/**
 * Computes the new fractional rank when moving an item from `activeIndex` to `overIndex`
 * in a rank-sorted array of items. Only the moved item's document needs to be updated.
 */
export function computeMovedRank<T extends { rank: string }>(
  sortedItems: T[],
  activeIndex: number,
  overIndex: number,
): string | null {
  if (
    activeIndex === overIndex ||
    activeIndex < 0 ||
    overIndex < 0 ||
    activeIndex >= sortedItems.length ||
    overIndex >= sortedItems.length
  ) {
    return null;
  }

  const withoutActive = sortedItems.filter((_, idx) => idx !== activeIndex);
  const prevItem = overIndex > 0 ? withoutActive[overIndex - 1] : null;
  const nextItem = overIndex < withoutActive.length ? withoutActive[overIndex] : null;

  const prevRank = prevItem ? prevItem.rank : null;
  const nextRank = nextItem ? nextItem.rank : null;

  if (prevRank !== null && nextRank !== null && prevRank >= nextRank) {
    return generateKeyBetween(prevRank, null);
  }

  return generateKeyBetween(prevRank, nextRank);
}

export interface HydratedListEntry {
  entry: ListEntryDoc;
  title: TitleDoc;
}

/**
 * Sorts list entries for an Ordered List (always by fractional `rank`) or a Collection.
 */
export function sortListEntries(
  items: HydratedListEntry[],
  kind: 'ordered' | 'collection',
  collectionSort: CollectionSort,
  defaultLang: DefaultTitleLang = 'auto',
  activeLocale: UiLocale = 'zh-CN',
): HydratedListEntry[] {
  const copy = [...items];

  if (kind === 'ordered' || collectionSort === 'manual') {
    return copy.sort((a, b) => (a.entry.rank < b.entry.rank ? -1 : a.entry.rank > b.entry.rank ? 1 : 0));
  }

  switch (collectionSort) {
    case 'added':
      return copy.sort((a, b) => b.entry.addedAt - a.entry.addedAt);
    case 'name':
      return copy.sort((a, b) => {
        const nameA = resolveDisplayTitle(a.title.names, a.title.displayLang, defaultLang, activeLocale).primary;
        const nameB = resolveDisplayTitle(b.title.names, b.title.displayLang, defaultLang, activeLocale).primary;
        return nameA.localeCompare(nameB, activeLocale);
      });
    case 'year':
      return copy.sort((a, b) => (b.title.year ?? 0) - (a.title.year ?? 0));
    case 'rating':
      return copy.sort((a, b) => {
        const scoreA = parseFloat(a.title.ratings?.tmdb || a.title.ratings?.imdb || '0') || 0;
        const scoreB = parseFloat(b.title.ratings?.tmdb || b.title.ratings?.imdb || '0') || 0;
        return scoreB - scoreA;
      });
    default:
      return copy;
  }
}

/**
 * Computes list progress (completed count / total count) and the first entry not completed.
 */
export function computeListProgress(
  orderedEntries: HydratedListEntry[],
  seasonsByTitle: Record<string, SeasonDoc[]>,
  progressByTitle: Record<string, ProgressDoc | undefined>,
  options: { includeSpecials?: boolean; todayStr?: string } = {},
): {
  totalCount: number;
  completedCount: number;
  nextEntry: HydratedListEntry | null;
} {
  let completedCount = 0;
  let nextEntry: HydratedListEntry | null = null;

  for (const item of orderedEntries) {
    const seasons = seasonsByTitle[item.title.id] ?? [];
    const progress = progressByTitle[item.title.id];
    const state = computeTitleState(item.title, seasons, progress, options);
    if (state.status === 'completed') {
      completedCount++;
    } else if (!nextEntry) {
      nextEntry = item;
    }
  }

  return {
    totalCount: orderedEntries.length,
    completedCount,
    nextEntry,
  };
}
