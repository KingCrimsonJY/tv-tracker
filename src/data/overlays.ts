import type { AppStateSnapshot, ListEntryDoc, ProgressDoc, TitleDoc, WatchListDoc } from '../domain/types.ts';
import type { Overlay } from './syncEngine.ts';

/** Building blocks for optimistic edits. Each returns the same state object when there is nothing to change. */

export function patchTitles(patches: Record<string, Partial<Omit<TitleDoc, 'id'>>>): Overlay {
  return (state) => {
    let titles: Record<string, TitleDoc> | undefined;
    for (const [id, patch] of Object.entries(patches)) {
      const current = state.titles[id];
      if (!current) continue;
      titles ??= { ...state.titles };
      titles[id] = { ...current, ...patch, id };
    }
    return titles ? { ...state, titles } : state;
  };
}

export const patchTitle = (id: string, patch: Partial<Omit<TitleDoc, 'id'>>): Overlay => patchTitles({ [id]: patch });

export function patchList(id: string, patch: Partial<Omit<WatchListDoc, 'id'>>): Overlay {
  return (state) =>
    state.lists[id] ? { ...state, lists: { ...state.lists, [id]: { ...state.lists[id], ...patch, id } } } : state;
}

/** Change the entries of one list; a list that no longer exists is left alone. */
export function updateEntries(listId: string, update: (entries: ListEntryDoc[]) => ListEntryDoc[]): Overlay {
  return (state) => {
    if (!state.lists[listId]) return state;
    const current = state.entriesByList[listId] ?? [];
    const next = update(current);
    return next === current ? state : { ...state, entriesByList: { ...state.entriesByList, [listId]: next } };
  };
}

/** Remove titles with their seasons, progress and list entries, as the server's cascade does. */
export function removeTitles(ids: readonly string[]): Overlay {
  return (state) => {
    const doomed = ids.filter((id) => state.titles[id]);
    if (doomed.length === 0) return state;
    const gone = new Set(doomed);
    const titles = { ...state.titles };
    const seasonsByTitle = { ...state.seasonsByTitle };
    const progressByTitle = { ...state.progressByTitle };
    for (const id of doomed) {
      delete titles[id];
      delete seasonsByTitle[id];
      delete progressByTitle[id];
    }
    const entriesByList: AppStateSnapshot['entriesByList'] = {};
    for (const [listId, entries] of Object.entries(state.entriesByList)) {
      entriesByList[listId] = entries.some((entry) => gone.has(entry.titleId))
        ? entries.filter((entry) => !gone.has(entry.titleId))
        : entries;
    }
    return { ...state, titles, seasonsByTitle, progressByTitle, entriesByList };
  };
}

/** Replace the progress documents of several titles' playthroughs. */
export function putProgress(docs: Record<string, ProgressDoc>): Overlay {
  return (state) => {
    let progressByTitle: AppStateSnapshot['progressByTitle'] | undefined;
    for (const [titleId, doc] of Object.entries(docs)) {
      if (!state.titles[titleId]) continue;
      progressByTitle ??= { ...state.progressByTitle };
      progressByTitle[titleId] = { ...(progressByTitle[titleId] ?? {}), [doc.playthroughId]: doc };
    }
    return progressByTitle ? { ...state, progressByTitle } : state;
  };
}

export const composeOverlays =
  (...overlays: Overlay[]): Overlay =>
  (state) =>
    overlays.reduce((current, overlay) => overlay(current), state);
