import type { AppStateSnapshot, StateMutationResult } from '../domain/types.ts';
import { applyMutationResult, applyStateSnapshot, hasEpochChanged } from './store.ts';

/** Keep the confirmed state separate from optimistic edits so duplicate SSE/POST replies cannot roll them back. */
export function createMutationSync(options: {
  initial: AppStateSnapshot;
  publish: (state: AppStateSnapshot) => void;
  reconcile: () => Promise<void>;
}) {
  let confirmed = options.initial;
  return {
    snapshot(snapshot: AppStateSnapshot) {
      confirmed = applyStateSnapshot(confirmed, snapshot);
      options.publish(confirmed);
    },
    mutation(mutation: StateMutationResult) {
      if (
        hasEpochChanged(confirmed.epoch, mutation.epoch) ||
        mutation.replace ||
        mutation.version > confirmed.version + 1 ||
        (mutation.checkpoint && mutation.version > confirmed.version)
      ) {
        void options.reconcile();
        return;
      }
      if (mutation.version > confirmed.version) confirmed = applyMutationResult(confirmed, mutation);
      options.publish(confirmed);
    },
  };
}
