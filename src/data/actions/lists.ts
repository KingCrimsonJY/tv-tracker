import { createRandomId } from '../../domain/id.ts';
import { computeMovedRank, getNextRank, sortListEntries } from '../../domain/ordering.ts';
import type {
  CollectionSort,
  ListEntryDoc,
  ListKind,
  TitleDoc,
  WatchListDoc,
} from '../../domain/types.ts';
import { zh } from '../../i18n/zh.ts';
import {
  deleteListApi,
  deleteListEntryApi,
  patchListApi,
  patchListEntryApi,
  putListApi,
  putListEntryApi,
} from '../api.ts';
import type { TrackerActionDeps } from './types.ts';

export function createListActions(
  deps: TrackerActionDeps & { triggerRefetch: () => Promise<void> }
) {
  const { getState, setState, applyServerMutation, showToast, triggerRefetch } = deps;

  async function addTitleToList(listId: string, titleId: string): Promise<void> {
    const state = getState();
    const prevEntries = state.entriesByList[listId] || [];
    if (prevEntries.some((e) => e.titleId === titleId)) return;

    const rank = getNextRank(prevEntries.map((e) => e.rank));
    const now = Date.now();
    const newEntry: ListEntryDoc = {
      id: createRandomId('entry'),
      titleId,
      rank,
      addedAt: now,
    };

    setState((prev) => ({
      ...prev,
      entriesByList: {
        ...prev.entriesByList,
        [listId]: [...(prev.entriesByList[listId] || []), newEntry],
      },
    }));

    try {
      const { id: _id, ...payload } = newEntry;
      const mut = await putListEntryApi(listId, newEntry.id, payload);
      applyServerMutation(mut);
    } catch {
      setState((curr) => ({
        ...curr,
        entriesByList: {
          ...curr.entriesByList,
          [listId]: (curr.entriesByList[listId] || []).filter((e) => e.id !== newEntry.id),
        },
      }));
      showToast(zh.app.writeRollbackToast, 'danger');
      await triggerRefetch();
    }
  }

  async function createList(input: {
    name: string;
    kind: ListKind;
    description?: string;
    pinned?: boolean;
  }): Promise<WatchListDoc> {
    const state = getState();
    const now = Date.now();
    const existingRanks = Object.values(state.lists).map((l) => l.rank);
    const rank = getNextRank(existingRanks);
    const newList: WatchListDoc = {
      id: createRandomId('list'),
      name: input.name.trim(),
      kind: input.kind,
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      pinned: Boolean(input.pinned),
      rank,
      collectionSort: input.kind === 'ordered' ? 'manual' : 'added',
      createdAt: now,
    };

    setState((prev) => ({
      ...prev,
      lists: { ...prev.lists, [newList.id]: newList },
      entriesByList: { ...prev.entriesByList, [newList.id]: [] },
    }));

    try {
      const { id: _id, ...payload } = newList;
      const mut = await putListApi(newList.id, payload);
      applyServerMutation(mut);
    } catch (err) {
      setState((curr) => {
        const nextLists = { ...curr.lists };
        delete nextLists[newList.id];
        const nextEntries = { ...curr.entriesByList };
        delete nextEntries[newList.id];
        return {
          ...curr,
          lists: nextLists,
          entriesByList: nextEntries,
        };
      });
      showToast(zh.app.writeRollbackToast, 'danger');
      void triggerRefetch();
      throw err;
    }

    return newList;
  }

  async function deleteList(listId: string): Promise<void> {
    const state = getState();
    const removedList = state.lists[listId];
    if (!removedList) return;
    const removedEntries = state.entriesByList[listId] || [];

    setState((prev) => {
      const nextLists = { ...prev.lists };
      delete nextLists[listId];
      const nextEntries = { ...prev.entriesByList };
      delete nextEntries[listId];
      return {
        ...prev,
        lists: nextLists,
        entriesByList: nextEntries,
      };
    });

    try {
      const mut = await deleteListApi(listId);
      applyServerMutation(mut);
    } catch {
      setState((curr) => ({
        ...curr,
        lists: { ...curr.lists, [listId]: removedList },
        entriesByList: { ...curr.entriesByList, [listId]: removedEntries },
      }));
      showToast(zh.app.writeRollbackToast, 'danger');
      await triggerRefetch();
    }
  }

  async function togglePinList(listId: string): Promise<void> {
    const prevList = getState().lists[listId];
    if (!prevList) return;
    const prevPinned = prevList.pinned;
    const nextPinned = !prevPinned;

    setState((prev) =>
      prev.lists[listId]
        ? {
            ...prev,
            lists: {
              ...prev.lists,
              [listId]: { ...prev.lists[listId], pinned: nextPinned },
            },
          }
        : prev
    );

    try {
      const mut = await patchListApi(listId, { pinned: nextPinned });
      applyServerMutation(mut);
    } catch {
      setState((curr) =>
        curr.lists[listId]
          ? {
              ...curr,
              lists: {
                ...curr.lists,
                [listId]: { ...curr.lists[listId], pinned: prevPinned },
              },
            }
          : curr
      );
      showToast(zh.app.writeRollbackToast, 'danger');
      await triggerRefetch();
    }
  }

  async function updateCollectionSort(listId: string, sort: CollectionSort): Promise<void> {
    const prevList = getState().lists[listId];
    if (!prevList) return;
    const prevSort = prevList.collectionSort;

    setState((prev) =>
      prev.lists[listId]
        ? {
            ...prev,
            lists: {
              ...prev.lists,
              [listId]: { ...prev.lists[listId], collectionSort: sort },
            },
          }
        : prev
    );

    try {
      const mut = await patchListApi(listId, { collectionSort: sort });
      applyServerMutation(mut);
    } catch {
      setState((curr) =>
        curr.lists[listId]
          ? {
              ...curr,
              lists: {
                ...curr.lists,
                [listId]: { ...curr.lists[listId], collectionSort: prevSort },
              },
            }
          : curr
      );
      showToast(zh.app.writeRollbackToast, 'danger');
      await triggerRefetch();
    }
  }

  async function removeEntryFromList(listId: string, entryId: string): Promise<void> {
    const prevEntries = getState().entriesByList[listId] || [];
    const removedEntry = prevEntries.find((e) => e.id === entryId);
    if (!removedEntry) return;

    setState((prev) => ({
      ...prev,
      entriesByList: {
        ...prev.entriesByList,
        [listId]: (prev.entriesByList[listId] || []).filter((e) => e.id !== entryId),
      },
    }));

    try {
      const mut = await deleteListEntryApi(listId, entryId);
      applyServerMutation(mut);
    } catch {
      setState((curr) => {
        const currentListEntries = curr.entriesByList[listId] || [];
        if (currentListEntries.some((e) => e.id === entryId)) return curr;
        const next = [...currentListEntries, removedEntry].sort((a, b) =>
          a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0
        );
        return {
          ...curr,
          entriesByList: { ...curr.entriesByList, [listId]: next },
        };
      });
      showToast(zh.app.writeRollbackToast, 'danger');
      await triggerRefetch();
    }
  }

  async function reorderListEntry(
    listId: string,
    activeEntryId: string,
    overEntryId: string
  ): Promise<void> {
    if (activeEntryId === overEntryId) return;
    const state = getState();
    const list = state.lists[listId];
    if (!list) return;

    const prevEntries = state.entriesByList[listId] || [];
    const targetEntry = prevEntries.find((e) => e.id === activeEntryId);
    if (!targetEntry) return;
    const prevRank = targetEntry.rank;

    const hydrated = prevEntries
      .map((entry) => ({ entry, title: state.titles[entry.titleId] }))
      .filter((item): item is { entry: ListEntryDoc; title: TitleDoc } => Boolean(item.title));

    const sorted = sortListEntries(
      hydrated,
      list.kind,
      'manual',
      state.settings.defaultTitleLang
    ).map((h) => h.entry);

    const activeIdx = sorted.findIndex((e) => e.id === activeEntryId);
    const overIdx = sorted.findIndex((e) => e.id === overEntryId);
    if (activeIdx === -1 || overIdx === -1) return;

    const newRank = computeMovedRank(sorted, activeIdx, overIdx);
    if (!newRank) return;

    setState((prev) => {
      const next = (prev.entriesByList[listId] || [])
        .map((e) => (e.id === activeEntryId ? { ...e, rank: newRank } : e))
        .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
      return {
        ...prev,
        entriesByList: { ...prev.entriesByList, [listId]: next },
      };
    });

    try {
      const mut = await patchListEntryApi(listId, activeEntryId, { rank: newRank });
      applyServerMutation(mut);
    } catch {
      setState((curr) => {
        const next = (curr.entriesByList[listId] || [])
          .map((e) => (e.id === activeEntryId ? { ...e, rank: prevRank } : e))
          .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
        return {
          ...curr,
          entriesByList: { ...curr.entriesByList, [listId]: next },
        };
      });
      showToast(zh.app.writeRollbackToast, 'danger');
      await triggerRefetch();
    }
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
