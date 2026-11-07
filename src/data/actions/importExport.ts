import { importDataApi, exportDataApi } from '../api.ts';
import type { TrackerActionDeps } from './types.ts';

export function createImportExportActions(deps: TrackerActionDeps) {
  const { applyServerMutation } = deps;

  async function importBackupData(rawPayload: unknown): Promise<void> {
    const mut = await importDataApi(rawPayload);
    applyServerMutation(mut);
  }

  async function exportAllDataJson(): Promise<string> {
    return JSON.stringify(await exportDataApi(), null, 2);
  }

  return {
    importBackupData,
    exportAllDataJson,
  };
}
