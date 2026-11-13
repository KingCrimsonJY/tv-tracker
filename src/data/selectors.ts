import type { AppStateSnapshot } from '../domain/types';

/** Stable selectors for `useTrackerState`, one per top-level slice of the synchronized state. */
export const selectTitles = (state: AppStateSnapshot) => state.titles;
export const selectSeasonsByTitle = (state: AppStateSnapshot) => state.seasonsByTitle;
export const selectProgressByTitle = (state: AppStateSnapshot) => state.progressByTitle;
export const selectLists = (state: AppStateSnapshot) => state.lists;
export const selectEntriesByList = (state: AppStateSnapshot) => state.entriesByList;
export const selectSettings = (state: AppStateSnapshot) => state.settings;
