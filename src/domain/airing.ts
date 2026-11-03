import type { DisplayLang, EpisodeMeta, LocalizedNames, SeasonDoc, TitleDoc } from './types.ts';

export interface CountableEpisode extends EpisodeMeta {
  seasonNumber: number;
}

/**
 * Formats season and episode numbers into `s{season}e{episode}` key (e.g. `s2e5`).
 */
export function makeEpisodeKey(seasonNumber: number, episodeNumber: number): string {
  return `s${seasonNumber}e${episodeNumber}`;
}

/**
 * Parses `s{season}e{episode}` key into season and episode numbers.
 */
export function parseEpisodeKey(key: string): { seasonNumber: number; episodeNumber: number } | null {
  const match = /^s(\d+)e(\d+)$/i.exec(key.trim());
  if (!match) return null;
  return {
    seasonNumber: Number(match[1]),
    episodeNumber: Number(match[2]),
  };
}

/**
 * Formats `s2e5` into `S2·E5` for display.
 */
export function formatEpisodeBadge(key: string): string {
  const parsed = parseEpisodeKey(key);
  if (!parsed) return key.toUpperCase();
  return `S${parsed.seasonNumber}·E${parsed.episodeNumber}`;
}

/**
 * Returns local YYYY-MM-DD date string from a Date or timestamp.
 */
