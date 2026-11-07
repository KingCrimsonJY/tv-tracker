import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Switch, Label } from '@heroui/react';
import { GripVertical } from 'lucide-react';
import { HomeSectionConfig } from '../../domain/types';
import { useI18n } from '../../i18n';

export const SortableSectionRow: React.FC<{
  section: HomeSectionConfig;
  onToggle: (enabled: boolean) => void;
}> = ({ section, onToggle }) => {
  const { t } = useI18n();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  const sectionLabel = t.home.sections[section.id];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          isIconOnly
          ref={setActivatorNodeRef}
          type="button"
          // Let dnd-kit own handle events while HeroUI supplies button styling.
          render={(props) => <button {...props} {...attributes} {...listeners} />}
          aria-label={t.settings.homeSections.dragHandleAria(sectionLabel)}
          className="w-8 h-8 flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)] touch-none cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical className="w-4 h-4" />
        </Button>
        <div className="min-w-0">
          <div className="text-sm font-medium text-[var(--foreground)] truncate">{sectionLabel}</div>
          <div className="text-xs text-[var(--muted)] truncate">{t.home.sectionDescriptions[section.id]}</div>
        </div>
      </div>

      <Switch isSelected={section.enabled} onChange={onToggle} size="sm">
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Label className="sr-only">{sectionLabel}</Label>
        </Switch.Content>
      </Switch>
    </div>
  );
};
