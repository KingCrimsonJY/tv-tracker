import { fetchStateSnapshot } from './api.ts';
import { applyStateSnapshot } from './store.ts';
import { createImportExportActions } from './actions/importExport.ts';
import { createListActions } from './actions/lists.ts';
import { createProgressActions } from './actions/progress.ts';
import { createSettingsActions } from './actions/settings.ts';
import { createTitleActions } from './actions/titles.ts';
import { createTitleSyncActions } from './actions/titleSync.ts';
import {
  applyInFlightOpsToState,
  computeProgressDiff,
  type CustomTitleInput,
  getActiveProgressFromState,
  type InFlightProgressOp,
  type TrackerActionDeps,
  type UpdateTitleDetailsInput,
} from './actions/types.ts';

export {
  computeProgressDiff,
  type CustomTitleInput,
  getActiveProgressFromState,
  type TrackerActionDeps,
  type UpdateTitleDetailsInput,
};

export function createTrackerActions(deps: TrackerActionDeps) {
  const inFlightOps = deps.inFlightOps ?? new Map<string, InFlightProgressOp>();

  const triggerRefetch = async (): Promise<void> => {
    if (deps.refetchState) {
      await deps.refetchState();
      if (inFlightOps.size > 0) {
        deps.setState((curr) => applyInFlightOpsToState(curr, inFlightOps));
      }
      return;
    }
    try {
      const snapshot = await fetchStateSnapshot();
      deps.setState((curr) => {
        const applied = applyStateSnapshot(curr, snapshot);
        return applyInFlightOpsToState(applied, inFlightOps);
      });
    } catch {
      // Ignore refetch failure when offline; offline handler will surface unreachable state
    }
  };

  const listActions = createListActions({ ...deps, triggerRefetch });
  const titleActions = createTitleActions({
    ...deps,
    addTitleToList: listActions.addTitleToList,
    triggerRefetch,
  });
  const titleSyncActions = createTitleSyncActions({
    ...deps,
    triggerRefetch,
  });
  const progressActions = createProgressActions({
    ...deps,
    inFlightOps,
    triggerRefetch,
  });
  const settingsActions = createSettingsActions({ ...deps, triggerRefetch });
  const importExportActions = createImportExportActions(deps);

  return {
    ...titleActions,
    ...titleSyncActions,
    ...progressActions,
    ...listActions,
    ...settingsActions,
    ...importExportActions,
  };
}
