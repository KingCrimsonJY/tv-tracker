import React from 'react';
import { GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Description, Label, Switch } from '@heroui/react';
import type { HomeSectionConfig } from '../../domain/types.ts';
import { zh } from '../../i18n/zh.ts';

export const SortableSectionRow: React.FC<{
  section: HomeSectionConfig;
  onToggle: (enabled: boolean) => void;
}> = ({ section, onToggle }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };
  const label = zh.home.sections[section.id];
  const desc = zh.home.sectionDescriptions[section.id];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors ${
        isDragging
          ? 'bg-[var(--surface-tertiary)] border-[var(--accent)] shadow-xl'
          : 'bg-[var(--surface-secondary)] border-[var(--border)]'
      }`}
    >
      <Switch
        isSelected={section.enabled}
        onChange={onToggle}
        className="min-w-0 flex-1"
      >
        <Switch.Content className="w-full justify-between">
          <div className="min-w-0 flex-1 flex flex-col gap-0.5">
            <Label>{label}</Label>
            <Description className="truncate">{desc}</Description>
          </div>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={zh.settings.homeSections.dragHandleAria(label)}
        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] cursor-grab active:cursor-grabbing touch-none shrink-0"
      >
        <GripVertical className="w-4 h-4" />
      </button>
    </div>
  );
};
