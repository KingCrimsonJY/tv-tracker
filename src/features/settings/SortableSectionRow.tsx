import React from 'react';
import { GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Switch } from '@heroui/react';
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
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
        <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{desc}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Switch aria-label={label} isSelected={section.enabled} onChange={onToggle}>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={zh.settings.homeSections.dragHandleAria(label)}
          className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
