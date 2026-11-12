import { createRandomId } from '../../domain/id.ts';
import { compareRank, computeMovedRank, getNextRank, sortListEntries } from '../../domain/ordering.ts';
import type { CollectionSort, ListEntryDoc, ListKind, TitleDoc, WatchListDoc } from '../../domain/types.ts';
import { resolveActiveLocale } from '../../i18n/index.ts';
import {
  deleteListApi,
  deleteListEntryApi,
  patchListApi,
  patchListEntryApi,
  putListApi,
  putListEntryApi,
} from '../api.ts';
import { patchList, updateEntries } from '../overlays.ts';
import type { Commit } from './commit.ts';
import type { TrackerActionDeps } from './types.ts';

export function createListActions({ getState }: TrackerActionDeps, { commit, commitOrThrow }: Commit) {
  async function addTitleToList(listId: string, titleId: string): Promise<void> {
    const entries = getState().entriesByList[listId] ?? [];
    if (entries.some((entry) => entry.titleId === titleId)) return;
    const entry: ListEntryDoc = {
      id: createRandomId('entry'),
      titleId,
      rank: getNextRank(entries.map((e) => e.rank)),
      addedAt: Date.now(),
    };
    const { id, ...payload } = entry;
    await commit(
      updateEntries(listId, (current) => (current.some((e) => e.titleId === titleId) ? current : [...current, entry])),
      () => putListEntryApi(listId, id, payload),
    );
  }

  async function createList(input: {
    name: string;
    kind: ListKind;
    description?: string;
    pinned?: boolean;
  }): Promise<WatchListDoc> {
    const description = input.description?.trim();
    const list: WatchListDoc = {
      id: createRandomId('list'),
      name: input.name.trim(),
      kind: input.kind,
      ...(description ? { description } : {}),
      pinned: Boolean(input.pinned),
      rank: getNextRank(Object.values(getState().lists).map((l) => l.rank)),
      collectionSort: input.kind === 'ordered' ? 'manual' : 'added',
      createdAt: Date.now(),
    };
    const { id, ...payload } = list;
    await commitOrThrow(
      (state) => ({
        ...state,
        lists: { ...state.lists, [id]: list },
        entriesByList: { ...state.entriesByList, [id]: state.entriesByList[id] ?? [] },
      }),
      () => putListApi(id, payload),
    );
    return list;
  }

  async function deleteList(listId: string): Promise<void> {
    if (!getState().lists[listId]) return;
    await commit(
      (state) => {
        if (!state.lists[listId]) return state;
        const lists = { ...state.lists };
        const entriesByList = { ...state.entriesByList };
        delete lists[listId];
        delete entriesByList[listId];
        return { ...state, lists, entriesByList };
      },
      () => deleteListApi(listId),
    );
  }

  async function togglePinList(listId: string): Promise<void> {
    const list = getState().lists[listId];
    if (!list) return;
    const pinned = !list.pinned;
    await commit(patchList(listId, { pinned }), () => patchListApi(listId, { pinned }));
  }

  async function updateCollectionSort(listId: string, collectionSort: CollectionSort): Promise<void> {
    if (!getState().lists[listId]) return;
    await commit(patchList(listId, { collectionSort }), () => patchListApi(listId, { collectionSort }));
  }

  async function removeEntryFromList(listId: string, entryId: string): Promise<void> {
    if (!(getState().entriesByList[listId] ?? []).some((entry) => entry.id === entryId)) return;
    await commit(
      updateEntries(listId, (entries) =>
        entries.some((entry) => entry.id === entryId) ? entries.filter((entry) => entry.id !== entryId) : entries,
      ),
      () => deleteListEntryApi(listId, entryId),
    );
  }

  async function reorderListEntry(listId: string, activeEntryId: string, overEntryId: string): Promise<void> {
    if (activeEntryId === overEntryId) return;
    const state = getState();
    const list = state.lists[listId];
    if (!list) return;
    const ordered = sortListEntries(
      (state.entriesByList[listId] ?? [])
        .map((entry) => ({ entry, title: state.titles[entry.titleId] }))
        .filter((item): item is { entry: ListEntryDoc; title: TitleDoc } => Boolean(item.title)),
      list.kind,
      'manual',
      state.settings.defaultTitleLang,
      resolveActiveLocale(state.settings.uiLang),
    ).map((item) => item.entry);
    const from = ordered.findIndex((entry) => entry.id === activeEntryId);
    const to = ordered.findIndex((entry) => entry.id === overEntryId);
    if (from === -1 || to === -1) return;
    const rank = computeMovedRank(ordered, from, to);
    if (!rank) return;
    await commit(
      updateEntries(listId, (entries) =>
        entries.map((entry) => (entry.id === activeEntryId ? { ...entry, rank } : entry)).sort(compareRank),
      ),
      () => patchListEntryApi(listId, activeEntryId, { rank }),
    );
  }

  return {
    addTitleToList,
    createList,
    deleteList,
    togglePinList,
    updateCollectionSort,
    removeEntryFromList,
    reorderListEntry,
  };
}
