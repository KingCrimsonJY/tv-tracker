import { createTrackerActions } from './actions.ts';
import type { ToastVariant } from './actions/types.ts';
import type { TrackerStore } from './store.ts';
import { createSyncEngine } from './syncEngine.ts';

/** Wire actions to a store the way TrackerProvider does, for tests. The store's current state is "confirmed". */
export function createTestActions(
  store: TrackerStore,
  options: {
    showToast?: (message: string, variant?: ToastVariant) => void;
    reconcile?: () => Promise<void>;
  } = {},
) {
  const engine = createSyncEngine({
    initial: store.getState(),
    publish: store.setState,
    reconcile: options.reconcile ?? (async () => {}),
  });
  const actions = createTrackerActions({
    getState: store.getState,
    optimistic: engine.optimistic,
    applyServerMutation: engine.mutation,
    showToast: options.showToast ?? (() => {}),
  });
  return { actions, engine };
}
