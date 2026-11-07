import { DEFAULT_APP_SETTINGS } from '../domain/schemas.ts';
import type {
  AppStateSnapshot,
  ListEntryDoc,
  ProgressDoc,
  SeasonDoc,
  StateMutationResult,
  TitleDoc,
  WatchListDoc,
  ZhenjiExportV2,
} from '../domain/types.ts';

export type StateUpdater =
  | AppStateSnapshot
  | ((prev: AppStateSnapshot) => AppStateSnapshot);

export type StoreListener = () => void;

export interface TrackerStore {
  getState: () => AppStateSnapshot;
  setState: (updater: StateUpdater) => AppStateSnapshot;
  subscribe: (listener: StoreListener) => () => void;
  applySnapshot: (snapshot: AppStateSnapshot) => { state: AppStateSnapshot; epochChanged: boolean };
  applyMutation: (
    mutation: StateMutationResult,
    options?: { allowSameOrLowerVersion?: boolean }
  ) => { state: AppStateSnapshot; epochChanged: boolean };
  reset: () => AppStateSnapshot;
}

export function createInitialAppState(): AppStateSnapshot {
  return {
    version: 0,
    titles: {},
    seasonsByTitle: {},
    progressByTitle: {},
    lists: {},
    entriesByList: {},
    settings: structuredClone(DEFAULT_APP_SETTINGS),
  };
}

export function hasEpochChanged(
  currentEpoch: string | undefined,
  incomingEpoch: string | undefined
): boolean {
  return Boolean(currentEpoch && incomingEpoch && currentEpoch !== incomingEpoch);
}

export function applyStateSnapshot(
  currentState: AppStateSnapshot,
  incomingSnapshot: AppStateSnapshot
): AppStateSnapshot {
  if (hasEpochChanged(currentState.epoch, incomingSnapshot.epoch)) {
    return incomingSnapshot;
  }
  if (incomingSnapshot.version < currentState.version) {
    return currentState;
  }
  return {
    ...incomingSnapshot,
    epoch: incomingSnapshot.epoch ?? currentState.epoch,
  };
}

export function applyMutationResult(
  currentState: AppStateSnapshot,
  mutation: StateMutationResult,
  options: { allowSameOrLowerVersion?: boolean } = {}
): AppStateSnapshot {
  if (!options.allowSameOrLowerVersion && mutation.version < currentState.version) {
    return currentState;
  }

  if (mutation.replace) currentState = { ...createInitialAppState(), epoch: currentState.epoch };

  let titles: Record<string, TitleDoc> = { ...currentState.titles };
  let seasonsByTitle: Record<string, SeasonDoc[]> = { ...currentState.seasonsByTitle };
  const progressByTitle: Record<string, Record<string, ProgressDoc>> = {
    ...currentState.progressByTitle,
  };
  let lists: Record<string, WatchListDoc> = { ...currentState.lists };
  let entriesByList: Record<string, ListEntryDoc[]> = { ...currentState.entriesByList };
  let settings = currentState.settings;

  const { deletes, upserts } = mutation;

  if (deletes.titles) {
    for (const titleId of deletes.titles) {
      delete titles[titleId];
      delete seasonsByTitle[titleId];
      delete progressByTitle[titleId];
      for (const [listId, entries] of Object.entries(entriesByList)) {
        entriesByList[listId] = entries.filter((e) => e.titleId !== titleId);
      }
    }
  }

  if (deletes.progress) {
    for (const { titleId, playthroughId } of deletes.progress) {
      if (progressByTitle[titleId]) {
        const nextMap = { ...progressByTitle[titleId] };
        delete nextMap[playthroughId];
        progressByTitle[titleId] = nextMap;
      }
    }
  }

  if (deletes.lists) {
    for (const listId of deletes.lists) {
      delete lists[listId];
      delete entriesByList[listId];
    }
  }

  if (deletes.entries) {
    for (const { listId, entryId } of deletes.entries) {
      if (entriesByList[listId]) {
        entriesByList[listId] = entriesByList[listId].filter((e) => e.id !== entryId);
      }
    }
  }

  if (upserts.titles) {
    titles = {
      ...titles,
      ...upserts.titles,
    };
  }

  if (upserts.seasonsByTitle) {
    seasonsByTitle = {
      ...seasonsByTitle,
      ...upserts.seasonsByTitle,
    };
  }

  if (upserts.progressByTitle) {
    for (const [titleId, pMap] of Object.entries(upserts.progressByTitle)) {
      progressByTitle[titleId] = {
        ...(progressByTitle[titleId] || {}),
        ...pMap,
      };
    }
  }

  if (upserts.lists) {
    lists = {
      ...lists,
      ...upserts.lists,
    };
  }

  if (upserts.entriesByList) {
    entriesByList = {
      ...entriesByList,
      ...upserts.entriesByList,
    };
  }

  if (upserts.settings) {
    settings = upserts.settings;
  }

  return {
    version: Math.max(currentState.version, mutation.version),
    epoch: mutation.epoch ?? currentState.epoch,
    titles,
    seasonsByTitle,
    progressByTitle,
    lists,
    entriesByList,
    settings,
  };
}

export function createTrackerStore(
  initialState: AppStateSnapshot = createInitialAppState()
): TrackerStore {
  let state: AppStateSnapshot = initialState;
  const listeners = new Set<StoreListener>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getState: () => state,
    setState: (updater: StateUpdater) => {
      const next = typeof updater === 'function' ? updater(state) : updater;
      if (next !== state) {
        state = next;
        notify();
      }
      return state;
    },
    subscribe: (listener: StoreListener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    applySnapshot: (snapshot: AppStateSnapshot) => {
      const epochChanged = hasEpochChanged(state.epoch, snapshot.epoch);
      const next = applyStateSnapshot(state, snapshot);
      if (next !== state) {
        state = next;
        notify();
      }
      return { state, epochChanged };
    },
    applyMutation: (
      mutation: StateMutationResult,
      options: { allowSameOrLowerVersion?: boolean } = {}
    ) => {
      const epochChanged = hasEpochChanged(state.epoch, mutation.epoch);
      const next = applyMutationResult(state, mutation, options);
      if (next !== state) {
        state = next;
        notify();
      }
      return { state, epochChanged };
    },
    reset: () => {
      state = createInitialAppState();
      notify();
      return state;
    },
  };
}

export const trackerStore = createTrackerStore();

export function buildExportV2FromState(state: AppStateSnapshot): ZhenjiExportV2 {
  return {
    format: 'zhenji-export',
    version: 2,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    titles: state.titles,
    seasonsByTitle: state.seasonsByTitle,
    progressByTitle: state.progressByTitle,
    lists: state.lists,
    entriesByList: state.entriesByList,
  };
}
