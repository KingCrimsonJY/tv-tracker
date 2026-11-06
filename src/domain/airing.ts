import type {
  DefaultTitleLang,
  DisplayLang,
  EpisodeMeta,
  LocalizedText,
  SeasonDoc,
  ShowStatus,
  TitleDoc,
  TitleNames,
  TitleSource,
  UiLocale,
} from './types.ts';

/**
 * Formats a Date (or current local date) as `YYYY-MM-DD` in local timezone.
 */
export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a Season & Episode number into the canonical episode key `s{season}e{episode}`.
 */
export function makeEpisodeKey(seasonNumber: number, episodeNumber: number): string {
  return `s${seasonNumber}e${episodeNumber}`;
}

/**
 * Parses an episode key like `s2e5` into `{ seasonNumber: 2, episodeNumber: 5 }`.
 */
export function parseEpisodeKey(
  key: string
): { seasonNumber: number; episodeNumber: number } | null {
  const match = /^s(\d+)e(\d+)$/i.exec(key.trim());
  if (!match) return null;
  return {
    seasonNumber: Number(match[1]),
    episodeNumber: Number(match[2]),
  };
}

/**
 * Checks if an episode has aired on or before `todayStr` (`YYYY-MM-DD`).
 */
export function isEpisodeAired(
  episode: Pick<EpisodeMeta, 'airDate'>,
  todayStr: string = toLocalDateString(),
  treatAllAsAired = false
): boolean {
  if (treatAllAsAired) return true;
  if (!episode.airDate || episode.airDate.trim() === '') return false;
  return episode.airDate <= todayStr;
}

export function isShowEnded(showStatus: ShowStatus, source: TitleSource): boolean {
  if (source === 'custom' || source === 'url') return true;
  return showStatus === 'Ended' || showStatus === 'Canceled' || showStatus === 'Released';
}

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

  const airedKeys = new Set<string>();
  if (treatAllAsAired) {
    for (const s of seasons) {
      for (const ep of s.episodes) {
        airedKeys.add(ep.key);
      }
    }
    return airedKeys;
  }

  const sortedSeasons = [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);

  // Regular seasons (seasonNumber >= 1) in chronological order
  const regularSeasons = sortedSeasons.filter((s) => s.seasonNumber >= 1);
  const regularEntries: Array<{
    season: SeasonDoc;
    ep: EpisodeMeta;
    explicitlyAired: boolean;
    hasDate: boolean;
  }> = [];

  for (const s of regularSeasons) {
    const sortedEps = [...s.episodes].sort((a, b) => a.number - b.number);
    for (const ep of sortedEps) {
      const hasDate = Boolean(ep.airDate && ep.airDate.trim() !== '');
      const explicitlyAired = isEpisodeAired(ep, todayStr, false);
      regularEntries.push({ season: s, ep, explicitlyAired, hasDate });
    }
  }

  let seenExplicitAiredAfter = false;
  for (let i = regularEntries.length - 1; i >= 0; i--) {
    const entry = regularEntries[i];
    if (entry.explicitlyAired) {
      airedKeys.add(entry.ep.key);
      seenExplicitAiredAfter = true;
    } else if (!entry.hasDate) {
      const seasonAirDatePassed = Boolean(
        entry.season.airDate &&
          entry.season.airDate.trim() !== '' &&
          entry.season.airDate <= todayStr
      );
      if (showEnded || seenExplicitAiredAfter || seasonAirDatePassed) {
        airedKeys.add(entry.ep.key);
      }
    }
  }

  // Specials (seasonNumber < 1)
  for (const s of sortedSeasons) {
    if (s.seasonNumber >= 1) continue;
    const sortedEps = [...s.episodes].sort((a, b) => a.number - b.number);
    let seenSpecialAiredAfter = false;
    const seasonAirDatePassed = Boolean(
      s.airDate && s.airDate.trim() !== '' && s.airDate <= todayStr
    );
    for (let i = sortedEps.length - 1; i >= 0; i--) {
      const ep = sortedEps[i];
      const hasDate = Boolean(ep.airDate && ep.airDate.trim() !== '');
      const explicitlyAired = isEpisodeAired(ep, todayStr, false);
      if (explicitlyAired) {
        airedKeys.add(ep.key);
        seenSpecialAiredAfter = true;
      } else if (!hasDate && (seenSpecialAiredAfter || seasonAirDatePassed)) {
        airedKeys.add(ep.key);
      }
    }
  }

  return airedKeys;
}

