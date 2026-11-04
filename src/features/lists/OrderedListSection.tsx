import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { GripVertical, Trash2 } from 'lucide-react';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@heroui/react';
import { MediaImage } from '../../components/MediaImage';
import { computeTitleState, resolveDisplayTitle } from '../../domain/progress';
import type {
  ListEntryDoc,
  ProgressDoc,
  SeasonDoc,
  TitleDoc,
} from '../../domain/types';
import { zh } from '../../i18n/zh';

interface SortableOrderedRowProps {
  entry: ListEntryDoc;
  title: TitleDoc;
  index: number;
  isNextToWatch: boolean;
  reorderEnabled: boolean;
  seasons: SeasonDoc[];
  progress: ProgressDoc | undefined;
  defaultLang: 'zh' | 'original' | 'en';
  includeSpecials: boolean;
  onRemove: () => void;
}

const SortableOrderedRow: React.FC<SortableOrderedRowProps> = ({
  entry,
  title,
  index,
  isNextToWatch,
  reorderEnabled,
  seasons,
  progress,
  defaultLang,
  includeSpecials,
  onRemove,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id, disabled: !reorderEnabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  const { primary } = resolveDisplayTitle(
    title.names,
    title.displayLang,
    defaultLang
  );
  const state = computeTitleState(title, seasons, progress, { includeSpecials });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl border transition-colors ${
        isDragging
          ? 'bg-[var(--surface-tertiary)] border-[var(--accent)] shadow-2xl'
          : isNextToWatch
            ? 'bg-[var(--accent-subtle)]/70 border-[var(--accent)]'
            : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface-secondary)]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {reorderEnabled && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={zh.lists.dragHandleAria(primary)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] cursor-grab active:cursor-grabbing touch-none shrink-0"
          >
            <GripVertical className="w-5 h-5" />
          </button>
        )}

        <span
          className={`w-7 text-center text-sm font-bold tabular-nums shrink-0 ${
            isNextToWatch ? 'text-[var(--accent-text)]' : 'text-[var(--muted)]'
          }`}
        >
          {index + 1}
        </span>

        <Link
          to={`/title/${title.id}`}
          className="flex items-center gap-3.5 min-w-0 flex-1 group"
        >
          <div className="w-12 sm:w-14 shrink-0 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface-secondary)]">
            <MediaImage
              src={title.posterPath}
              alt={primary}
              aspect="poster"
              mediaType={title.mediaType}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--accent-text)] transition-colors truncate">
                {primary}
              </h3>
              {isNextToWatch && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[var(--accent)] text-[var(--accent-foreground)]">
                  {zh.lists.nextToWatchBadge}
                </span>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)] tabular-nums">
              {title.year && <span>{title.year}</span>}
              {title.year && <span aria-hidden="true">·</span>}
              <span>{zh.mediaType[title.mediaType]}</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  state.status === 'completed'
                    ? 'text-emerald-400 font-medium'
                    : state.status === 'watching'
                      ? 'text-[var(--accent-text)] font-medium'
                      : ''
                }
              >
                {state.label}
              </span>
            </div>
          </div>
        </Link>
      </div>

      <Button
        variant="ghost"
        isIconOnly
        onPress={onRemove}
        aria-label={zh.lists.removeFromListAria(primary)}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-500/10 transition-colors shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
};

interface OrderedListSectionProps {
  sortedEntries: { entry: ListEntryDoc; title: TitleDoc }[];
  nextToWatchEntryId?: string;
  reorderEnabled: boolean;
  sensors: SensorDescriptor<SensorOptions>[];
  onDragEnd: (event: DragEndEvent) => void;
  seasonsByTitle: Record<string, SeasonDoc[]>;
  progressByTitleMap: Record<string, ProgressDoc | undefined>;
  defaultLang: 'zh' | 'original' | 'en';
  includeSpecials: boolean;
  onRemoveEntry: (entryId: string) => void;
}

const VIRTUAL_ROW_HEIGHT = 96;

export const OrderedListSection: React.FC<OrderedListSectionProps> = ({
  sortedEntries,
  nextToWatchEntryId,
  reorderEnabled,
  sensors,
  onDragEnd,
  seasonsByTitle,
  progressByTitleMap,
  defaultLang,
  includeSpecials,
  onRemoveEntry,
}) => {
  const [scrollTop, setScrollTop] = useState(0);
  const shouldVirtualize = sortedEntries.length > 100 && !reorderEnabled;

  const entryIds = useMemo(
    () => sortedEntries.map((item) => item.entry.id),
    [sortedEntries]
  );

  const startIdx = shouldVirtualize
    ? Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - 6)
    : 0;
  const endIdx = shouldVirtualize
    ? Math.min(sortedEntries.length, startIdx + 24)
    : sortedEntries.length;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={entryIds}
        strategy={verticalListSortingStrategy}
      >
        {shouldVirtualize ? (
          <div
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            className="max-h-[75vh] overflow-y-auto pr-1"
          >
            <div
              className="relative w-full"
              style={{ height: `${sortedEntries.length * VIRTUAL_ROW_HEIGHT}px` }}
            >
              {sortedEntries.slice(startIdx, endIdx).map(({ entry, title }, offset) => {
                const realIdx = startIdx + offset;
                return (
                  <div
                    key={entry.id}
                    className="absolute top-0 left-0 w-full pb-2.5"
                    style={{
                      transform: `translateY(${realIdx * VIRTUAL_ROW_HEIGHT}px)`,
                    }}
                  >
                    <SortableOrderedRow
                      entry={entry}
                      title={title}
                      index={realIdx}
                      isNextToWatch={nextToWatchEntryId === entry.id}
                      reorderEnabled={false}
                      seasons={seasonsByTitle[title.id] || []}
                      progress={progressByTitleMap[title.id]}
                      defaultLang={defaultLang}
                      includeSpecials={includeSpecials}
                      onRemove={() => onRemoveEntry(entry.id)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedEntries.map(({ entry, title }, idx) => (
              <SortableOrderedRow
                key={entry.id}
                entry={entry}
                title={title}
                index={idx}
                isNextToWatch={nextToWatchEntryId === entry.id}
                reorderEnabled={reorderEnabled}
                seasons={seasonsByTitle[title.id] || []}
                progress={progressByTitleMap[title.id]}
                defaultLang={defaultLang}
                includeSpecials={includeSpecials}
                onRemove={() => onRemoveEntry(entry.id)}
              />
            ))}
          </div>
        )}
      </SortableContext>
    </DndContext>
  );
};
