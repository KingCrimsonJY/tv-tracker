import React from 'react';
import { Star } from 'lucide-react';
import { Chip } from '@heroui/react';
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

  const tmdbChip = (
    <Chip variant="soft" color="success" size="md">
      <Star className="w-3.5 h-3.5 fill-current" />
      <Chip.Label>
        {zh.detail.ratings.tmdb} {tmdbRating}
      </Chip.Label>
    </Chip>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {tmdbRating &&
        (tmdbUrl ? (
          <a
            href={tmdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
          >
            {tmdbChip}
          </a>
        ) : (
          tmdbChip
        ))}

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
          className="inline-flex"
        >
          <Chip variant="soft" color="warning" size="md">
            {zh.detail.ratings.imdb} {imdbRating}
          </Chip>
        </a>
      )}

      {rtRating && (
        <a
          href={`https://www.rottentomatoes.com/search?search=${encodeURIComponent(
            title.names.en || title.names.original
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex"
        >
          <Chip variant="soft" color="danger" size="md">
            {zh.detail.ratings.rottenTomatoes} {rtRating}
          </Chip>
        </a>
      )}

      {mcRating && (
        <Chip variant="soft" color="accent" size="md">
          {zh.detail.ratings.metacritic} {mcRating}
        </Chip>
      )}
    </div>
  );
};
