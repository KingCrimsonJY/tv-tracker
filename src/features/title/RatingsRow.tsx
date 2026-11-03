import React from 'react';
import { ExternalLink, Star } from 'lucide-react';
import type { TitleDoc } from '../../domain/types';
import { zh } from '../../i18n/zh';

interface RatingsRowProps {
  title: TitleDoc;
  primary: string;
}

export const RatingsRow: React.FC<RatingsRowProps> = ({ title, primary }) => {
  const doubanSearchUrl = `https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(
    title.names.zh || title.names.original || primary
  )}`;
  const effectiveDoubanScore = title.ratings?.douban;
  const doubanId = title.externalIds?.douban;
  const effectiveDoubanUrl = doubanId
    ? doubanId.startsWith('http')
      ? doubanId
      : `https://movie.douban.com/subject/${doubanId}/`
    : doubanSearchUrl;
  const imdbRating = title.ratings?.imdb;
  const rtRating = title.ratings?.rottenTomatoes;
  const mcRating = title.ratings?.metacritic;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {effectiveDoubanScore ? (
        <a
          href={effectiveDoubanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition-colors"
        >
          <Star className="w-3.5 h-3.5 fill-current" />
          <span>
            {zh.detail.ratings.douban} {effectiveDoubanScore}
          </span>
        </a>
      ) : (
        <a
          href={effectiveDoubanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[32px] rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] text-xs transition-colors"
        >
          <span>{zh.detail.ratings.searchOnDouban}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      )}

      {imdbRating && (
        <a
          href={
            title.externalIds?.imdb
              ? `https://www.imdb.com/title/${title.externalIds.imdb}/`
              : `https://www.imdb.com/find/?q=${encodeURIComponent(
                  title.names.en || title.names.original
                )}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium hover:bg-amber-500/25 transition-colors"
        >
          <span>
            {zh.detail.ratings.imdb} {imdbRating}
          </span>
        </a>
      )}

      {rtRating && (
        <a
          href={`https://www.rottentomatoes.com/search?search=${encodeURIComponent(
            title.names.en || title.names.original
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-medium hover:bg-red-500/25 transition-colors"
        >
          <span>
            {zh.detail.ratings.rottenTomatoes} {rtRating}
          </span>
        </a>
      )}

      {mcRating && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-medium">
          <span>
            {zh.detail.ratings.metacritic} {mcRating}
          </span>
        </span>
      )}
    </div>
  );
};
