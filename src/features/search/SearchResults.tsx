import React from 'react';
import { Button, Chip, Dropdown, Label } from '@heroui/react';
import { Plus, Check, ListPlus } from 'lucide-react';
import { MediaImage } from '../../components/MediaImage';
import { TmdbSearchItem } from '../../data/api';
import { pickPoster, resolveDisplayTitle } from '../../domain/progress';
import { WatchListDoc, TitleDoc } from '../../domain/types';
import { useI18n } from '../../i18n';

interface SearchResultsProps {
  results: TmdbSearchItem[];
  existingTmdbKeys: Set<string>;
  titles: Record<string, TitleDoc>;
  lists: WatchListDoc[];
  addingKey: string | null;
  onAdd: (hit: TmdbSearchItem, targetListId?: string) => void;
  onOpenExisting: (titleId: string) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  existingTmdbKeys,
  titles,
  lists,
  addingKey,
  onAdd,
  onOpenExisting,
}) => {
  const { t, locale } = useI18n();

  return (
    <div className="space-y-2.5">
      {results.map((hit) => {
        const key = `${hit.mediaType}:${hit.sourceId}`;
        const inLibrary = existingTmdbKeys.has(key);
        const existingDoc = inLibrary
          ? Object.values(titles).find(
              (item) =>
                item.source === 'tmdb' &&
                item.sourceId === hit.sourceId &&
                item.mediaType === hit.mediaType
            )
          : undefined;
        const isAdding = addingKey === key;

        const { primary: mainTitle, secondary: originalSub } = resolveDisplayTitle(
          hit.names,
          null,
          'auto',
          locale
        );
        const posterSrc = pickPoster(hit, locale);

        return (
          <div
            key={key}
            className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-muted/50 transition-colors"
          >
            <div
              className={`flex items-center gap-3.5 min-w-0 flex-1 ${existingDoc ? 'cursor-pointer' : ''}`}
              onClick={() => existingDoc && onOpenExisting(existingDoc.id)}
            >
              <div className="w-12 h-18 rounded-lg overflow-hidden bg-surface-secondary shrink-0">
                <MediaImage
                  src={posterSrc}
                  alt={mainTitle}
                  aspect="poster"
                  mediaType={hit.mediaType}
                  className="w-full h-full"
                  compact
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm sm:text-base text-[var(--foreground)] truncate">
                  {mainTitle}
                </div>
                {originalSub && (
                  <div className="text-xs text-[var(--muted)] truncate">
                    {originalSub}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Chip size="sm" variant="soft">
                    {hit.mediaType === 'movie' ? t.mediaType.movie : t.mediaType.tv}
                  </Chip>
                  {hit.year && (
                    <span className="text-xs text-[var(--muted)]">{hit.year}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {inLibrary ? (
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={() => existingDoc && onOpenExisting(existingDoc.id)}
                >
                  <Check className="w-4 h-4 mr-1 text-success" />
                  {t.search.addedToLibrary}
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="primary"
                    isDisabled={isAdding}
                    onPress={() => onAdd(hit)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    {t.search.addToLibrary}
                  </Button>

                  {lists.length > 0 && (
                    <Dropdown>
                      <Button
                        size="sm"
                        variant="secondary"
                        isIconOnly
                        isDisabled={isAdding}
                        aria-label={t.search.addToList}
                      >
                        <ListPlus className="w-4 h-4" />
                      </Button>
                      <Dropdown.Popover>
                        <Dropdown.Menu
                          onAction={(listId) => onAdd(hit, String(listId))}
                        >
                          {lists.map((list) => (
                            <Dropdown.Item key={list.id} id={list.id}>
                              <Label>{list.name}</Label>
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
