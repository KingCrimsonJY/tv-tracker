import { importDataApi } from '../api.ts';
import { buildExportV2FromState } from '../store.ts';
import type { TrackerActionDeps } from './types.ts';

export function createImportExportActions(deps: TrackerActionDeps) {
  const { getState, applyServerMutation } = deps;

  async function importBackupData(rawPayload: unknown): Promise<void> {
    const mut = await importDataApi(rawPayload);
    applyServerMutation(mut);
  }

  function exportAllDataJson(): string {
    return JSON.stringify(buildExportV2FromState(getState()), null, 2);
  }

  return {
    importBackupData,
    exportAllDataJson,
  };
}
