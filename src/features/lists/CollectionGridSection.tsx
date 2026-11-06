import React from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@heroui/react';
import { GripVertical, X } from 'lucide-react';
import { DefaultTitleLang, ListEntryDoc, ProgressDoc, SeasonDoc, TitleDoc } from '../../domain/types';
import { ComputedTitleState, resolveDisplayTitle } from '../../domain/progress';
import { PosterCard } from '../../components/PosterCard';
import { useI18n } from '../../i18n';

interface ItemRow {
  entry: ListEntryDoc;
  title: TitleDoc;
  seasons: SeasonDoc[];
  progress: ProgressDoc | undefined;
  state: ComputedTitleState;
}

interface CollectionGridSectionProps {
  listId: string;
  items: ItemRow[];
  isSorting: boolean;
  defaultLang: DefaultTitleLang;
  includeSpecials: boolean;
  onReorder: (listId: string, activeEntryId: string, overEntryId: string) => Promise<void>;
  onRemove: (entryId: string) => void;
}

const SortablePosterItem: React.FC<{
  item: ItemRow;
  isSorting: boolean;
  defaultLang: DefaultTitleLang;
  includeSpecials: boolean;
  onRemove: () => void;
}> = ({ item, isSorting, defaultLang, includeSpecials, onRemove }) => {
  const { t, locale } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.entry.id,
    disabled: !isSorting,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  const { primary: displayTitle } = resolveDisplayTitle(
    item.title.names,
    item.title.displayLang,
    defaultLang,
    locale
  );

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <PosterCard
        title={item.title}
        seasons={item.seasons}
        progress={item.progress}
        defaultLang={defaultLang}
        includeSpecials={includeSpecials}
      />
      {isSorting && (
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t.lists.dragHandleAria(displayTitle)}
            className="w-9 h-9 rounded-full bg-black/75 text-white flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <Button
            size="sm"
            variant="danger"
            isIconOnly
            aria-label={t.lists.removeFromListAria(displayTitle)}
            onPress={onRemove}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export const CollectionGridSection: React.FC<CollectionGridSectionProps> = ({
  listId,
  items,
  isSorting,
  defaultLang,
  includeSpecials,
  onReorder,
  onRemove,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    void onReorder(listId, String(active.id), String(over.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((x) => x.entry.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3 sm:gap-4">
          {items.map((item) => (
            <SortablePosterItem
              key={item.entry.id}
              item={item}
              isSorting={isSorting}
              defaultLang={defaultLang}
              includeSpecials={includeSpecials}
              onRemove={() => onRemove(item.entry.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
