import type { TmdbSearchItem } from '../../src/domain/types.ts';
import type { SearchResultDto } from './tmdb.ts';
export function toTmdbSearchItem(item: SearchResultDto, language: 'zh-CN' | 'en-US' = 'zh-CN'): TmdbSearchItem {
  return {
    id: `tmdb_${item.mediaType}_${item.sourceId}`,
    sourceId: item.sourceId,
    mediaType: item.mediaType,
    names: item.names,
    year: item.year,
    releaseDate: item.releaseDate,
    posterPath: item.posterPath,
    backdropPath: null,
    overview: language === 'en-US' ? { en: item.overview } : { zh: item.overview },
  };
}
