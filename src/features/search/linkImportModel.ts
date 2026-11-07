import type { LinkImportEpisodeSeed, LinkImportResult, MediaType } from '../../domain/types.ts';

export interface ManualSeed {
  title: string;
  mediaType: MediaType;
  posterUrl: string;
  overview: string;
  uploader?: string | null;
  year?: number | null;
  runtimeMin?: number | null;
  warning?: string;
  skippedCount?: number;
  episodeCount: number;
  episodes?: LinkImportEpisodeSeed[];
  source: 'url' | 'custom';
  sourceUrl: string | null;
}

export function linkResultToManualSeed(result: LinkImportResult): ManualSeed {
  return {
    title: result.title,
    skippedCount: result.skippedCount,
    mediaType: result.mediaType ?? 'other',
    posterUrl: result.posterUrl || '',
    overview: result.overview,
    uploader: result.uploader,
    year: result.year,
    runtimeMin: result.runtimeMin,
    warning: result.warning || (result.fallbackUsed === 'og' ? 'LINK_METADATA_INCOMPLETE' : undefined),
    episodeCount: result.episodes.length,
    episodes: result.episodes,
    source: 'url',
    sourceUrl: result.sourceUrl,
  };
}