export interface CountableEpisode extends EpisodeMeta {
  seasonNumber: number;
}

export function getCountableEpisodes(
  seasons: SeasonDoc[],
  options: {
    includeSpecials?: boolean;
    todayStr?: string;
    treatAllAsAired?: boolean;
    showEnded?: boolean;
  } = {}
): {
  countable: CountableEpisode[];
  allRegularEpisodesCount: number;
  hasAnyAiredEpisode: boolean;
} {
  const {
    includeSpecials = false,
    todayStr = toLocalDateString(),
    treatAllAsAired = false,
    showEnded = false,
  } = options;

  const sortedSeasons = [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  const airedKeys = buildAiredEpisodeKeySet(sortedSeasons, {
    todayStr,
    treatAllAsAired,
    showEnded,
  });

  const countable: CountableEpisode[] = [];
  let allRegularEpisodesCount = 0;
  let hasAnyAiredEpisode = false;

  for (const season of sortedSeasons) {
    const isSpecial = season.seasonNumber === 0;
    const sortedEpisodes = [...season.episodes].sort((a, b) => a.number - b.number);

    for (const ep of sortedEpisodes) {
      if (!isSpecial) {
        allRegularEpisodesCount++;
      }
      const aired = airedKeys.has(ep.key);
      if (aired && !isSpecial) {
        hasAnyAiredEpisode = true;
      }
      if (isSpecial && !includeSpecials) {
        continue;
      }
      if (aired) {
        countable.push({
          ...ep,
          seasonNumber: season.seasonNumber,
        });
      }
    }
  }

  return {
    countable,
    allRegularEpisodesCount,
    hasAnyAiredEpisode,
  };
}

/**
 * Checks whether a season name is a generic auto-generated label
 * (e.g. "Season N", "Specials", or their Chinese equivalents).
 */
export function isGenericSeasonLabel(raw: string | null | undefined): boolean {
  if (!raw) return true;
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (/^\u7b2c\s*\d+\s*\u5b63$/u.test(trimmed)) return true;
  if (/^\u7279\u522b\u7bc7$/u.test(trimmed)) return true;
  if (/^\u9ed8\u8ba4\u5b63$/u.test(trimmed)) return true;
  if (/^season\s+\d+$/i.test(trimmed)) return true;
  if (/^series\s+\d+$/i.test(trimmed)) return true;
  if (/^specials?$/i.test(trimmed)) return true;
  return false;
}

/**
 * Checks whether an episode name is a generic auto-generated label
 * (e.g. "Episode N", "Ep N", or its Chinese equivalent).
 */
export function isGenericEpisodeLabel(raw: string | null | undefined): boolean {
  if (!raw) return true;
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (/^\u7b2c\s*\d+\s*\u96c6$/u.test(trimmed)) return true;
  if (/^episode\s+\d+$/i.test(trimmed)) return true;
  if (/^ep\.?\s*\d+$/i.test(trimmed)) return true;
  return false;
}

export function normalizeLocalizedSeasonName(
  input: LocalizedText | string | null | undefined
): LocalizedText | null {
  if (input == null) return null;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed || isGenericSeasonLabel(trimmed)) return null;
    return { zh: trimmed };
  }
  const zh = input.zh?.trim();
  const en = input.en?.trim();
  const cleanZh = zh && !isGenericSeasonLabel(zh) ? zh : undefined;
  const cleanEn = en && !isGenericSeasonLabel(en) ? en : undefined;
  if (!cleanZh && !cleanEn) return null;
  return {
    ...(cleanZh ? { zh: cleanZh } : {}),
    ...(cleanEn ? { en: cleanEn } : {}),
  };
}

export function normalizeLocalizedEpisodeName(
  input: LocalizedText | string | null | undefined
): LocalizedText | null {
  if (input == null) return null;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed || isGenericEpisodeLabel(trimmed)) return null;
    return { zh: trimmed };
  }
  const zh = input.zh?.trim();
  const en = input.en?.trim();
  const cleanZh = zh && !isGenericEpisodeLabel(zh) ? zh : undefined;
  const cleanEn = en && !isGenericEpisodeLabel(en) ? en : undefined;
  if (!cleanZh && !cleanEn) return null;
  return {
    ...(cleanZh ? { zh: cleanZh } : {}),
    ...(cleanEn ? { en: cleanEn } : {}),
  };
}

