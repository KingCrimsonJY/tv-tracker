import { createCommit } from './actions/commit.ts';
import { createImportExportActions } from './actions/importExport.ts';
import { createListActions } from './actions/lists.ts';
import { createProgressActions } from './actions/progress.ts';
import { createSettingsActions } from './actions/settings.ts';
import { createTitleActions } from './actions/titles.ts';
import { createTitleSyncActions } from './actions/titleSync.ts';
import {
  computeProgressDiff,
  type CustomTitleInput,
  getActiveProgressFromState,
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
  const commit = createCommit(deps);
  const listActions = createListActions(deps, commit);
  return {
    ...createTitleActions(deps, commit, listActions.addTitleToList),
    ...createTitleSyncActions(deps, commit),
    ...createProgressActions(deps, commit),
    ...listActions,
    ...createSettingsActions(commit),
    ...createImportExportActions(deps),
  };
}

export type TrackerActions = ReturnType<typeof createTrackerActions>;
