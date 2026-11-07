import { parseEpisodeKey } from '../../domain/airing';

export interface SeasonSelection {
  seasonNumber: number;
  appliedLink: string | null;
}

export function resolveSeasonSelection(
  previous: SeasonSelection,
  seasonNumbers: number[],
  episodeLink: string | null,
): SeasonSelection {
  const linkedSeason = episodeLink ? parseEpisodeKey(episodeLink)?.seasonNumber : undefined;
  if (episodeLink !== previous.appliedLink && linkedSeason && seasonNumbers.includes(linkedSeason)) {
    return { seasonNumber: linkedSeason, appliedLink: episodeLink };
  }
  const seasonNumber = seasonNumbers.includes(previous.seasonNumber)
    ? previous.seasonNumber : seasonNumbers[0] ?? 1;
  const appliedLink = episodeLink ? previous.appliedLink : null;
  return seasonNumber === previous.seasonNumber && appliedLink === previous.appliedLink
    ? previous : { seasonNumber, appliedLink };
}
