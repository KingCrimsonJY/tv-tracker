import type { AppSettingsDoc } from '../../domain/types.ts';
import { getActiveCatalog } from '../../i18n/index.ts';
import { patchSettingsApi } from '../api.ts';
import type { TrackerActionDeps } from './types.ts';

export function createSettingsActions(deps: TrackerActionDeps & { triggerRefetch: () => Promise<void> }) {
  const { getState, setState, applyServerMutation, showToast, triggerRefetch } = deps;

  async function updateSettings(partial: Partial<AppSettingsDoc>): Promise<void> {
    const prevSettings = getState().settings;
    const revertPartial: Partial<AppSettingsDoc> = {};
    if (partial.uiLang !== undefined) {
      revertPartial.uiLang = prevSettings.uiLang;
    }
    if (partial.defaultTitleLang !== undefined) {
      revertPartial.defaultTitleLang = prevSettings.defaultTitleLang;
    }
    if (partial.includeSpecials !== undefined) {
      revertPartial.includeSpecials = prevSettings.includeSpecials;
    }
    if (partial.homeSections !== undefined) {
      revertPartial.homeSections = prevSettings.homeSections;
    }
    if (partial.theme !== undefined) {
      revertPartial.theme = prevSettings.theme;
    }

    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...partial,
      },
    }));

    try {
      const mut = await patchSettingsApi(partial);
      applyServerMutation(mut);
    } catch {
      setState((curr) => ({
        ...curr,
        settings: {
          ...curr.settings,
          ...revertPartial,
        },
      }));
      showToast(getActiveCatalog().app.writeRollbackToast, 'danger');
      await triggerRefetch();
    }
  }

  return {
    updateSettings,
  };
}