export function resolveLocalizedText(
  text: LocalizedText | string | null | undefined,
  activeLocale: UiLocale = 'zh-CN'
): string | null {
  if (!text) return null;
  if (typeof text === 'string') {
    const trimmed = text.trim();
    return trimmed || null;
  }
  if (activeLocale === 'en') {
    return text.en?.trim() || text.zh?.trim() || null;
  }
  return text.zh?.trim() || text.en?.trim() || null;
}

/**
 * Splits a legacy uploader prefix ("Author: xxx" or "xxx · desc") from link-import overviews.
 */
export function splitUploaderPrefixFromOverview(
  overview: string | undefined | null,
  existingUploader?: string | null
): { overview: string; uploader: string | null } {
  const raw = (overview || '').trim();
  const cleanExisting = existingUploader?.trim() || null;
  if (!raw) {
    return { overview: '', uploader: cleanExisting };
  }

  const prefixMatch = /^(?:\u4f5c\u8005|Author)[\uff1a:]\s*(.+)$/isu.exec(raw);
  if (prefixMatch?.[1]) {
    const rest = prefixMatch[1].trim();
    const dotIdx = rest.indexOf(' \u00b7 ');
    if (dotIdx !== -1) {
      const up = rest.slice(0, dotIdx).trim();
      const ov = rest.slice(dotIdx + 3).trim();
      return {
        overview: ov,
        uploader: cleanExisting || up || null,
      };
    }
    const nlIdx = rest.indexOf('\n');
    if (nlIdx !== -1) {
      const up = rest.slice(0, nlIdx).trim();
      const ov = rest.slice(nlIdx + 1).trim();
      return {
        overview: ov,
        uploader: cleanExisting || up || null,
      };
    }
    return {
      overview: '',
      uploader: cleanExisting || rest || null,
    };
  }

  if (cleanExisting && raw.startsWith(`${cleanExisting} \u00b7 `)) {
    return {
      overview: raw.slice(`${cleanExisting} \u00b7 `.length).trim(),
      uploader: cleanExisting,
    };
  }

  return { overview: raw, uploader: cleanExisting };
}

/**
 * Resolves the display title and optional secondary original title.
 * Display order: active/selected language, then the other language, then the original.
 * When global defaultLang is unset ('auto' or null), it follows activeLocale.
 */
export function resolveDisplayTitle(
  names: TitleNames,
  titleLang: DisplayLang | null,
  defaultLang: DefaultTitleLang = 'auto',
  activeLocale: UiLocale = 'zh-CN'
): { primary: string; secondary: string | null } {
  let effectivePref: DisplayLang;
  if (titleLang) {
    effectivePref = titleLang;
  } else if (defaultLang === 'zh' || defaultLang === 'en' || defaultLang === 'original') {
    effectivePref = defaultLang;
  } else {
    effectivePref = activeLocale === 'en' ? 'en' : 'zh';
  }

  let primary: string;
  if (effectivePref === 'custom' && names.custom?.trim()) {
    primary = names.custom.trim();
  } else if (effectivePref === 'original') {
    primary =
      names.original ||
      (activeLocale === 'en' ? names.en || names.zh : names.zh || names.en) ||
      '';
  } else if (effectivePref === 'en') {
    primary = names.en || names.zh || names.original || '';
  } else {
    primary = names.zh || names.en || names.original || '';
  }

  const secondary =
    names.original && names.original !== primary ? names.original : null;

  return { primary, secondary };
}

export function resolveOverviewText(
  title: Pick<TitleDoc, 'overview' | 'displayLang' | 'source'>,
  defaultLang: DefaultTitleLang = 'auto',
  activeLocale: UiLocale = 'zh-CN'
): string {
  if (title.source === 'url' || title.source === 'custom') {
    return title.overview.zh || title.overview.en || '';
  }
  let targetLang: 'zh' | 'en';
  if (title.displayLang === 'en') {
    targetLang = 'en';
  } else if (title.displayLang === 'zh') {
    targetLang = 'zh';
  } else if (defaultLang === 'en') {
    targetLang = 'en';
  } else if (defaultLang === 'zh') {
    targetLang = 'zh';
  } else {
    targetLang = activeLocale === 'en' ? 'en' : 'zh';
  }
  return targetLang === 'en'
    ? title.overview.en || title.overview.zh || ''
    : title.overview.zh || title.overview.en || '';
}
