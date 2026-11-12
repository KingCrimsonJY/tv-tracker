import React, { useState, useMemo } from 'react';
import { activeProgressOf, NO_SEASONS } from '../domain/stableRefs';
import { ButtonLink } from '../components/ButtonLink';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Chip, Switch, AlertDialog, Dropdown, Label } from '@heroui/react';
import { ArrowLeft, Plus, Trash2, Pin, ListOrdered, Bookmark, ArrowUpDown, GripVertical } from 'lucide-react';
import { useTracker } from '../context/TrackerContext';
import {
  selectEntriesByList,
  selectLists,
  selectProgressByTitle,
  selectSeasonsByTitle,
  selectSettings,
  selectTitles,
} from '../data/selectors';
import { useTrackerState } from '../data/useTrackerState';
import { computeListProgress, sortListEntries } from '../domain/ordering';
import { computeTitleState } from '../domain/status';
import { CollectionSort, ListEntryDoc, ProgressDoc, TitleDoc } from '../domain/types';
import { OrderedListSection } from '../features/lists/OrderedListSection';
import { CollectionGridSection } from '../features/lists/CollectionGridSection';
import { AddTitlesDialog } from '../features/lists/AddTitlesDialog';
import { useI18n } from '../i18n';
import { usePendingAction } from '../hooks/usePendingAction';
import { withPendingSpinner } from '../components/pendingContent';

