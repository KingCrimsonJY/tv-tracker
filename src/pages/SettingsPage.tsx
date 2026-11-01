import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft,
  Check,
  Download,
  GripVertical,
  LogOut,
  Monitor,
  Moon,
  Sun,
} from 'lucide-react';
import { Button, Card } from '@heroui/react';
import { useTracker } from '../context/TrackerContext';
import { computeMovedRank } from '../domain/ordering';
import type { HomeSectionConfig, HomeSectionId } from '../domain/types';
import { zh } from '../i18n/zh';

interface SortableSectionRowProps {
  section: HomeSectionConfig;
  onToggle: (id: HomeSectionId, enabled: boolean) => void;
}

const SortableSectionRow: React.FC<SortableSectionRowProps> = ({ section, onToggle }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const label = zh.settings.sectionNames[section.id] || section.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-colors ${
        isDragging
          ? 'bg-[var(--surface-tertiary)] border-[var(--accent)] z-20 shadow-lg'
          : 'bg-[var(--surface-secondary)] border-[var(--border)]'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(section.id, !section.enabled)}
        aria-pressed={section.enabled}
        className="flex items-center gap-3 min-h-[44px] flex-1 text-left cursor-pointer"
      >
        <div
          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
            section.enabled
              ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-foreground)]'
              : 'border-[var(--muted)] bg-transparent text-transparent'
          }`}
        >
          <Check className="w-3.5 h-3.5" />
        </div>
        <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
      </button>

      <button
        type="button"
        aria-label={`拖拽调整 ${label} 顺序`}
        {...attributes}
        {...listeners}
        className="min-w-[44px] min-h-[44px] rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-tertiary)] flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-4 h-4" />
      </button>
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings, updateSettings, exportAllDataJson, signOut } = useTracker();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const orderedSections = [...settings.homeSections].sort((a, b) =>
    a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0
  );

  const handleToggleSection = (id: HomeSectionId, enabled: boolean) => {
    const next = orderedSections.map((sec) =>
      sec.id === id ? { ...sec, enabled } : sec
    );
    updateSettings({ homeSections: next });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedSections.findIndex((s) => s.id === active.id);
    const newIndex = orderedSections.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const newRank = computeMovedRank(orderedSections, oldIndex, newIndex);
    if (!newRank) return;
    const next = orderedSections.map((s) =>
      s.id === active.id ? { ...s, rank: newRank } : s
    );
    updateSettings({ homeSections: next });
  };

  const handleExportJson = () => {
    const jsonStr = exportAllDataJson();
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const datePart = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `zhenji-watch-tracker-${datePart}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 pb-12 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={zh.detail.back}
          className="min-w-[44px] min-h-[44px] rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] flex items-center justify-center hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)]">
            {zh.settings.title}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">
            {zh.settings.subtitle}
          </p>
        </div>
      </header>

      {/* 1. 默认标题语言 */}
      <Card className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 sm:p-6">
        <Card.Content className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              {zh.settings.defaultLangLabel}
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {zh.settings.defaultLangDesc}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {(['zh', 'original', 'en'] as const).map((lang) => {
              const active = settings.defaultTitleLang === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => updateSettings({ defaultTitleLang: lang })}
                  className={`min-h-[44px] px-3 rounded-xl border text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent-text)]'
                      : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-tertiary)]'
                  }`}
                >
                  {zh.settings.langOptions[lang]}
                </button>
              );
            })}
          </div>
        </Card.Content>
      </Card>

      {/* 2. 计入特别篇 */}
      <Card className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 sm:p-6">
        <Card.Content className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              {zh.settings.includeSpecialsLabel}
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {zh.settings.includeSpecialsDesc}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={settings.includeSpecials}
            onClick={() =>
              updateSettings({ includeSpecials: !settings.includeSpecials })
            }
            className={`min-w-[52px] min-h-[32px] p-1 rounded-full transition-colors flex items-center cursor-pointer shrink-0 ${
              settings.includeSpecials
                ? 'bg-[var(--accent)] justify-end'
                : 'bg-[var(--surface-tertiary)] justify-start'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-[var(--accent-foreground)] shadow-sm block" />
          </button>
        </Card.Content>
      </Card>

      {/* 3. 首页模块 (toggle + drag order) */}
      <Card className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 sm:p-6">
        <Card.Content className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              {zh.settings.homeSectionsLabel}
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {zh.settings.homeSectionsDesc}
            </p>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedSections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {orderedSections.map((section) => (
                  <SortableSectionRow
                    key={section.id}
                    section={section}
                    onToggle={handleToggleSection}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </Card.Content>
      </Card>

      {/* 4. 主题 */}
      <Card className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 sm:p-6">
        <Card.Content className="space-y-4">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {zh.settings.themeLabel}
          </h2>

          <div className="grid grid-cols-3 gap-2.5">
            {(
              [
                { id: 'dark', label: zh.settings.themeOptions.dark, icon: Moon },
                { id: 'light', label: zh.settings.themeOptions.light, icon: Sun },
                { id: 'system', label: zh.settings.themeOptions.system, icon: Monitor },
              ] as const
            ).map(({ id, label, icon: Icon }) => {
              const active = settings.theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => updateSettings({ theme: id })}
                  className={`min-h-[44px] px-3 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent-text)]'
                      : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-tertiary)]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </Card.Content>
      </Card>

      {/* 5. 导出数据 (JSON) & 退出登录 */}
      <Card className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 sm:p-6">
        <Card.Content className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">
              {zh.settings.dataSectionLabel}
            </h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {zh.settings.exportJsonDesc}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              variant="secondary"
              onPress={handleExportJson}
              className="min-h-[44px] gap-2 font-medium"
            >
              <Download className="w-4 h-4" />
              <span>{zh.settings.exportJson}</span>
            </Button>

            <Button
              variant="danger-soft"
              onPress={handleSignOut}
              className="min-h-[44px] gap-2 font-medium text-[var(--danger)]"
            >
              <LogOut className="w-4 h-4" />
              <span>{zh.settings.signOutButton}</span>
            </Button>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};
