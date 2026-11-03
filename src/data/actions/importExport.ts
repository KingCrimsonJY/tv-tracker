import { importDataApi } from '../api.ts';
import { buildExportV2FromState } from '../store.ts';
import type { TrackerActionDeps } from './types.ts';

export function createImportExportActions(deps: TrackerActionDeps) {
  const { getState, setState } = deps;

  async function importBackupData(rawPayload: unknown): Promise<void> {
    const mut = await importDataApi(rawPayload);
    setState((prev) => ({
      version: mut.version,
      epoch: mut.epoch ?? prev.epoch,
      titles: mut.upserts.titles || {},
      seasonsByTitle: mut.upserts.seasonsByTitle || {},
      progressByTitle: mut.upserts.progressByTitle || {},
      lists: mut.upserts.lists || {},
      entriesByList: mut.upserts.entriesByList || {},
      settings: mut.upserts.settings || prev.settings,
    }));
  }

  function exportAllDataJson(): string {
    return JSON.stringify(buildExportV2FromState(getState()), null, 2);
  }

  return {
    importBackupData,
    exportAllDataJson,
  };
}
