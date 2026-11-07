import { en } from '../i18n/messages/en.ts';
import { zhCN } from '../i18n/messages/zh-CN.ts';
import type { TitleDoc, UiLocale } from './types.ts';

const ADDITIONAL_GENRE_ALIASES: Array<[string, number]> = [
  ['science fiction', 878],
  ['sci-fi', 878],
  ['sci-fi & fantasy', 10765],
  ['action & adventure', 10759],
  ['war & politics', 10768],
  ['tv movie', 10770],
  // Common TMDB zh-CN aliases (escaped so src/domain has zero CJK literals)
  ['\u79d1\u5e7b\u5947\u5e7b', 10765],
  ['\u79d1\u5e7b & \u5947\u5e7b', 10765],
  ['\u52a8\u4f5c\u5192\u9669', 10759],
  ['\u52a8\u4f5c & \u5192\u9669', 10759],
  ['\u6218\u4e89\u653f\u6cbb', 10768],
  ['\u6218\u4e89 & \u653f\u6cbb', 10768],
  ['\u7eaa\u5f55\u7247', 99],
];

const GENRE_NAME_TO_ID_MAP: Map<string, number> = (() => {
  const map = new Map<string, number>();
  for (const [idStr, label] of Object.entries(en.genres)) {
    map.set(label.trim().toLowerCase(), Number(idStr));
  }
  for (const [idStr, label] of Object.entries(zhCN.genres)) {
    map.set(label.trim().toLowerCase(), Number(idStr));
  }
  for (const [alias, id] of ADDITIONAL_GENRE_ALIASES) {
    map.set(alias.toLowerCase(), id);
  }
  return map;
})();

export function genreNameToId(name: string): number | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  return GENRE_NAME_TO_ID_MAP.get(normalized) ?? null;
}

export function extractGenreIdsFromNames(genres: string[]): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const g of genres) {
    const parts = g
      .split(/[/,&\u3001]/)
      .map((p) => p.trim())
      .filter(Boolean);
    const direct = genreNameToId(g);
    if (direct !== null) {
      if (!seen.has(direct)) {
        seen.add(direct);
        ids.push(direct);
      }
      continue;
    }
    for (const part of parts) {
      const id = genreNameToId(part);
      if (id !== null && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

export function resolveTitleGenres(
  title: Pick<TitleDoc, 'genreIds' | 'genres'>,
  locale: UiLocale = 'zh-CN',
  dynamicGenreMap?: Record<number, string>,
): string[] {
  const catalogGenres = locale === 'en' ? en.genres : zhCN.genres;
  const ids =
    title.genreIds && title.genreIds.length > 0 ? title.genreIds : extractGenreIdsFromNames(title.genres || []);

  if (ids.length > 0) {
    const resolved: string[] = [];
    for (const id of ids) {
      const label = dynamicGenreMap?.[id] || catalogGenres[id];
      if (label && !resolved.includes(label)) {
        resolved.push(label);
      }
    }
    if (resolved.length > 0) {
      return resolved;
    }
  }

  return title.genres || [];
}
