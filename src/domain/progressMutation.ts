import type { ProgressDoc, TitleAtomicProgressMutation } from './types.ts';

/**
 * Apply one progress write to one playthrough. The server stores the result and the client shows the same
 * result while the request is in flight, so both must use this function.
 *
 * `replaceWatched` replaces every mark of the viewing, including the ones set aside for episodes the source
 * has removed: a cleared viewing must stay empty when such an episode comes back.
 */
export function applyProgressMutation(
  current: ProgressDoc | undefined,
  playthroughId: string,
  mutation: Pick<TitleAtomicProgressMutation, 'set' | 'unset' | 'movieWatchedAt' | 'replaceWatched'>,
): ProgressDoc {
  const watched = { ...(mutation.replaceWatched ?? current?.watched ?? {}), ...mutation.set };
  for (const key of mutation.unset ?? []) delete watched[key];
  const movieWatchedAt =
    mutation.movieWatchedAt === null ? undefined : (mutation.movieWatchedAt ?? current?.movieWatchedAt);
  return {
    playthroughId,
    watched,
    ...(current?.archivedWatched && !mutation.replaceWatched ? { archivedWatched: current.archivedWatched } : {}),
    ...(movieWatchedAt !== undefined ? { movieWatchedAt } : {}),
  };
}
