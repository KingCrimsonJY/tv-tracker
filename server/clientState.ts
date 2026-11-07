import type {
  AppStateSnapshot,
  EpisodeMeta,
  ProgressDoc,
  SeasonDoc,
  StateMutationResult,
  StateUpserts,
  TitleDoc,
} from '../src/domain/types.ts';

const compactEpisode = (episode: EpisodeMeta): EpisodeMeta => ({
  ...episode,
  name: null,
  overview: {},
  stillPath: null,
});
const compactSeason = (season: SeasonDoc): SeasonDoc => ({ ...season, episodes: season.episodes.map(compactEpisode) });
function compactTitle(title: TitleDoc): TitleDoc {
  if (!title.upstreamChange) return title;
  const { seasons: _seasons, ...header } = title.upstreamChange;
  return { ...title, upstreamChange: header };
}
function compactProgress(progress: ProgressDoc): ProgressDoc {
  return progress.archivedWatched?.length
    ? {
        ...progress,
        archivedWatched: progress.archivedWatched.map((mark) => ({ ...mark, episode: compactEpisode(mark.episode) })),
      }
    : progress;
}
function mapValues<T, R>(items: Record<string, T>, map: (item: T) => R): Record<string, R> {
  return Object.fromEntries(Object.entries(items).map(([key, value]) => [key, map(value)]));
}
function compactUpserts(state: StateUpserts): StateUpserts {
  return {
    ...state,
    ...(state.titles ? { titles: mapValues(state.titles, compactTitle) } : {}),
    ...(state.seasonsByTitle
      ? { seasonsByTitle: mapValues(state.seasonsByTitle, (seasons) => seasons.map(compactSeason)) }
      : {}),
    ...(state.progressByTitle
      ? { progressByTitle: mapValues(state.progressByTitle, (progress) => mapValues(progress, compactProgress)) }
      : {}),
  };
}
export function clientSnapshot(state: AppStateSnapshot): AppStateSnapshot {
  return { ...state, ...compactUpserts(state) };
}
export function clientMutation(mutation: StateMutationResult): StateMutationResult {
  return { ...mutation, upserts: compactUpserts(mutation.upserts) };
}
