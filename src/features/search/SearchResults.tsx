import React from 'react';
import { Check, FolderPlus, Loader2, Plus, Search } from 'lucide-react';
import { MediaImage } from '../../components/MediaImage';
import type { TitleDoc } from '../../domain/types';
import { zh } from '../../i18n/zh';

export interface TmdbSearchHit {
  sourceId: string;
  mediaType: 'movie' | 'tv';
  names: { zh?: string; original: string; en?: string };
  year?: number | null;
  posterPath?: string | null;
  backdropPath?: string | null;
  overview?: string;
}

interface SearchResultsProps {
  query: string;
  onQueryChange: (q: string) => void;
  searching: boolean;
  tmdbConfigured: boolean;
  results: TmdbSearchHit[];
  titles: Record<string, TitleDoc>;
  addingId: string | null;
  onAddTmdbHit: (hit: TmdbSearchHit) => void;
  onOpenAddToList: (hit: TmdbSearchHit) => void;
  onNavigateTitle: (id: string) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  query,
  onQueryChange,
  searching,
  tmdbConfigured,
  results,
  titles,
  addingId,
  onAddTmdbHit,
  onOpenAddToList,
  onNavigateTitle,
}) => {
  return (
    <section className="space-y-5">
      <div className="relative max-w-2xl">
        <Search className="w-5 h-5 text-[var(--muted)] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={zh.search.placeholder}
          autoFocus
          className="w-full h-12 pl-12 pr-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] text-sm sm:text-base text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label={zh.search.clearSearchAria}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            ✕
          </button>
        )}
      </div>

      {!tmdbConfigured && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs sm:text-sm text-amber-200 max-w-2xl">
          {zh.search.tmdbUnconfiguredHint}
        </div>
      )}

      {searching ? (
        <div className="py-12 flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{zh.search.searching}</span>
        </div>
      ) : query.trim() && results.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--muted)]">
          {zh.search.noResults}
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-w-5xl">
          {results.map((hit) => {
            const id = `tmdb_${hit.mediaType}_${hit.sourceId}`;
            const inLibrary = Boolean(titles[id]);
            const isAdding = addingId === id;
            const zhTitle = hit.names.zh || hit.names.original;
            const origTitle =
              hit.names.original && hit.names.original !== zhTitle
                ? hit.names.original
                : undefined;

            return (
              <div
                key={id}
                className="flex items-center gap-3.5 p-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] transition-colors"
              >
                <div className="w-16 shrink-0 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface-secondary)]">
                  <MediaImage
                    src={hit.posterPath}
                    alt={zhTitle}
                    aspect="poster"
                    mediaType={hit.mediaType}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--foreground)] truncate">
                    {zhTitle}
                  </h3>
                  {origTitle && (
                    <p className="text-xs text-[var(--muted)] truncate">
                      {origTitle}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted)] tabular-nums">
                    {hit.year && <span>{hit.year}</span>}
                    {hit.year && <span aria-hidden="true">·</span>}
                    <span>{zh.mediaType[hit.mediaType]}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {inLibrary ? (
                    <button
                      type="button"
                      onClick={() => onNavigateTitle(id)}
                      className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-text)] flex items-center gap-1.5 text-xs font-medium"
                    >
                      <Check className="w-4 h-4" />
                      <span>{zh.search.addedToLibrary}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isAdding}
                      onClick={() => onAddTmdbHit(hit)}
                      aria-label={`${zh.search.addToLibrary} ${zhTitle}`}
                      className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] hover:opacity-90 flex items-center gap-1 text-xs font-medium transition-opacity disabled:opacity-50"
                    >
                      {isAdding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span>{zh.search.addToLibrary}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onOpenAddToList(hit)}
                    aria-label={zh.search.addToListAria(zhTitle)}
                    title={zh.search.addToList}
                    className="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-[var(--muted)] max-w-md mx-auto space-y-2">
          <p className="font-medium text-[var(--foreground-secondary)]">
            {zh.search.searchPromptTitle}
          </p>
          <p className="text-xs leading-relaxed">
            {zh.search.searchPromptSubtitle}
          </p>
        </div>
      )}
    </section>
  );
};
