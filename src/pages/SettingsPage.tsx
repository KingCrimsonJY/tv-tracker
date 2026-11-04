import React, { useRef, useState } from 'react';
import { Download, LogOut, Monitor, Moon, ShieldAlert, Sun, Upload } from 'lucide-react';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  AlertDialog,
  Button,
  Switch,
  toast,
  ToggleButton,
  ToggleButtonGroup,
} from '@heroui/react';
import { useTracker } from '../context/TrackerContext.tsx';
import type { AppSettingsDoc, HomeSectionId } from '../domain/types.ts';
import { AboutSection } from '../features/settings/AboutSection.tsx';
import { SortableSectionRow } from '../features/settings/SortableSectionRow.tsx';
import { zh } from '../i18n/zh.ts';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    updateSettings,
    exportAllDataJson,
    importBackupData,
    signOut,
    signOutAll,
    showToast,
  } = useTracker();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImportText, setPendingImportText] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [logoutAllConfirmOpen, setLogoutAllConfirmOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSectionDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = settings.homeSections.findIndex((s) => s.id === active.id);
    const newIndex = settings.homeSections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    await updateSettings({ homeSections: arrayMove(settings.homeSections, oldIndex, newIndex) });
  };

  const handleToggleSection = async (id: HomeSectionId, enabled: boolean) => {
    await updateSettings({
      homeSections: settings.homeSections.map((s) => (s.id === id ? { ...s, enabled } : s)),
    });
  };

  const handleExportDownload = () => {
    try {
      const blob = new Blob([exportAllDataJson()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zhenji-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast(zh.settings.dataManagement.exportSuccessToast, 'success');
    } catch {
      showToast(zh.settings.dataManagement.exportFailedToast, 'danger');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setPendingImportText(reader.result);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = async () => {
    if (!pendingImportText) return;
    const rawText = pendingImportText;
    setPendingImportText(null);
    const runImport = async () => {
      const parsed: unknown = JSON.parse(rawText);
      await importBackupData(parsed);
    };
    try {
      const importPromise = runImport();
      toast.promise(importPromise, {
        loading: zh.settings.dataManagement.importingToast,
        success: zh.settings.dataManagement.importSuccess,
        error: zh.settings.dataManagement.importError,
      });
      await importPromise;
      setImportStatus(zh.settings.dataManagement.importSuccess);
    } catch {
      setImportStatus(zh.settings.dataManagement.importError);
    }
  };

  const titleLangOptions: { id: AppSettingsDoc['defaultTitleLang']; label: string }[] = [
    { id: 'zh', label: zh.settings.defaultTitleLang.zh },
    { id: 'original', label: zh.settings.defaultTitleLang.original },
    { id: 'en', label: zh.settings.defaultTitleLang.en },
  ];

  const themeOptions: { id: AppSettingsDoc['theme']; label: string; icon: typeof Moon }[] = [
    { id: 'dark', label: zh.settings.theme.dark, icon: Moon },
    { id: 'light', label: zh.settings.theme.light, icon: Sun },
    { id: 'system', label: zh.settings.theme.system, icon: Monitor },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 pb-12 max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)]">
          {zh.settings.title}
        </h1>
        <p className="text-xs sm:text-sm text-[var(--muted)]">{zh.settings.subtitle}</p>
      </header>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {zh.settings.defaultTitleLang.label}
          </h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {zh.settings.defaultTitleLang.description}
          </p>
        </div>
        <ToggleButtonGroup
          selectionMode="single"
          selectedKeys={new Set([settings.defaultTitleLang])}
          onSelectionChange={(keys) => {
            const first = [...keys][0];
            if (first != null) {
              void updateSettings({
                defaultTitleLang: String(first) as AppSettingsDoc['defaultTitleLang'],
              });
            }
          }}
          aria-label={zh.settings.defaultTitleLang.label}
          className="grid grid-cols-3 gap-2.5 w-full"
        >
          {titleLangOptions.map((opt) => (
            <ToggleButton
              key={opt.id}
              id={opt.id}
              className={`px-3 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-medium border transition-colors ${
                settings.defaultTitleLang === opt.id
                  ? 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent-text)]'
                  : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {zh.settings.includeSpecials.label}
          </h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {zh.settings.includeSpecials.description}
          </p>
        </div>
        <Switch
          aria-label={zh.settings.includeSpecials.label}
          isSelected={settings.includeSpecials}
          onChange={(val) => updateSettings({ includeSpecials: val })}
        >
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {zh.settings.theme.label}
          </h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">{zh.settings.theme.description}</p>
        </div>
        <ToggleButtonGroup
          selectionMode="single"
          selectedKeys={new Set([settings.theme])}
          onSelectionChange={(keys) => {
            const first = [...keys][0];
            if (first != null) {
              void updateSettings({ theme: String(first) as AppSettingsDoc['theme'] });
            }
          }}
          aria-label={zh.settings.theme.label}
          className="grid grid-cols-3 gap-2.5 w-full"
        >
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <ToggleButton
                key={opt.id}
                id={opt.id}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-medium border transition-colors ${
                  settings.theme === opt.id
                    ? 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent-text)]'
                    : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{opt.label}</span>
              </ToggleButton>
            );
          })}
        </ToggleButtonGroup>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {zh.settings.homeSections.label}
          </h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {zh.settings.homeSections.description}
          </p>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleSectionDragEnd}
        >
          <SortableContext
            items={settings.homeSections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {settings.homeSections.map((sec) => (
                <SortableSectionRow
                  key={sec.id}
                  section={sec}
                  onToggle={(val) => handleToggleSection(sec.id, val)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {zh.settings.dataManagement.label}
          </h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {zh.settings.dataManagement.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onPress={handleExportDownload}
            className="gap-2 min-h-[40px]"
          >
            <Download className="w-4 h-4" />
            <span>{zh.settings.dataManagement.exportJson}</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            variant="secondary"
            size="sm"
            onPress={() => fileInputRef.current?.click()}
            className="gap-2 min-h-[40px]"
          >
            <Upload className="w-4 h-4" />
            <span>{zh.settings.dataManagement.importJson}</span>
          </Button>
        </div>
        {importStatus && <p className="text-xs text-[var(--accent-text)]">{importStatus}</p>}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {zh.settings.account.label}
          </h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">{zh.settings.account.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onPress={() => signOut()} className="gap-2 min-h-[40px]">
            <LogOut className="w-4 h-4" />
            <span>{zh.settings.account.signOut}</span>
          </Button>
          <Button
            variant="danger-soft"
            size="sm"
            onPress={() => setLogoutAllConfirmOpen(true)}
            className="gap-2 min-h-[40px]"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{zh.settings.account.signOutAll}</span>
          </Button>
        </div>
      </section>

      <AboutSection />

      <AlertDialog.Backdrop
        isOpen={Boolean(pendingImportText)}
        onOpenChange={(open) => !open && setPendingImportText(null)}
        isDismissable
      >
        <AlertDialog.Container size="sm" placement="center">
          <AlertDialog.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)] outline-none">
            <AlertDialog.Header className="flex items-center gap-3">
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading className="text-base font-semibold">
                {zh.settings.dataManagement.importConfirmTitle}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
              <p>{zh.settings.dataManagement.importConfirmDescription}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onPress={() => setPendingImportText(null)}>
                {zh.app.cancel}
              </Button>
              <Button variant="danger" size="sm" onPress={confirmImport}>
                {zh.app.confirm}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>

      <AlertDialog.Backdrop
        isOpen={logoutAllConfirmOpen}
        onOpenChange={setLogoutAllConfirmOpen}
        isDismissable
      >
        <AlertDialog.Container size="sm" placement="center">
          <AlertDialog.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)] outline-none">
            <AlertDialog.Header className="flex items-center gap-3">
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading className="text-base font-semibold">
                {zh.settings.account.signOutAll}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
              <p>{zh.settings.account.signOutAllConfirm}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onPress={() => setLogoutAllConfirmOpen(false)}>
                {zh.app.cancel}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onPress={async () => {
                  setLogoutAllConfirmOpen(false);
                  await signOutAll();
                }}
              >
                {zh.app.confirm}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
};
