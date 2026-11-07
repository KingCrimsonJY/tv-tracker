import React from 'react';
import { Link } from 'react-router-dom';
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
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Chip } from '@heroui/react';
import { GripVertical, X } from 'lucide-react';
import { MediaImage } from '../../components/MediaImage';
import { DefaultTitleLang, ListEntryDoc, TitleDoc } from '../../domain/types';
import { ComputedTitleState, pickPoster, resolveDisplayTitle } from '../../domain/progress';
import { useI18n } from '../../i18n';

interface ItemRow {
  entry: ListEntryDoc;
  title: TitleDoc;
  state: ComputedTitleState;
}

interface OrderedListSectionProps {
  listId: string;
  items: ItemRow[];
  nextUpEntryId?: string;
  isSorting: boolean;
  defaultLang: DefaultTitleLang;
  onReorder: (listId: string, activeEntryId: string, overEntryId: string) => Promise<void>;
  onRemove: (entryId: string) => void;
}

const SortableOrderedRow: React.FC<{
  item: ItemRow;
  index: number;
  isNextUp: boolean;
  isSorting: boolean;
  defaultLang: DefaultTitleLang;
  onRemove: () => void;
}> = ({ item, index, isNextUp, isSorting, defaultLang, onRemove }) => {
  const { t, locale } = useI18n();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.entry.id,
    disabled: !isSorting,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  const { primary: displayTitle } = resolveDisplayTitle(item.title.names, item.title.displayLang, defaultLang, locale);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
        isNextUp
          ? 'bg-[var(--accent-subtle)] border-[var(--accent)]/40'
          : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--muted)]/40'
      }`}
    >
      {isSorting && (
        <Button
          variant="ghost"
          isIconOnly
          ref={setActivatorNodeRef}
          type="button"
          // Let dnd-kit own handle events while HeroUI supplies button styling.
          render={(props) => <button {...props} {...attributes} {...listeners} />}
          aria-label={t.lists.dragHandleAria(displayTitle)}
          className="w-11 h-11 flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] touch-none cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical className="w-5 h-5" />
        </Button>
      )}

      <div className="w-7 text-center font-mono text-sm font-semibold text-[var(--muted)] shrink-0">{index + 1}</div>

      <Link to={`/title/${item.title.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-11 h-16 rounded-lg overflow-hidden bg-[var(--surface-secondary)] shrink-0">
          <MediaImage
            src={pickPoster(item.title, locale)}
            alt={displayTitle}
            aspect="poster"
            mediaType={item.title.mediaType}
            className="w-full h-full"
            compact
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{displayTitle}</span>
            {isNextUp && (
              <Chip size="sm" color="accent" variant="soft">
                {t.lists.nextToWatchBadge}
              </Chip>
            )}
          </div>
          <div className="text-xs text-[var(--muted)] mt-0.5">{item.title.year ?? ''}</div>
        </div>
      </Link>

      <div className="flex items-center gap-2 shrink-0">
        <Chip
          size="sm"
          variant="soft"
          color={
            item.state.status === 'completed' || item.state.status === 'caught_up'
              ? 'success'
              : item.state.status === 'watching'
                ? 'accent'
                : 'default'
          }
        >
          {t.status[item.state.status]}
        </Chip>
        {isSorting && (
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            aria-label={t.lists.removeFromListAria(displayTitle)}
            onPress={onRemove}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export const OrderedListSection: React.FC<OrderedListSectionProps> = ({
  listId,
  items,
  nextUpEntryId,
  isSorting,
  defaultLang,
  onReorder,
  onRemove,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    void onReorder(listId, String(active.id), String(over.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((x) => x.entry.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2.5">
          {items.map((item, idx) => (
            <SortableOrderedRow
              key={item.entry.id}
              item={item}
              index={idx}
              isNextUp={item.entry.id === nextUpEntryId}
              isSorting={isSorting}
              defaultLang={defaultLang}
              onRemove={() => onRemove(item.entry.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
