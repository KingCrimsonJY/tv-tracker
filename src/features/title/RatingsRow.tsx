import React from 'react';
import { Star, ExternalLink } from 'lucide-react';
import { TitleDoc } from '../../domain/types';
import { useI18n } from '../../i18n';

export const RatingsRow: React.FC<{
  title: TitleDoc;
}> = ({ title }) => {
  const { t } = useI18n();
  const { ratings } = title;

  const chips: Array<{
    key: string;
    label: string;
    value: string;
    href?: string | null;
  }> = [];

  if (ratings.doubanManualScore) {
    const searchQuery = encodeURIComponent(
      title.names.zh || title.names.original || title.names.en || ''
    );
    chips.push({
      key: 'douban',
      label: t.detail.ratings.douban,
      value: ratings.doubanManualScore,
      href:
        ratings.doubanUrl ||
        `https://search.douban.com/movie/subject_search?search_text=${searchQuery}`,
    });
  }

  if (ratings.tmdb) {
    chips.push({
      key: 'tmdb',
      label: t.detail.ratings.tmdb,
      value: ratings.tmdb,
      href:
        title.source === 'tmdb' && title.sourceId
          ? `https://www.themoviedb.org/${title.mediaType === 'movie' ? 'movie' : 'tv'}/${title.sourceId}`
          : null,
    });
  }

  if (ratings.imdb) {
    chips.push({
      key: 'imdb',
      label: t.detail.ratings.imdb,
      value: ratings.imdb,
      href: title.externalIds?.imdb
        ? `https://www.imdb.com/title/${title.externalIds.imdb}/`
        : null,
    });
  }

  if (ratings.rottenTomatoes) {
    chips.push({
      key: 'rt',
      label: t.detail.ratings.rottenTomatoes,
      value: ratings.rottenTomatoes,
      href: null,
    });
  }

  if (ratings.metacritic) {
    chips.push({
      key: 'mc',
      label: t.detail.ratings.metacritic,
      value: ratings.metacritic,
      href: null,
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => {
        const inner = (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-default-100/70 border border-[var(--border)] text-xs font-medium text-[var(--foreground)] hover:bg-default-200/70 transition-colors">
            <Star className="w-3 h-3 text-warning fill-warning" />
            <span className="text-[var(--muted)]">{chip.label}</span>
            <span className="font-semibold">{chip.value}</span>
            {chip.href && <ExternalLink className="w-3 h-3 text-[var(--muted)] ml-0.5" />}
          </span>
        );

        return chip.href ? (
          <a
            key={chip.key}
            href={chip.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {inner}
          </a>
        ) : (
          <span key={chip.key}>{inner}</span>
        );
      })}
    </div>
  );
};
