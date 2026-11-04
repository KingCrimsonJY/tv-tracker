import React, { useMemo } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';
import {
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@heroui/react';
import { PosterCard } from '../../components/PosterCard';
import { resolveDisplayTitle } from '../../domain/progress';
import type {
  ListEntryDoc,
  ProgressDoc,
  SeasonDoc,
  TitleDoc,
} from '../../domain/types';
import { zh } from '../../i18n/zh';

interface SortableCollectionCardProps {
  entry: ListEntryDoc;
  title: TitleDoc;
  reorderEnabled: boolean;
  seasons: SeasonDoc[];
  progress: ProgressDoc | undefined;
  defaultLang: 'zh' | 'original' | 'en';
  includeSpecials: boolean;
  onRemove: () => void;
}

const SortableCollectionCard: React.FC<SortableCollectionCardProps> = ({
  entry,
  title,
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

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <PosterCard
        title={title}
        seasons={seasons}
        progress={progress}
        defaultLang={defaultLang}
        includeSpecials={includeSpecials}
      />

      {reorderEnabled && (
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-20">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={zh.lists.dragHandleAria(primary)}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-black/75 backdrop-blur-md border border-white/20 flex items-center justify-center text-white cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <Button
            variant="ghost"
            isIconOnly
            onPress={onRemove}
            aria-label={zh.lists.removeFromListAria(primary)}
            className="min-w-[40px] min-h-[40px] rounded-xl bg-black/75 backdrop-blur-md border border-white/20 flex items-center justify-center text-red-300 hover:text-red-200"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

interface CollectionGridSectionProps {
  sortedEntries: { entry: ListEntryDoc; title: TitleDoc }[];
  reorderEnabled: boolean;
  sensors: SensorDescriptor<SensorOptions>[];
  onDragEnd: (event: DragEndEvent) => void;
  seasonsByTitle: Record<string, SeasonDoc[]>;
  progressByTitleMap: Record<string, ProgressDoc | undefined>;
  defaultLang: 'zh' | 'original' | 'en';
  includeSpecials: boolean;
  onRemoveEntry: (entryId: string) => void;
}

export const CollectionGridSection: React.FC<CollectionGridSectionProps> = ({
  sortedEntries,
  reorderEnabled,
  sensors,
  onDragEnd,
  seasonsByTitle,
  progressByTitleMap,
  defaultLang,
  includeSpecials,
  onRemoveEntry,
}) => {
  const entryIds = useMemo(
    () => sortedEntries.map((item) => item.entry.id),
    [sortedEntries]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={entryIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3.5 sm:gap-5">
          {sortedEntries.map(({ entry, title }) => (
            <SortableCollectionCard
              key={entry.id}
              entry={entry}
              title={title}
              reorderEnabled={reorderEnabled}
              seasons={seasonsByTitle[title.id] || []}
              progress={progressByTitleMap[title.id]}
              defaultLang={defaultLang}
              includeSpecials={includeSpecials}
              onRemove={() => onRemoveEntry(entry.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