export const ListDetailPage: React.FC = () => {
  const { listId: id } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const { deleteList, togglePinList, updateCollectionSort, addTitleToList, removeEntryFromList, reorderListEntry } =
    useTracker();
  const titles = useTrackerState(selectTitles);
  const seasonsByTitle = useTrackerState(selectSeasonsByTitle);
  const progressByTitle = useTrackerState(selectProgressByTitle);
  const lists = useTrackerState(selectLists);
  const entriesByList = useTrackerState(selectEntriesByList);
  const settings = useTrackerState(selectSettings);
  const { t, locale } = useI18n();

  const [isSorting, setIsSorting] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingList, runDeleteList] = usePendingAction();

  const list = id ? lists[id] : undefined;
  const rawEntries = useMemo(() => (id ? (entriesByList[id] ?? []) : []), [id, entriesByList]);

  const hydratedEntries = useMemo(
    () =>
      rawEntries
        .map((entry) => ({ entry, title: titles[entry.titleId] }))
        .filter((x): x is { entry: ListEntryDoc; title: TitleDoc } => Boolean(x.title)),
    [rawEntries, titles],
  );

  const sortedEntries = useMemo(() => {
    if (!list) return [];
    return sortListEntries(hydratedEntries, list.kind, list.collectionSort, settings.defaultTitleLang, locale);
  }, [list, hydratedEntries, settings.defaultTitleLang, locale]);

  const progressByTitleMap = useMemo(() => {
    const map: Record<string, ProgressDoc | undefined> = {};
    for (const item of sortedEntries) {
      map[item.title.id] = activeProgressOf(progressByTitle, item.title);
    }
    return map;
  }, [sortedEntries, progressByTitle]);

  const titlesWithState = useMemo(() => {
    return sortedEntries.map(({ entry, title }) => {
      const seasons = seasonsByTitle[title.id] ?? NO_SEASONS;
      const progress = progressByTitleMap[title.id];
      const state = computeTitleState(title, seasons, progress, {
        includeSpecials: settings.includeSpecials,
      });
      return { entry, title, seasons, progress, state };
    });
  }, [sortedEntries, seasonsByTitle, progressByTitleMap, settings.includeSpecials]);

  if (!list) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted mb-4">{t.lists.notFound}</p>
        <ButtonLink to="/lists" variant="secondary">
          {t.lists.backToLists}
        </ButtonLink>
      </div>
    );
  }

  const stats = computeListProgress(sortedEntries, seasonsByTitle, progressByTitleMap, {
    includeSpecials: settings.includeSpecials,
  });
  const nextUpEntryId = list.kind === 'ordered' ? stats.nextEntry?.entry.id : undefined;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <ButtonLink to="/lists" variant="ghost" size="sm" className="-ml-2">
            <ArrowLeft className="w-4 h-4" />
            {t.lists.title}
          </ButtonLink>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="primary" size="sm" onPress={() => setAddModalOpen(true)}>
              <Plus className="w-4 h-4" />
              {t.lists.addTitlesButtonShort}
            </Button>
            <Button
              variant="danger-soft"
              size="sm"
              isIconOnly
              aria-label={t.app.delete}
              onPress={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {/* The title gets the full width; long, unbroken names wrap instead of widening the page. */}
        <div className="flex min-w-0 items-center gap-2 flex-wrap pt-1">
          {list.kind === 'ordered' ? (
            <ListOrdered className="w-6 h-6 text-accent" />
          ) : (
            <Bookmark className="w-6 h-6 text-accent" />
          )}
          <h1 className="min-w-0 text-2xl sm:text-3xl font-bold tracking-tight wrap-anywhere">{list.name}</h1>
          <Chip size="sm" variant="soft">
            {stats.completedCount}/{stats.totalCount}
          </Chip>
        </div>
        {list.description && <p className="text-sm text-muted max-w-2xl wrap-anywhere">{list.description}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-y border-border">
        <div className="flex items-center gap-4">
          <Switch isSelected={list.pinned} onChange={() => void togglePinList(list.id)} size="sm">
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <Label className="text-xs flex items-center gap-1">
                <Pin className="w-3.5 h-3.5" />
                {list.pinned ? t.lists.pinnedBadge : t.lists.pinAction}
              </Label>
            </Switch.Content>
          </Switch>
        </div>

        <div className="flex items-center gap-2">
          {list.kind === 'collection' && (
            <Dropdown>
              <Button variant="secondary" size="sm">
                <ArrowUpDown className="w-3.5 h-3.5" />
                {t.lists.sortBy[list.collectionSort]}
              </Button>
              <Dropdown.Popover>
                <Dropdown.Menu
                  selectionMode="single"
                  selectedKeys={new Set([list.collectionSort])}
                  onSelectionChange={(keys) => {
                    const k = Array.from(keys)[0] as CollectionSort | undefined;
                    if (k) {
                      void updateCollectionSort(list.id, k);
                      if (k === 'manual') setIsSorting(true);
                      else setIsSorting(false);
                    }
                  }}
                >
                  <Dropdown.Item id="added" textValue={t.lists.sortBy.added}>
                    <Label>{t.lists.sortBy.added}</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="name" textValue={t.lists.sortBy.name}>
                    <Label>{t.lists.sortBy.name}</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="year" textValue={t.lists.sortBy.year}>
                    <Label>{t.lists.sortBy.year}</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="rating" textValue={t.lists.sortBy.rating}>
                    <Label>{t.lists.sortBy.rating}</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="manual" textValue={t.lists.sortBy.manual}>
                    <Label>{t.lists.sortBy.manual}</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}

          {(list.kind === 'ordered' || list.collectionSort === 'manual') && (
            <Button variant={isSorting ? 'primary' : 'secondary'} size="sm" onPress={() => setIsSorting(!isSorting)}>
              <GripVertical className="w-3.5 h-3.5" />
              {isSorting ? t.lists.reorderDone : t.lists.reorderToggle}
            </Button>
          )}
        </div>
      </div>

      {titlesWithState.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-muted text-sm">{t.lists.emptyListEntries}</p>
          <Button variant="secondary" size="sm" onPress={() => setAddModalOpen(true)}>
            <Plus className="w-4 h-4" />
            {t.lists.addTitlesToList}
          </Button>
        </div>
      ) : list.kind === 'ordered' ? (
        <OrderedListSection
          listId={list.id}
          items={titlesWithState}
          nextUpEntryId={nextUpEntryId}
          isSorting={isSorting}
          defaultLang={settings.defaultTitleLang}
          onReorder={reorderListEntry}
          onRemove={(entryId) => void removeEntryFromList(list.id, entryId)}
        />
      ) : (
        <CollectionGridSection
          listId={list.id}
          items={titlesWithState}
          isSorting={isSorting && list.collectionSort === 'manual'}
          defaultLang={settings.defaultTitleLang}
          includeSpecials={settings.includeSpecials}
          onReorder={reorderListEntry}
          onRemove={(entryId) => void removeEntryFromList(list.id, entryId)}
        />
      )}

      <AddTitlesDialog
        isOpen={addModalOpen}
        onOpenChange={setAddModalOpen}
        titles={titles}
        existingTitleIds={new Set(rawEntries.map((e) => e.titleId))}
        defaultLang={settings.defaultTitleLang}
        onAdd={(titleId) => void addTitleToList(list.id, titleId)}
      />

      <AlertDialog.Backdrop isOpen={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>{t.app.delete}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-muted">{t.lists.deleteListConfirm}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer className="gap-2">
              <Button variant="tertiary" onPress={() => setDeleteDialogOpen(false)}>
                {t.app.cancel}
              </Button>
              <Button
                variant="danger"
                isPending={deletingList}
                onPress={() =>
                  runDeleteList(async () => {
                    await deleteList(list.id);
                    setDeleteDialogOpen(false);
                    navigate('/lists');
                  })
                }
              >
                {withPendingSpinner(t.app.delete)}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
};
