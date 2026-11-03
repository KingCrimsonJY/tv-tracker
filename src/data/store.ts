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

export function applyStateSnapshot(
  currentState: AppStateSnapshot,
  incomingSnapshot: AppStateSnapshot
): AppStateSnapshot {
  if (incomingSnapshot.version < currentState.version) {
    return currentState;
  }
  return incomingSnapshot;
}

export function applyMutationResult(
  currentState: AppStateSnapshot,
  mutation: StateMutationResult,
  options: { allowSameOrLowerVersion?: boolean } = {}
): AppStateSnapshot {
  if (!options.allowSameOrLowerVersion && mutation.version < currentState.version) {
    return currentState;
  }

  let titles: Record<string, TitleDoc> = { ...currentState.titles };
  let seasonsByTitle: Record<string, SeasonDoc[]> = { ...currentState.seasonsByTitle };
  let progressByTitle: Record<string, Record<string, ProgressDoc>> = {
    ...currentState.progressByTitle,
  };
  let lists: Record<string, WatchListDoc> = { ...currentState.lists };
  let entriesByList: Record<string, ListEntryDoc[]> = { ...currentState.entriesByList };
  let settings = currentState.settings;

  // 1. Apply deletes first
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

  // 2. Apply upserts
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
    titles,
    seasonsByTitle,
    progressByTitle,
    lists,
    entriesByList,
    settings,
  };
}

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
