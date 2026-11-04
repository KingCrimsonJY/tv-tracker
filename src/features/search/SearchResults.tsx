import React from 'react';
import { Check, FolderPlus, Plus } from 'lucide-react';
import { Alert, Button, SearchField, Spinner } from '@heroui/react';
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
      <SearchField
        aria-label={zh.search.title}
        value={query}
        onChange={onQueryChange}
        fullWidth
        className="max-w-2xl"
      >
        <SearchField.Group className="w-full h-12 px-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center gap-3">
          <SearchField.SearchIcon className="w-5 h-5 text-[var(--muted)] shrink-0" />
          <SearchField.Input
            placeholder={zh.search.placeholder}
            autoFocus
            className="flex-1 bg-transparent text-sm sm:text-base text-[var(--foreground)] placeholder:text-[var(--muted)] outline-none"
          />
          <SearchField.ClearButton aria-label={zh.search.clearSearchAria} />
        </SearchField.Group>
      </SearchField>

      {!tmdbConfigured && (
        <Alert status="warning" className="max-w-2xl rounded-2xl">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description className="text-xs sm:text-sm">
              {zh.search.tmdbUnconfiguredHint}
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {searching ? (
        <div className="py-12 flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
          <Spinner size="sm" />
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
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => onNavigateTitle(id)}
                      className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-text)] gap-1.5 text-xs font-medium"
                    >
                      <Check className="w-4 h-4" />
                      <span>{zh.search.addedToLibrary}</span>
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      isPending={isAdding}
                      onPress={() => onAddTmdbHit(hit)}
                      aria-label={`${zh.search.addToLibrary} ${zhTitle}`}
                      className="min-w-[44px] min-h-[44px] px-3 rounded-xl gap-1 text-xs font-medium"
                    >
                      {isAdding ? (
                        <Spinner size="sm" color="current" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span>{zh.search.addToLibrary}</span>
                    </Button>
                  )}

                  <Button
                    variant="secondary"
                    isIconOnly
                    onPress={() => onOpenAddToList(hit)}
                    aria-label={zh.search.addToListAria(zhTitle)}
                    className="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </Button>
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
