import type { AppStateSnapshot, StateMutationResult } from '../domain/types.ts';
import { applyMutationResult, applyStateSnapshot, hasEpochChanged } from './store.ts';

/**
 * A pending local edit, expressed as a pure function of the state. It is re-applied on top of every newer
 * server state, so it must tolerate entities that have meanwhile disappeared and must be safe to apply to a
 * state that already contains the edit.
 */
export type Overlay = (state: AppStateSnapshot) => AppStateSnapshot;

export interface SyncEngine {
  /** Replace the confirmed state with a full snapshot read from the server. */
  snapshot: (snapshot: AppStateSnapshot) => void;
  /** Apply a mutation reported by the server (an SSE event or the reply to a non-optimistic write). */
  mutation: (mutation: StateMutationResult) => void;
  /**
   * Show `overlay` immediately and send `request`. On success the server's mutation replaces the overlay;
   * on failure the overlay is dropped, which is the whole rollback, and the error is rethrown.
   */
  optimistic: <T extends StateMutationResult>(overlay: Overlay, request: () => Promise<T>) => Promise<T>;
  /** Forget everything, for sign-out. */
  reset: (initial: AppStateSnapshot) => void;
}

/**
 * The view every device converges on: the last state confirmed by the server, plus this device's pending
 * edits in the order they were made. Events from other devices move the confirmed state underneath without
 * undoing pending edits, and duplicate or out-of-order replies cannot roll anything back.
 */
export function createSyncEngine(options: {
  initial: AppStateSnapshot;
  publish: (view: AppStateSnapshot) => void;
  /** Read a fresh snapshot from the server and pass it to `snapshot`. Must not reject. */
  reconcile: () => Promise<void>;
}): SyncEngine {
  let confirmed = options.initial;
  let nextOverlayId = 1;
  const overlays = new Map<number, Overlay>();

  const publish = () => {
    let view = confirmed;
    for (const overlay of overlays.values()) view = overlay(view);
    options.publish(view);
  };

  /** A mutation is only applied directly when it is exactly the next version of the state we hold. */
  const needsSnapshot = (mutation: StateMutationResult) =>
    hasEpochChanged(confirmed.epoch, mutation.epoch) ||
    Boolean(mutation.replace) ||
    mutation.version > confirmed.version + 1 ||
    (Boolean(mutation.checkpoint) && mutation.version > confirmed.version);

  const confirm = (mutation: StateMutationResult) => {
    if (mutation.version > confirmed.version) confirmed = applyMutationResult(confirmed, mutation);
  };

  return {
    snapshot(snapshot) {
      confirmed = applyStateSnapshot(confirmed, snapshot);
      publish();
    },
    mutation(mutation) {
      if (needsSnapshot(mutation)) {
        void options.reconcile();
        return;
      }
      confirm(mutation);
      publish();
    },
    async optimistic(overlay, request) {
      const id = nextOverlayId++;
      overlays.set(id, overlay);
      publish();
      let result;
      try {
        result = await request();
      } catch (error) {
        overlays.delete(id);
        publish();
        // The write may have reached the server even though its reply did not reach us.
        void options.reconcile();
        throw error;
      }
      // Keep the overlay until the confirmed state contains the change, so the view never flashes back.
      if (needsSnapshot(result)) await options.reconcile();
      else confirm(result);
      overlays.delete(id);
      publish();
      return result;
    },
    reset(initial) {
      confirmed = initial;
      overlays.clear();
      options.publish(initial);
    },
  };
}
