import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchField, Button, Skeleton, toast } from '@heroui/react';
import { Link2, PlusCircle } from 'lucide-react';
import { useTracker } from '../context/TrackerContext';
import { selectLists, selectTitles } from '../data/selectors';
import { useTrackerState } from '../data/useTrackerState';
import { searchTmdbApi, TmdbSearchItem } from '../data/api';
import { SearchResults } from '../features/search/SearchResults';
import { LinkImportDialog } from '../features/search/LinkImportDialog';
import type { ManualSeed } from '../features/search/linkImportModel';
import { ManualItemDialog } from '../features/search/ManualItemDialog';
import { useI18n } from '../i18n';
import { useSearchQueryParam } from '../hooks/useSearchQueryParam';

// Recent results survive opening a title and coming back, so Back shows the list without a refetch.
const recentSearches = new Map<string, TmdbSearchItem[]>();
const rememberSearch = (key: string, results: TmdbSearchItem[]) => {
  recentSearches.delete(key);
  recentSearches.set(key, results);
  if (recentSearches.size > 20) recentSearches.delete(recentSearches.keys().next().value ?? key);
};

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { addTitleFromTmdb } = useTracker();
  const titles = useTrackerState(selectTitles);
  const lists = useTrackerState(selectLists);
  const { t, locale, translateError } = useI18n();

  // Mirrored into ?q= so browser Back from a result returns to the same search.
  const [query, setQuery] = useSearchQueryParam('q');
  const searchLang = locale === 'en' ? 'en-US' : 'zh-CN';
  const [results, setResults] = useState<TmdbSearchItem[]>(
    () => recentSearches.get(`${searchLang}:${query.trim()}`) ?? [],
  );
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualSeed, setManualSeed] = useState<ManualSeed | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }

    const cacheKey = `${searchLang}:${trimmed}`;
    const cached = recentSearches.get(cacheKey);
    if (cached) {
      setResults(cached);
      setSearching(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const data = await searchTmdbApi(trimmed, searchLang, controller.signal);
        rememberSearch(cacheKey, data.results || []);
        if (!controller.signal.aborted) setResults(data.results || []);
      } catch (err) {
        if (!controller.signal.aborted) setSearchError(translateError(err));
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, searchLang, translateError]);

  const existingTmdbKeys = new Set(
    Object.values(titles)
      .filter((item) => item.source === 'tmdb' && item.sourceId !== null)
      .map((item) => `${item.mediaType}:${item.sourceId}`),
  );

  const handleAddTmdb = useCallback(
    async (hit: TmdbSearchItem, targetListId?: string) => {
      const key = `${hit.mediaType}:${hit.sourceId}`;
      setAddingKey(key);
      try {
        await addTitleFromTmdb(hit.mediaType, hit.sourceId, targetListId);
      } catch (err) {
        toast.danger(translateError(err));
      } finally {
        setAddingKey(null);
      }
    },
    [addTitleFromTmdb, translateError],
  );

  const listArray = Object.values(lists);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t.search.title}</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onPress={() => setLinkDialogOpen(true)}>
            <Link2 className="w-4 h-4" />
            {t.search.tabLinkImport}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => {
              setManualSeed(null);
              setManualDialogOpen(true);
            }}
          >
            <PlusCircle className="w-4 h-4" />
            {t.search.tabManual}
          </Button>
        </div>
      </div>

      <SearchField value={query} onChange={setQuery} aria-label={t.search.placeholder} className="w-full">
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={t.search.placeholder} />
          <SearchField.ClearButton aria-label={t.search.clearSearchAria} />
        </SearchField.Group>
      </SearchField>

      {searchError && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger">{searchError}</div>
      )}

      {searching ? (
        <div className="space-y-3" aria-label={t.search.searching}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-surface">
              <Skeleton className="w-14 h-20 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : query.trim() === '' ? (
        <div className="py-16 text-center space-y-1">
          <p className="text-sm font-medium text-foreground">{t.search.searchPromptTitle}</p>
          <p className="text-xs text-muted">{t.search.searchPromptSubtitle}</p>
        </div>
      ) : results.length === 0 && !searchError ? (
        <div className="py-16 text-center text-sm text-muted">{t.search.noResults}</div>
      ) : (
        <SearchResults
          results={results}
          existingTmdbKeys={existingTmdbKeys}
          titles={titles}
          lists={listArray}
          addingKey={addingKey}
          onAdd={handleAddTmdb}
          onOpenExisting={(id) => navigate(`/title/${id}`)}
        />
      )}

      <LinkImportDialog
        isOpen={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        onSearchTmdb={(suggestedTitle) => {
          setLinkDialogOpen(false);
          setQuery(suggestedTitle);
        }}
        onSelectTmdb={async (hit) => {
          const created = await addTitleFromTmdb(hit.mediaType, hit.sourceId);
          navigate(`/title/${created.id}`);
        }}
        onParsedToManual={(seed) => {
          setLinkDialogOpen(false);
          setManualSeed(seed);
          setManualDialogOpen(true);
        }}
      />

      <ManualItemDialog
        isOpen={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        initialSeed={manualSeed}
        onCreated={(id) => {
          setManualDialogOpen(false);
          navigate(`/title/${id}`);
        }}
      />
    </div>
  );
};
