import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpDown,
  Bookmark,
  Check,
  ListOrdered,
  Pin,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  AlertDialog,
  Button,
  Label,
  ListBox,
  ProgressBar,
  Select,
} from '@heroui/react';
import { useTracker } from '../context/TrackerContext';
import { computeListProgress, sortListEntries } from '../domain/ordering';
import type {
  CollectionSort,
  ListEntryDoc,
  ProgressDoc,
  TitleDoc,
} from '../domain/types';
import { AddTitlesDialog } from '../features/lists/AddTitlesDialog';
import { CollectionGridSection } from '../features/lists/CollectionGridSection';
import { OrderedListSection } from '../features/lists/OrderedListSection';
import { zh } from '../i18n/zh';

export const ListDetailPage: React.FC = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();

  const {
    titles,
    seasonsByTitle,
    lists,
    entriesByList,
    settings,
    getActiveProgress,
    togglePinList,
    updateCollectionSort,
    deleteList,
    addTitleToList,
    removeEntryFromList,
    reorderListEntry,
  } = useTracker();

  const list = listId ? lists[listId] : undefined;
  const rawEntries = useMemo(
    () => (listId ? entriesByList[listId] || [] : []),
    [entriesByList, listId]
  );

  const [reorderMode, setReorderMode] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const hydratedEntries = useMemo(() => {
    return rawEntries
      .map((entry) => ({ entry, title: titles[entry.titleId] }))
      .filter(
        (item): item is { entry: ListEntryDoc; title: TitleDoc } =>
          Boolean(item.title)
      );
  }, [rawEntries, titles]);

  const sortedEntries = useMemo(() => {
    if (!list) return [];
    return sortListEntries(
      hydratedEntries,
      list.kind,
      list.collectionSort,
      settings.defaultTitleLang
    );
  }, [hydratedEntries, list, settings.defaultTitleLang]);

  const progressByTitleMap = useMemo(() => {
    const map: Record<string, ProgressDoc | undefined> = {};
    for (const { title } of sortedEntries) {
      map[title.id] = getActiveProgress(title);
    }
    return map;
  }, [sortedEntries, getActiveProgress]);

  const stats = useMemo(() => {
    return computeListProgress(
      sortedEntries,
      seasonsByTitle,
      progressByTitleMap,
      { includeSpecials: settings.includeSpecials }
    );
  }, [sortedEntries, seasonsByTitle, progressByTitleMap, settings.includeSpecials]);

  if (!list) {
    return (
      <div className="px-6 py-16 text-center space-y-4">
        <p className="text-base text-[var(--muted)]">{zh.lists.notFound}</p>
        <Button
          variant="secondary"
          size="sm"
          onPress={() => navigate('/lists')}
        >
          {zh.lists.backToLists}
        </Button>
      </div>
    );
  }

  const pct =
    stats.totalCount > 0
      ? Math.round((stats.completedCount / stats.totalCount) * 100)
      : 0;

  const isManualReorderAllowed =
    list.kind === 'ordered' ||
    (list.kind === 'collection' && list.collectionSort === 'manual');

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    await reorderListEntry(list.id, String(active.id), String(over.id));
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 space-y-6">
      {/* Top Navigation & Header */}
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onPress={() => navigate('/lists')}
            className="-ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{zh.lists.title}</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant={list.pinned ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => togglePinList(list.id)}
              aria-label={list.pinned ? zh.lists.unpinAction : zh.lists.pinAction}
            >
              <Pin className="w-3.5 h-3.5" />
              <span>
                {list.pinned ? zh.lists.pinnedBadge : zh.lists.unpinnedBadge}
              </span>
            </Button>

            <Button
              variant="danger-soft"
              size="sm"
              isIconOnly
              onPress={() => setDeleteConfirmOpen(true)}
              aria-label={zh.app.delete}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[var(--separator)]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--accent-text)]">
              {list.kind === 'ordered' ? (
                <ListOrdered className="w-4 h-4" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
              <span>
                {list.kind === 'ordered'
                  ? zh.lists.orderedType
                  : zh.lists.collectionType}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)]">
              {list.name}
            </h1>

            {list.description && (
              <p className="text-sm text-[var(--muted)] max-w-2xl">
                {list.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {list.kind === 'collection' && (
              <Select
                variant="secondary"
                selectedKey={list.collectionSort}
                onSelectionChange={async (key) => {
                  if (key === null) return;
                  const nextSort = String(key) as CollectionSort;
                  await updateCollectionSort(list.id, nextSort);
                  if (nextSort === 'manual') {
                    setReorderMode(true);
                  } else {
                    setReorderMode(false);
                  }
                }}
                className="flex-row items-center gap-2"
              >
                <Label className="whitespace-nowrap">{zh.lists.sortByLabel}</Label>
                <Select.Trigger className="w-32">
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    <ListBox.Item id="added" textValue={zh.lists.sortBy.added}>
                      <Label>{zh.lists.sortBy.added}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="name" textValue={zh.lists.sortBy.name}>
                      <Label>{zh.lists.sortBy.name}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="year" textValue={zh.lists.sortBy.year}>
                      <Label>{zh.lists.sortBy.year}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="rating" textValue={zh.lists.sortBy.rating}>
                      <Label>{zh.lists.sortBy.rating}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    <ListBox.Item id="manual" textValue={zh.lists.sortBy.manual}>
                      <Label>{zh.lists.sortBy.manual}</Label>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  </ListBox>
                </Select.Popover>
              </Select>
            )}

            {isManualReorderAllowed && sortedEntries.length > 1 && (
              <Button
                variant={reorderMode ? 'primary' : 'secondary'}
                size="sm"
                onPress={() => setReorderMode((v) => !v)}
              >
                {reorderMode ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <ArrowUpDown className="w-4 h-4" />
                )}
                <span>
                  {reorderMode ? zh.lists.reorderDone : zh.lists.reorderToggle}
                </span>
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              onPress={() => setAddModalOpen(true)}
            >
              <Plus className="w-4 h-4" />
              <span>{zh.lists.addTitlesButtonShort}</span>
            </Button>
          </div>
        </div>

        {/* List Progress Summary */}
        {stats.totalCount > 0 && (
          <div className="flex items-center gap-4 max-w-md">
            <span className="text-xs text-[var(--muted)] tabular-nums whitespace-nowrap">
              {zh.lists.progressLabel(stats.completedCount, stats.totalCount)}
            </span>
            <ProgressBar
              aria-label={zh.lists.progressAria(list.name)}
              value={pct}
              size="sm"
              className="flex-1"
            >
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          </div>
        )}
      </header>

      {/* Entries Content */}
      {sortedEntries.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <p className="text-sm text-[var(--muted)]">
            {zh.lists.emptyListEntries}
          </p>
          <Button
            variant="primary"
            size="sm"
            onPress={() => setAddModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
            <span>{zh.lists.addTitlesToList}</span>
          </Button>
        </div>
      ) : list.kind === 'ordered' ? (
        <OrderedListSection
          sortedEntries={sortedEntries}
          nextToWatchEntryId={stats.nextEntry?.entry.id}
          reorderEnabled={reorderMode}
          sensors={sensors}
          onDragEnd={handleDragEnd}
          seasonsByTitle={seasonsByTitle}
          progressByTitleMap={progressByTitleMap}
          defaultLang={settings.defaultTitleLang}
          includeSpecials={settings.includeSpecials}
          onRemoveEntry={(entryId) => removeEntryFromList(list.id, entryId)}
        />
      ) : (
        <CollectionGridSection
          sortedEntries={sortedEntries}
          reorderEnabled={reorderMode && list.collectionSort === 'manual'}
          sensors={sensors}
          onDragEnd={handleDragEnd}
          seasonsByTitle={seasonsByTitle}
          progressByTitleMap={progressByTitleMap}
          defaultLang={settings.defaultTitleLang}
          includeSpecials={settings.includeSpecials}
          onRemoveEntry={(entryId) => removeEntryFromList(list.id, entryId)}
        />
      )}

      <AddTitlesDialog
        isOpen={addModalOpen}
        onOpenChange={setAddModalOpen}
        titles={titles}
        rawEntries={rawEntries}
        defaultLang={settings.defaultTitleLang}
        onAddTitle={(titleId) => addTitleToList(list.id, titleId)}
      />

      <AlertDialog.Backdrop
        isOpen={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        isDismissable
      >
        <AlertDialog.Container size="sm" placement="center">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>{zh.app.delete}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>{zh.lists.deleteListConfirm}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => setDeleteConfirmOpen(false)}
              >
                {zh.app.cancel}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onPress={async () => {
                  setDeleteConfirmOpen(false);
                  await deleteList(list.id);
                  navigate('/lists', { replace: true });
                }}
              >
                {zh.app.delete}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
};
