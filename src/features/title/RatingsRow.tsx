import React from 'react';
import { Chip } from '@heroui/react';
import { TitleDoc } from '../../domain/types';
import { useI18n } from '../../i18n';

interface RatingsRowProps {
  title: TitleDoc;
}

interface RatingChipItem {
  key: string;
  label: string;
  score?: string;
  href?: string;
  valueColorClass?: string;
}

function getMetacriticValueColor(rawScore: string): string {
  const num = Number.parseInt(rawScore, 10);
  if (Number.isNaN(num)) return 'text-foreground';
  if (num >= 61) return 'text-success';
  if (num >= 40) return 'text-warning';
  return 'text-danger';
}

export const RatingsRow: React.FC<RatingsRowProps> = ({ title }) => {
  const { ratings, externalIds } = title;
  const { t } = useI18n();

  const items: RatingChipItem[] = [];

  if (ratings.tmdb && title.source === 'tmdb' && title.sourceId) {
    items.push({
      key: 'tmdb',
      label: t.detail.ratings.tmdb,
      score: ratings.tmdb,
      href: `https://www.themoviedb.org/${title.mediaType === 'tv' ? 'tv' : 'movie'}/${title.sourceId}`,
    });
  }

  if (ratings.imdb) {
    items.push({
      key: 'imdb',
      label: t.detail.ratings.imdb,
      score: ratings.imdb,
      href: externalIds.imdb ? `https://www.imdb.com/title/${externalIds.imdb}/` : undefined,
    });
  }

  if (ratings.rottenTomatoes) {
    const rtQuery = title.names.en || title.names.original || title.names.zh || '';
    items.push({
      key: 'rt',
      label: t.detail.ratings.rottenTomatoes,
      score: ratings.rottenTomatoes,
      href: rtQuery ? `https://www.rottentomatoes.com/search?search=${encodeURIComponent(rtQuery)}` : undefined,
    });
  }

  if (ratings.metacritic) {
    const mcQuery = title.names.en || title.names.original || title.names.zh || '';
    items.push({
      key: 'mc',
      label: t.detail.ratings.metacritic,
      score: ratings.metacritic,
      href: mcQuery ? `https://www.metacritic.com/search/${encodeURIComponent(mcQuery)}/` : undefined,
      valueColorClass: getMetacriticValueColor(ratings.metacritic),
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item) => {
        const chipNode = (
          <Chip size="sm" variant="soft" color="default">
            <Chip.Label className="inline-flex items-center gap-1.5">
              <span className="text-muted">{item.label}</span>
              {item.score && (
                <span className={`font-semibold tabular-nums ${item.valueColorClass || 'text-foreground'}`}>
                  {item.score}
                </span>
              )}
            </Chip.Label>
          </Chip>
        );

        if (item.href) {
          return (
            <a
              key={item.key}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {chipNode}
            </a>
          );
        }

        return <React.Fragment key={item.key}>{chipNode}</React.Fragment>;
      })}
    </div>
  );
};