export function toLocalDateString(dateOrTs: Date | number = new Date()): string {
  const d = typeof dateOrTs === 'number' ? new Date(dateOrTs) : dateOrTs;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns whether a show's status counts as permanently finished (Ended or Canceled).
 * Custom items with episodes are also treated as ended.
 */
export function isShowEnded(
  showStatus: string | null | undefined,
  source: TitleDoc['source'] = 'tmdb'
): boolean {
  if (source === 'custom' || source === 'url') return true;
  if (!showStatus) return false;
  const normalized = showStatus.trim().toLowerCase();
  return normalized === 'ended' || normalized === 'canceled' || normalized === 'cancelled';
}

function hasExplicitAirDate(ep: Pick<EpisodeMeta, 'airDate'>): boolean {
  return Boolean(ep.airDate && typeof ep.airDate === 'string' && ep.airDate.trim().length > 0);
}

/**
 * Definition:
 * - Has an explicit airDate and airDate <= today (user's local date).
 * - If an episode has NO airDate, treat it as aired if:
 *   1. `treatAllAsAired` is true (custom/url item), OR
 *   2. the show is Ended/Canceled (`showEnded`), OR
 *   3. any later episode has aired (`laterEpisodeAired`).
 */
export function isEpisodeAired(
  ep: Pick<EpisodeMeta, 'airDate'>,
  todayStr: string = toLocalDateString(),
  treatAllAsAired: boolean = false,
  options: {
    showEnded?: boolean;
    laterEpisodeAired?: boolean;
  } = {}
): boolean {
  const trimmedDate = ep.airDate?.trim();
  if (treatAllAsAired) return true;
  if (trimmedDate) {
    return trimmedDate <= todayStr;
  }
  return Boolean(options.showEnded || options.laterEpisodeAired);
}

/**
 * Returns sorted seasons and episodes in canonical order (by seasonNumber, then episode.number).
 */
export function sortSeasons(seasons: SeasonDoc[]): SeasonDoc[] {
  return [...seasons]
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .map((s) => ({
      ...s,
      episodes: [...s.episodes].sort((a, b) => a.number - b.number),
    }));
}

/**
 * Builds the set of episode keys (`s{season}e{ep}`) that are considered aired
 * across a list of seasons, applying the missing-airDate rule.
 */
export function buildAiredEpisodeKeySet(
  seasons: SeasonDoc[],
  options: {
    todayStr?: string;
    treatAllAsAired?: boolean;
    showEnded?: boolean;
  } = {}
): Set<string> {
  const {
    todayStr = toLocalDateString(),
    treatAllAsAired = false,
    showEnded = false,
  } = options;

  const sorted = sortSeasons(seasons);
  const airedKeys = new Set<string>();

  const regularSeasons = sorted.filter((s) => s.seasonNumber >= 1);
  let seenLaterAiredInShow = false;

  for (let sIdx = regularSeasons.length - 1; sIdx >= 0; sIdx--) {
    const season = regularSeasons[sIdx];
    for (let eIdx = season.episodes.length - 1; eIdx >= 0; eIdx--) {
      const ep = season.episodes[eIdx];
      const key = ep.key || makeEpisodeKey(season.seasonNumber, ep.number);
      const aired = isEpisodeAired(ep, todayStr, treatAllAsAired, {
        showEnded,
        laterEpisodeAired: seenLaterAiredInShow,
      });
      if (aired) {
        airedKeys.add(key);
        if (hasExplicitAirDate(ep) || treatAllAsAired) {
          seenLaterAiredInShow = true;
        }
      }
    }
  }

  const specialSeasons = sorted.filter((s) => s.seasonNumber === 0);
  for (const season of specialSeasons) {
    let seenLaterAiredInSpecials = false;
    for (let eIdx = season.episodes.length - 1; eIdx >= 0; eIdx--) {
      const ep = season.episodes[eIdx];
      const key = ep.key || makeEpisodeKey(season.seasonNumber, ep.number);
      const aired = isEpisodeAired(ep, todayStr, treatAllAsAired, {
        showEnded,
        laterEpisodeAired: seenLaterAiredInSpecials,
      });
      if (aired) {
        airedKeys.add(key);
        if (hasExplicitAirDate(ep) || treatAllAsAired) {
          seenLaterAiredInSpecials = true;
        }
      }
    }
  }

  return airedKeys;
}

/**
 * Returns all countable episodes in order:
 * aired episodes in seasons >= 1 (or season 0 if includeSpecials is true).
 */
export function getCountableEpisodes(
  seasons: SeasonDoc[],
  options: {
    includeSpecials?: boolean;
    todayStr?: string;
    treatAllAsAired?: boolean;
    showEnded?: boolean;
  } = {}
): CountableEpisode[] {
  const {
    includeSpecials = false,
    todayStr = toLocalDateString(),
    treatAllAsAired = false,
    showEnded = false,
  } = options;

  const sorted = sortSeasons(seasons);
  const airedKeys = buildAiredEpisodeKeySet(sorted, {
    todayStr,
    treatAllAsAired,
    showEnded,
  });
  const result: CountableEpisode[] = [];

  for (const season of sorted) {
    if (season.seasonNumber < 0) continue;
    if (season.seasonNumber === 0 && !includeSpecials) continue;

    for (const ep of season.episodes) {
      const key = ep.key || makeEpisodeKey(season.seasonNumber, ep.number);
      if (airedKeys.has(key)) {
        result.push({
          ...ep,
          key,
          seasonNumber: season.seasonNumber,
        });
      }
    }
  }

  return result;
}

/**
 * Resolves the display title and subtitle (original title if different) for a title.
 */
export function resolveDisplayTitle(
  names: LocalizedNames,
  titleLang: DisplayLang | null,
  defaultLang: 'zh' | 'original' | 'en' = 'zh'
): { primary: string; secondary: string | null } {
  const effective = titleLang ?? defaultLang;
  let primary = names.original;

  if (effective === 'custom' && names.custom) {
    primary = names.custom;
  } else if (effective === 'zh') {
    primary = names.zh || names.original || names.en || '未命名';
  } else if (effective === 'en') {
    primary = names.en || names.original || names.zh || 'Untitled';
  } else {
    primary = names.original || names.zh || names.en || 'Untitled';
  }

  const secondary =
    names.original && names.original.trim() !== primary.trim() ? names.original : null;

  return { primary, secondary };
}
