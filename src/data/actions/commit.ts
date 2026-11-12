import type { StateMutationResult } from '../../domain/types.ts';
import { getActiveCatalog, translateErrorObject } from '../../i18n/index.ts';
import type { Overlay } from '../syncEngine.ts';
import type { TrackerActionDeps } from './types.ts';

/**
 * The one way actions write: apply `overlay` at once, send `request`, and on failure tell the user that the
 * change was undone (dropping the overlay is the undo). Resolves to whether the write was stored.
 */
export function createCommit({ optimistic, showToast }: Pick<TrackerActionDeps, 'optimistic' | 'showToast'>) {
  const reportFailure = (error: unknown) => {
    const catalog = getActiveCatalog();
    showToast(translateErrorObject(error, catalog, catalog.app.writeRollbackToast), 'danger');
  };
  return {
    /** For edits the user can simply repeat: failure is reported, not thrown. */
    async commit(overlay: Overlay, request: () => Promise<StateMutationResult>): Promise<boolean> {
      try {
        await optimistic(overlay, request);
        return true;
      } catch (error) {
        reportFailure(error);
        return false;
      }
    },
    /** For edits whose caller continues with the result (navigating to a new title or list). */
    async commitOrThrow(overlay: Overlay, request: () => Promise<StateMutationResult>): Promise<void> {
      try {
        await optimistic(overlay, request);
      } catch (error) {
        reportFailure(error);
        throw error;
      }
    },
  };
}

export type Commit = ReturnType<typeof createCommit>;
