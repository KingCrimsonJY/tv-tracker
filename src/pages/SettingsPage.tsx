import React, { useRef, useState } from 'react';
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
  AlertCircle,
  ArrowLeft,
  Check,
  Download,
  GripVertical,
  LogOut,
  Monitor,
  Moon,
  ShieldAlert,
  Sun,
  Upload,
} from 'lucide-react';
import { Button, Card, Modal } from '@heroui/react';
import { useTracker } from '../context/TrackerContext.tsx';
import { apiFetch } from '../data/api.ts';
import { computeMovedRank } from '../domain/ordering.ts';
import type { HomeSectionConfig, HomeSectionId } from '../domain/types.ts';
import { zh } from '../i18n/zh.ts';

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
  const {
    settings,
    updateSettings,
    exportAllDataJson,
    importBackupData,
    signOut,
    signOutAll,
    showToast,
  } = useTracker();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingImportData, setPendingImportData] = useState<unknown | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('');
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

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

  const handleExportJson = async () => {
    let jsonStr = '';
    try {
      const res = await apiFetch('/api/export');
      if (res.ok) {
        jsonStr = await res.text();
      } else {
        jsonStr = exportAllDataJson();
      }
    } catch {
      jsonStr = exportAllDataJson();
    }

    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const datePart = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `zhenji-${datePart}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      setPendingImportData(parsed);
      setPendingFileName(file.name);
      setImportConfirmOpen(true);
    } catch {
      showToast('无法解析该 JSON 文件，请检查文件格式');
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImportData) return;
    setImporting(true);
    setImportError(null);
    try {
      await importBackupData(pendingImportData);
      setImportConfirmOpen(false);
      setPendingImportData(null);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : '导入失败，请检查文件格式');
    } finally {
      setImporting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleSignOutAll = async () => {
    await signOutAll();
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

      {/* 5. 导出数据 / 导入数据 / 退出登录 / 退出所有设备 */}
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

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />

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
              variant="secondary"
              onPress={() => fileInputRef.current?.click()}
              className="min-h-[44px] gap-2 font-medium"
            >
              <Upload className="w-4 h-4" />
              <span>{zh.settings.importJson}</span>
            </Button>

            <Button
              variant="danger-soft"
              onPress={handleSignOut}
              className="min-h-[44px] gap-2 font-medium text-[var(--danger)]"
            >
              <LogOut className="w-4 h-4" />
              <span>{zh.settings.signOutButton}</span>
            </Button>

            <Button
              variant="danger-soft"
              onPress={handleSignOutAll}
              className="min-h-[44px] gap-2 font-medium text-[var(--danger)]"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>{zh.settings.signOutAllButton}</span>
            </Button>
          </div>
        </Card.Content>
      </Card>

      {/* 导入数据确认弹窗 */}
      <Modal.Backdrop
        isOpen={importConfirmOpen}
        onOpenChange={setImportConfirmOpen}
        isDismissable={!importing}
      >
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)]">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold">
                {zh.settings.importConfirmTitle}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="mt-2 space-y-3 text-sm text-[var(--muted)]">
              {pendingFileName && (
                <p className="text-xs font-medium text-[var(--foreground)] bg-[var(--surface-secondary)] px-3 py-2 rounded-lg truncate">
                  文件：{pendingFileName}
                </p>
              )}
              <p className="leading-relaxed">{zh.settings.importConfirmBody}</p>
              {importError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-[var(--danger)]">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer className="mt-5 flex justify-end gap-2.5">
              <Button
                variant="secondary"
                size="sm"
                isDisabled={importing}
                onPress={() => {
                  setImportConfirmOpen(false);
                  setPendingImportData(null);
                  setImportError(null);
                }}
              >
                {zh.detail.editModal.cancel}
              </Button>
              <Button
                variant="primary"
                size="sm"
                isDisabled={importing}
                onPress={handleConfirmImport}
                className="bg-[var(--danger)] text-white"
              >
                {zh.settings.importConfirmButton}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
};
