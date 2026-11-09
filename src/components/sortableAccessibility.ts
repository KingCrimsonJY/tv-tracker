import type { Announcements, DndContextProps, ScreenReaderInstructions, UniqueIdentifier } from '@dnd-kit/core';
import type { MessageCatalog } from '../i18n';

/**
 * Localized screen-reader messages for sortable lists. dnd-kit's defaults are English only and read out
 * internal ids ("Draggable item entry_4a4f… was dropped…"); name items by their visible label instead.
 */
export function sortableAccessibility(
  t: MessageCatalog,
  labelOf: (id: UniqueIdentifier) => string,
): NonNullable<DndContextProps['accessibility']> {
  const announcements: Announcements = {
    onDragStart: ({ active }) => t.dnd.pickedUp(labelOf(active.id)),
    onDragOver: ({ active, over }) =>
      over && over.id !== active.id ? t.dnd.movedOver(labelOf(active.id), labelOf(over.id)) : undefined,
    onDragEnd: ({ active, over }) =>
      over && over.id !== active.id
        ? t.dnd.dropped(labelOf(active.id), labelOf(over.id))
        : t.dnd.droppedInPlace(labelOf(active.id)),
    onDragCancel: ({ active }) => t.dnd.cancelled(labelOf(active.id)),
  };
  const screenReaderInstructions: ScreenReaderInstructions = { draggable: t.dnd.instructions };
  return { announcements, screenReaderInstructions };
}
