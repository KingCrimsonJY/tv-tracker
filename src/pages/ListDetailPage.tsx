import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft,
  ArrowUpDown,
  Bookmark,
  GripVertical,
  ListOrdered,
  Pin,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { Button, Modal, ProgressBar } from '@heroui/react';
import { MediaImage } from '../components/MediaImage';
import { PosterCard } from '../components/PosterCard';
import { useTracker } from '../context/TrackerContext';
import {
  computeListProgress,
  type HydratedListEntry,
  sortListEntries,
} from '../domain/ordering';
import { computeTitleState, resolveDisplayTitle } from '../domain/progress';
import type {
  CollectionSort,
  ListEntryDoc,
  ProgressDoc,
  SeasonDoc,
  TitleDoc,
} from '../domain/types';
import { zh } from '../i18n/zh';

interface SortableOrderedRowProps {
  index: number;
  item: HydratedListEntry;
  seasons: SeasonDoc[];
  progress: ProgressDoc | undefined;
  isNextUp: boolean;
  isReordering: boolean;
  defaultLang: 'zh' | 'original' | 'en';
  includeSpecials: boolean;
  onRemove: (entryId: string) => void;
}

const SortableOrderedRow: React.FC<SortableOrderedRowProps> = ({
  index,
  item,
  seasons,
  progress,
  isNextUp,
  isReordering,
  defaultLang,
  includeSpecials,
  onRemove,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.entry.id, disabled: !isReordering });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  const { primary } = resolveDisplayTitle(
    item.title.names,
    item.title.displayLang,
    defaultLang
  );
  const state = computeTitleState(item.title, seasons, progress, { includeSpecials });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 sm:gap-4 p-3 rounded-2xl border transition-colors ${
        isDragging
          ? 'bg-[var(--surface-tertiary)] border-[var(--accent)] shadow-2xl'
          : isNextUp
            ? 'bg-[var(--accent-subtle)] border-[var(--accent)]/40'
            : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-secondary)]'
      }`}
    >
      {/* Order number */}
      <span
        className={`w-7 text-center text-sm font-semibold tabular-nums shrink-0 ${
          isNextUp ? 'text-[var(--accent-text)]' : 'text-[var(--muted)]'
        }`}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      {/* Poster thumbnail */}
      <Link
        to={`/title/${item.title.id}`}
        className="w-12 sm:w-14 shrink-0 rounded-lg overflow-hidden border border-[var(--border)]"
      >
        <MediaImage
          src={item.title.posterPath}
          alt={primary}
          aspect="poster"
          mediaType={item.title.mediaType}
        />
      </Link>

      {/* Title, Year & Status */}
      <Link to={`/title/${item.title.id}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm sm:text-base font-medium text-[var(--foreground)] truncate">
            {primary}
          </h3>
          {isNextUp && (
            <span className="text-xs font-medium text-[var(--accent-text)] shrink-0">
              · {zh.lists.nextUpHighlight}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--muted)] tabular-nums">
          {item.title.year && <span>{item.title.year}</span>}
          {item.title.year && <span aria-hidden="true">·</span>}
          <span>{zh.detail.mediaTypes[item.title.mediaType]}</span>
          <span aria-hidden="true">·</span>
          <span
            className={
              state.status === 'completed'
                ? 'text-[var(--success)]'
                : state.status === 'watching'
                  ? 'text-[var(--accent-text)]'
                  : 'text-[var(--muted)]'
            }
          >
            {state.label}
          </span>
        </div>
      </Link>

      {/* Drag handle or remove button inside reorder mode */}
      {isReordering ? (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onRemove(item.entry.id)}
            aria-label={`移除 ${primary}`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[var(--danger)] hover:bg-[var(--danger-subtle)]"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`拖拽调整 ${primary} 顺序`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="text-xs text-[var(--muted)] tabular-nums pr-2 hidden sm:block">
          {state.countableCount > 1 && state.watchedCount > 0
            ? `${state.watchedCount}/${state.countableCount}`
            : state.label}
        </div>
      )}
    </div>
  );
};

interface SortableCollectionCardProps {
  item: HydratedListEntry;
  seasons: SeasonDoc[];
  progress: ProgressDoc | undefined;
  isReordering: boolean;
  defaultLang: 'zh' | 'original' | 'en';
  includeSpecials: boolean;
  onRemove: (entryId: string) => void;
}

