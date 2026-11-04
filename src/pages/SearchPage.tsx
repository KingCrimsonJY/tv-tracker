import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit3, Link2, Plus, Search } from 'lucide-react';
import { Button, Modal } from '@heroui/react';
import { useTracker } from '../context/TrackerContext';
import { searchTmdbApi } from '../data/api';
import { LinkImportDialog } from '../features/search/LinkImportDialog';
import { ManualItemDialog } from '../features/search/ManualItemDialog';
import {
  SearchResults,
  type TmdbSearchHit,
} from '../features/search/SearchResults';
import { zh } from '../i18n/zh';

type TabMode = 'tmdb' | 'link' | 'manual';

export const SearchPage: React.FC = () => {
  const {
    titles,
    lists,
    addTitleFromTmdb,
    createCustomOrLinkTitle,
    showToast,
  } = useTracker();
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabMode>('tmdb');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TmdbSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [tmdbConfigured, setTmdbConfigured] = useState(true);
  const [addingId, setAddingId] = useState<string | null>(null);

  const [listPickerTarget, setListPickerTarget] =
    useState<TmdbSearchHit | null>(null);

  // Debounced TMDB search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchTmdbApi(trimmed);
        setTmdbConfigured(data.configured !== false);
        setResults(data.results || []);
      } catch {
        // Ignore transient search errors
      } finally {
        setSearching(false);
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [query]);

  const handleAddClick = async (hit: TmdbSearchHit) => {
    const id = `tmdb_${hit.mediaType}_${hit.sourceId}`;
    if (titles[id]) return;

    setAddingId(id);
    if (hit.mediaType === 'tv') {
      showToast(zh.search.fetchingDetailToast);
    }
    try {
      await addTitleFromTmdb(hit.mediaType, hit.sourceId);
    } catch {
      showToast(zh.search.addFailedToast);
    } finally {
      setAddingId(null);
    }
  };

  const handleAddStraightToList = async (
    hit: TmdbSearchHit,
    listId: string
  ) => {
    const id = `tmdb_${hit.mediaType}_${hit.sourceId}`;
    setAddingId(id);
    try {
      await addTitleFromTmdb(hit.mediaType, hit.sourceId, listId);
      const targetList = lists[listId];
      setListPickerTarget(null);
      if (targetList) {
        showToast(zh.search.addedToListToast(targetList.name));
      }
    } catch {
      showToast(zh.search.addToListFailedToast);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 space-y-6">
      <header className="space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)]">
          {zh.search.title}
        </h1>

        <div
          role="tablist"
          aria-label={zh.search.title}
          className="inline-flex items-center p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
        >
          <button
            role="tab"
            aria-selected={tab === 'tmdb'}
            type="button"
            onClick={() => setTab('tmdb')}
            className={`flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              tab === 'tmdb'
                ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>{zh.search.tabTmdb}</span>
          </button>

          <button
            role="tab"
            aria-selected={tab === 'link'}
            type="button"
            onClick={() => setTab('link')}
            className={`flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              tab === 'link'
                ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>{zh.search.tabLinkImport}</span>
          </button>

          <button
            role="tab"
            aria-selected={tab === 'manual'}
            type="button"
            onClick={() => setTab('manual')}
            className={`flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              tab === 'manual'
                ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                : 'text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>{zh.search.tabManual}</span>
          </button>
        </div>
      </header>

      {tab === 'tmdb' && (
        <SearchResults
          query={query}
          onQueryChange={setQuery}
          searching={searching}
          tmdbConfigured={tmdbConfigured}
          results={results}
          titles={titles}
          addingId={addingId}
          onAddTmdbHit={handleAddClick}
          onOpenAddToList={setListPickerTarget}
          onNavigateTitle={(id) => navigate(`/title/${id}`)}
        />
      )}

      {tab === 'link' && (
        <LinkImportDialog
          onSearchTmdb={(suggestedTitle) => {
            setQuery(suggestedTitle);
            setTab('tmdb');
          }}
          onSubmitCustomItem={async (input) => {
            const created = await createCustomOrLinkTitle(input);
            navigate(`/title/${created.id}`);
          }}
        />
      )}

      {tab === 'manual' && (
        <ManualItemDialog
          onSubmitCustomItem={async (input) => {
            const created = await createCustomOrLinkTitle(input);
            navigate(`/title/${created.id}`);
          }}
        />
      )}

      {/* Add straight to List Modal */}
      <Modal.Backdrop
        isOpen={Boolean(listPickerTarget)}
        onOpenChange={(open) => !open && setListPickerTarget(null)}
        isDismissable
      >
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)] outline-none">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold">
                {zh.search.addToListModalTitle}
              </Modal.Heading>
            </Modal.Header>
            <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
              <p className="text-xs text-[var(--muted)] mb-2">
                {zh.search.addToListModalHint}
              </p>
              {Object.values(lists).length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  {zh.search.emptyListsInModal}
                </p>
              ) : (
                Object.values(lists).map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() =>
                      listPickerTarget &&
                      handleAddStraightToList(listPickerTarget, list.id)
                    }
                    className="w-full flex items-center justify-between px-4 py-3 min-h-[44px] rounded-xl text-sm font-medium bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-left"
                  >
                    <span className="truncate">{list.name}</span>
                    <Plus className="w-4 h-4 shrink-0 text-[var(--accent-text)]" />
                  </button>
                ))
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onPress={() => setListPickerTarget(null)}
              >
                {zh.app.close}
              </Button>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
};
