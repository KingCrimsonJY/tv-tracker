import React from 'react';
import { Star } from 'lucide-react';
import type { TitleDoc } from '../../domain/types';
import { zh } from '../../i18n/zh';

interface RatingsRowProps {
  title: TitleDoc;
  primary: string;
}

export const RatingsRow: React.FC<RatingsRowProps> = ({ title }) => {
  if (title.source === 'custom' || title.source === 'url') {
    return null;
  }

  const tmdbRating = title.ratings?.tmdb;
  const imdbRating = title.ratings?.imdb;
  const rtRating = title.ratings?.rottenTomatoes;
  const mcRating = title.ratings?.metacritic;

  if (!tmdbRating && !imdbRating && !rtRating && !mcRating) {
    return null;
  }

  const tmdbUrl = title.sourceId
    ? `https://www.themoviedb.org/${title.mediaType === 'tv' ? 'tv' : 'movie'}/${title.sourceId}`
    : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {tmdbRating && (
        tmdbUrl ? (
          <a
            href={tmdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 transition-colors"
          >
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>
              {zh.detail.ratings.tmdb} {tmdbRating}
            </span>
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 min-h-[32px] rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>
              {zh.detail.ratings.tmdb} {tmdbRating}
            </span>
          </span>
        )
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

