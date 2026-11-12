import type { AppSettingsDoc } from '../../domain/types.ts';
import { patchSettingsApi } from '../api.ts';
import type { Commit } from './commit.ts';

export function createSettingsActions({ commit }: Commit) {
  async function updateSettings(partial: Partial<AppSettingsDoc>): Promise<void> {
    await commit(
      (state) => ({ ...state, settings: { ...state.settings, ...partial } }),
      () => patchSettingsApi(partial),
    );
  }
  return { updateSettings };
}
