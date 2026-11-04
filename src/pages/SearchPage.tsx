import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button, Modal, Tabs, toast } from '@heroui/react';
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
    try {
      const created = await addTitleFromTmdb(hit.mediaType, hit.sourceId);
      const displayName = created.names.zh || created.names.original;
      toast.success(zh.search.addedTitleToast(displayName), {
        actionProps: {
          children: zh.search.viewAction,
          onPress: () => navigate(`/title/${created.id}`),
        },
      });
    } catch (err) {
      toast.danger(
        err instanceof Error ? err.message : zh.search.addFailedToast
      );
    } finally {
      setAddingId(null);
    }
  };

  const handleAddStraightToList = async (
    hit: TmdbSearchHit,
    listId: string
  ) => {
    const id = `tmdb_${hit.mediaType}_${hit.sourceId}`;
    const targetList = lists[listId];
    setAddingId(id);
    try {
      await toast.promise(
        addTitleFromTmdb(hit.mediaType, hit.sourceId, listId),
        {
          loading: zh.search.addingToListToast,
          success: targetList
            ? zh.search.addedToListToast(targetList.name)
            : zh.search.addedTitleToast(hit.names.zh || hit.names.original),
          error: (err) =>
            err instanceof Error
              ? err.message
              : zh.search.addToListFailedToast,
        }
      );
      setListPickerTarget(null);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)]">
          {zh.search.title}
        </h1>
      </header>

      <Tabs
        selectedKey={tab}
        onSelectionChange={(key) => setTab(key as TabMode)}
        className="gap-5"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label={zh.search.title}>
            <Tabs.Tab id="tmdb">
              {zh.search.tabTmdb}
              <Tabs.Indicator />
            </Tabs.Tab>

            <Tabs.Tab id="link">
              {zh.search.tabLinkImport}
              <Tabs.Indicator />
            </Tabs.Tab>

            <Tabs.Tab id="manual">
              {zh.search.tabManual}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="tmdb">
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
        </Tabs.Panel>

        <Tabs.Panel id="link">
          <LinkImportDialog
            onSearchTmdb={(suggestedTitle) => {
              setQuery(suggestedTitle);
              setTab('tmdb');
            }}
            onSubmitCustomItem={async (input) => {
              try {
                const created = await createCustomOrLinkTitle(input);
                const displayName = created.names.zh || created.names.original;
                toast.success(zh.search.addedTitleToast(displayName), {
                  actionProps: {
                    children: zh.search.viewAction,
                    onPress: () => navigate(`/title/${created.id}`),
                  },
                });
                navigate(`/title/${created.id}`);
              } catch (err) {
                toast.danger(
                  err instanceof Error ? err.message : zh.search.addFailedToast
                );
              }
            }}
          />
        </Tabs.Panel>

        <Tabs.Panel id="manual">
          <ManualItemDialog
            onSubmitCustomItem={async (input) => {
              try {
                const created = await createCustomOrLinkTitle(input);
                const displayName = created.names.zh || created.names.original;
                toast.success(zh.search.addedTitleToast(displayName), {
                  actionProps: {
                    children: zh.search.viewAction,
                    onPress: () => navigate(`/title/${created.id}`),
                  },
                });
                navigate(`/title/${created.id}`);
              } catch (err) {
                toast.danger(
                  err instanceof Error ? err.message : zh.search.addFailedToast
                );
              }
            }}
          />
        </Tabs.Panel>
      </Tabs>

      {/* Add straight to List Modal */}
      <Modal.Backdrop
        isOpen={Boolean(listPickerTarget)}
        onOpenChange={(open) => !open && setListPickerTarget(null)}
        isDismissable
      >
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>{zh.search.addToListModalTitle}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-2 max-h-72 overflow-y-auto">
              <p className="text-xs text-[var(--muted)] mb-2">
                {zh.search.addToListModalHint}
              </p>
              {Object.values(lists).length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  {zh.search.emptyListsInModal}
                </p>
              ) : (
                Object.values(lists).map((list) => (
                  <Button
                    key={list.id}
                    variant="secondary"
                    fullWidth
                    onPress={() =>
                      listPickerTarget &&
                      void handleAddStraightToList(listPickerTarget, list.id)
                    }
                    className="justify-between"
                  >
                    <span className="truncate">{list.name}</span>
                    <Plus className="w-4 h-4 shrink-0 text-[var(--accent-text)]" />
                  </Button>
                ))
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => setListPickerTarget(null)}
              >
                {zh.app.close}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
};