const SortableCollectionCard: React.FC<SortableCollectionCardProps> = ({
  item,
  seasons,
  progress,
  isReordering,
  defaultLang,
  includeSpecials,
  onRemove,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.entry.id, disabled: !isReordering });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  const { primary } = resolveDisplayTitle(
    item.title.names,
    item.title.displayLang,
    defaultLang
  );

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <PosterCard
        title={item.title}
        seasons={seasons}
        progress={progress}
        defaultLang={defaultLang}
        includeSpecials={includeSpecials}
      />

      {isReordering && (
        <div className="absolute top-2 right-2 left-2 flex items-center justify-between gap-1 z-10">
          <button
            type="button"
            onClick={() => onRemove(item.entry.id)}
            aria-label={`移除 ${primary}`}
            className="min-w-[38px] min-h-[38px] rounded-xl bg-[var(--scrim-chip)] text-[var(--danger)] backdrop-blur-md flex items-center justify-center border border-[var(--border)]"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`拖拽排序 ${primary}`}
            className="min-w-[38px] min-h-[38px] rounded-xl bg-[var(--scrim-chip)] text-[var(--on-scrim)] backdrop-blur-md flex items-center justify-center border border-[var(--border)] cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export const ListDetailPage: React.FC = () => {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();

  const {
    loadingData,
    titles,
    seasonsByTitle,
    lists,
    entriesByList,
    settings,
    getActiveProgress,
    togglePinList,
    deleteList,
    updateCollectionSort,
    addTitleToList,
    removeEntryFromList,
    reorderListEntry,
  } = useTracker();

  const list = listId ? lists[listId] : undefined;
  const [isReordering, setIsReordering] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // @dnd-kit sensors: Pointer, Touch (200ms press activation on handle), and Keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const progressByTitleMap = useMemo(() => {
    const map: Record<string, ProgressDoc | undefined> = {};
    for (const t of Object.values(titles)) {
      map[t.id] = getActiveProgress(t);
    }
    return map;
  }, [titles, getActiveProgress]);

  if (loadingData && !list) {
    return (
      <div className="px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 space-y-6" aria-label="正在加载列表详情">
        <div className="h-10 w-28 rounded-xl bg-[var(--surface)] animate-pulse" />
        <div className="h-36 rounded-2xl border border-[var(--border)] bg-[var(--surface)] animate-pulse" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl border border-[var(--border)] bg-[var(--surface)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="px-6 py-16 text-center space-y-4">
        <p className="text-base text-[var(--muted)]">未找到该列表</p>
        <Button variant="secondary" onPress={() => navigate('/lists')}>
          返回列表页
        </Button>
      </div>
    );
  }

  const rawEntries = entriesByList[list.id] || [];
  const hydrated = rawEntries
    .map((entry) => ({ entry, title: titles[entry.titleId] }))
    .filter((item): item is { entry: ListEntryDoc; title: TitleDoc } =>
      Boolean(item.title)
    );

  const effectiveSort: CollectionSort =
    list.kind === 'ordered' || isReordering ? 'manual' : list.collectionSort;

  const sortedEntries = sortListEntries(
    hydrated,
    list.kind,
    effectiveSort,
    settings.defaultTitleLang
  );

  const stats = computeListProgress(
    sortedEntries,
    seasonsByTitle,
    progressByTitleMap,
    { includeSpecials: settings.includeSpecials }
  );

  const pct =
    stats.totalCount > 0
      ? Math.round((stats.completedCount / stats.totalCount) * 100)
      : 0;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderListEntry(list.id, String(active.id), String(over.id));
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 space-y-6">
      {/* Top Back & Actions */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/lists')}
          className="min-h-[44px] px-3 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-medium text-[var(--foreground)] flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>所有列表</span>
        </button>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onPress={() => togglePinList(list.id)}
            className="gap-1.5 text-xs"
          >
            <Pin className="w-3.5 h-3.5" />
            <span>{list.pinned ? zh.lists.unpinAction : zh.lists.pinAction}</span>
          </Button>

          <Button
            variant="danger-soft"
            size="sm"
            onPress={async () => {
              await deleteList(list.id);
              navigate('/lists');
            }}
            className="gap-1.5 text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{zh.lists.deleteList}</span>
          </Button>
        </div>
      </div>

      {/* List Header Info & Progress */}
      <header className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--accent-text)]">
              {list.kind === 'ordered' ? (
                <ListOrdered className="w-4 h-4" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
              <span>
                {list.kind === 'ordered' ? zh.lists.orderedType : zh.lists.collectionType}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
              {list.name}
            </h1>
            {list.description && (
              <p className="text-sm text-[var(--muted)]">{list.description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Collection Sort Selector */}
            {list.kind === 'collection' && (
              <select
                aria-label="合集排序方式"
                value={list.collectionSort}
                onChange={(e) => {
                  const nextSort = e.target.value as CollectionSort;
                  updateCollectionSort(list.id, nextSort);
                  if (nextSort === 'manual') {
                    setIsReordering(true);
                  }
                }}
                className="h-9 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-medium text-[var(--foreground)]"
              >
                <option value="added">{zh.lists.sortOptions.added}</option>
                <option value="name">{zh.lists.sortOptions.name}</option>
                <option value="year">{zh.lists.sortOptions.year}</option>
                <option value="rating">{zh.lists.sortOptions.rating}</option>
                <option value="manual">{zh.lists.sortOptions.manual}</option>
              </select>
            )}

            {/* Reorder Toggle Button */}
            {sortedEntries.length > 1 && (
              <Button
                variant={isReordering ? 'primary' : 'secondary'}
                size="sm"
                onPress={() => {
                  if (!isReordering && list.kind === 'collection') {
                    updateCollectionSort(list.id, 'manual');
                  }
                  setIsReordering((v) => !v);
                }}
                className="gap-1.5 text-xs font-medium"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>
                  {isReordering ? zh.lists.reorderDone : zh.lists.reorderToggle}
                </span>
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              onPress={() => setAddModalOpen(true)}
              className="gap-1.5 text-xs font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>{zh.lists.addTitlesToList}</span>
            </Button>
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs text-[var(--muted)] tabular-nums">
            <span>
              已看完 {stats.completedCount} / {stats.totalCount} 部
            </span>
            <span>{pct}%</span>
          </div>
          <ProgressBar
            aria-label={`${list.name} 完成进度`}
            value={pct}
            size="sm"
            className="w-full"
          >
            <ProgressBar.Track className="h-1.5 bg-[var(--surface-tertiary)] rounded-full overflow-hidden">
              <ProgressBar.Fill className="h-full bg-[var(--accent)] rounded-full" />
            </ProgressBar.Track>
          </ProgressBar>
        </div>
      </header>

      {/* Entries Content */}
      {sortedEntries.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <p className="text-sm text-[var(--muted)]">{zh.lists.emptyEntries}</p>
          <Button variant="primary" size="sm" onPress={() => setAddModalOpen(true)}>
            {zh.lists.addTitlesToList}
          </Button>
        </div>
      ) : list.kind === 'ordered' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedEntries.map((h) => h.entry.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2.5">
              {sortedEntries.map((item, idx) => (
                <SortableOrderedRow
                  key={item.entry.id}
                  index={idx}
                  item={item}
                  seasons={seasonsByTitle[item.title.id] || []}
                  progress={progressByTitleMap[item.title.id]}
                  isNextUp={stats.nextEntry?.entry.id === item.entry.id}
                  isReordering={isReordering}
                  defaultLang={settings.defaultTitleLang}
                  includeSpecials={settings.includeSpecials}
                  onRemove={(entryId) => removeEntryFromList(list.id, entryId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedEntries.map((h) => h.entry.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3.5 sm:gap-5">
              {sortedEntries.map((item) => (
                <SortableCollectionCard
                  key={item.entry.id}
                  item={item}
                  seasons={seasonsByTitle[item.title.id] || []}
                  progress={progressByTitleMap[item.title.id]}
                  isReordering={isReordering}
                  defaultLang={settings.defaultTitleLang}
                  includeSpecials={settings.includeSpecials}
                  onRemove={(entryId) => removeEntryFromList(list.id, entryId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Modal to Add Titles from Library into this List */}
      <Modal.Backdrop isOpen={addModalOpen} onOpenChange={setAddModalOpen} isDismissable>
        <Modal.Container size="md" placement="center">
          <Modal.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)] outline-none">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold">
                添加作品到「{list.name}」
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="mt-4 space-y-2 max-h-80 overflow-y-auto">
              {Object.values(titles).map((t) => {
                const { primary } = resolveDisplayTitle(
                  t.names,
                  t.displayLang,
                  settings.defaultTitleLang
                );
                const existingEntry = rawEntries.find((e) => e.titleId === t.id);

                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 shrink-0 rounded overflow-hidden">
                        <MediaImage
                          src={t.posterPath}
                          alt={primary}
                          aspect="poster"
                          mediaType={t.mediaType}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)] truncate">
                          {primary}
                        </p>
                        <p className="text-xs text-[var(--muted)] tabular-nums">
                          {t.year || ''} · {zh.detail.mediaTypes[t.mediaType]}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant={existingEntry ? 'secondary' : 'primary'}
                      size="sm"
                      onPress={() =>
                        existingEntry
                          ? removeEntryFromList(list.id, existingEntry.id)
                          : addTitleToList(list.id, t.id)
                      }
                    >
                      {existingEntry
                        ? zh.detail.addToListModal.added
                        : zh.detail.addToListModal.add}
                    </Button>
                  </div>
                );
              })}
            </Modal.Body>

            <Modal.Footer className="mt-5 flex justify-between items-center">
              <Button
                variant="ghost"
                size="sm"
                onPress={() => {
                  setAddModalOpen(false);
                  navigate('/search');
                }}
              >
                去搜索更多新影视
              </Button>
              <Button variant="secondary" size="sm" onPress={() => setAddModalOpen(false)}>
                {zh.app.close}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
};
