import React, { useRef, useState } from 'react';
import {
  Card,
  Switch,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  AlertDialog,
  toast,
  Label,
} from '@heroui/react';
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
  arrayMove,
} from '@dnd-kit/sortable';
import { Download, Upload, LogOut, ShieldAlert, RefreshCw } from 'lucide-react';
import { useTracker } from '../context/TrackerContext';
import { AppSettingsDoc, DefaultTitleLang, HomeSectionConfig, UiLangSetting } from '../domain/types';
import { SortableSectionRow } from '../features/settings/SortableSectionRow';
import { AboutSection } from '../features/settings/AboutSection';
import { ScrollableFilterRow } from '../components/ScrollableFilterRow';
import { useI18n } from '../i18n';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    titles,
    updateSettings,
    refreshAllTmdbMetadata,
    exportAllDataJson,
    importBackupData,
    signOut,
    signOutAll,
  } = useTracker();
  const { t, translateError } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImportJson, setPendingImportJson] = useState<unknown | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [refreshingMeta, setRefreshingMeta] = useState<{ done: number; total: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = settings.homeSections.findIndex((s) => s.id === active.id);
    const newIndex = settings.homeSections.findIndex((s) => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      const next = arrayMove(settings.homeSections, oldIndex, newIndex);
      void updateSettings({ homeSections: next });
    }
  };

  const handleToggleSection = (id: HomeSectionConfig['id'], enabled: boolean) => {
    const next = settings.homeSections.map((s) => (s.id === id ? { ...s, enabled } : s));
    void updateSettings({ homeSections: next });
  };

  const handleExport = () => {
    try {
      const jsonStr = exportAllDataJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `zhenji-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t.settings.dataManagement.exportSuccessToast);
    } catch (err) {
      toast.danger(translateError(err, t.settings.dataManagement.exportFailedToast));
    }
  };

  const handleRefreshAllMeta = async () => {
    const tmdbCount = Object.values(titles).filter(
      (item) => item.source === 'tmdb' && Boolean(item.sourceId)
    ).length;
    setRefreshingMeta({ done: 0, total: tmdbCount });
    try {
      await refreshAllTmdbMetadata((done, total) => {
        setRefreshingMeta({ done, total });
      });
    } catch (err) {
      toast.danger(translateError(err, t.settings.dataManagement.refreshAllFailedToast));
    } finally {
      setRefreshingMeta(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !parsed.titles) {
        toast.danger(t.settings.dataManagement.importError);
        return;
      }
      setPendingImportJson(parsed);
      setImportDialogOpen(true);
    } catch {
      toast.danger(t.settings.dataManagement.importError);
    }
  };

  const confirmImport = async () => {
    if (!pendingImportJson) return;
    setImporting(true);
    try {
      await importBackupData(pendingImportJson);
      setImportDialogOpen(false);
      setPendingImportJson(null);
    } catch (err) {
      toast.danger(translateError(err, t.settings.dataManagement.importError));
    } finally {
      setImporting(false);
    }
  };

  const activeUiLang: UiLangSetting = settings.uiLang ?? 'system';
  const activeDefaultTitleLang: NonNullable<DefaultTitleLang> = settings.defaultTitleLang ?? 'auto';

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-2xl mx-auto">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t.settings.title}</h1>
        <p className="text-xs sm:text-sm text-[var(--muted)]">{t.settings.subtitle}</p>
      </div>

      <Card>
        <Card.Header className="pb-2">
          <Card.Title className="text-base">{t.settings.uiLang.label}</Card.Title>
          <Card.Description className="text-xs">{t.settings.uiLang.description}</Card.Description>
        </Card.Header>
        <Card.Content>
          <ScrollableFilterRow>
            <ToggleButtonGroup
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={new Set<string>([activeUiLang])}
              onSelectionChange={(keys) => {
                const k = Array.from(keys)[0] as UiLangSetting | undefined;
                if (k) void updateSettings({ uiLang: k });
              }}
              size="sm"
              aria-label={t.settings.uiLang.label}
            >
              <ToggleButton id="system">{t.settings.uiLang.system}</ToggleButton>
              <ToggleButton id="zh-CN">
                <ToggleButtonGroup.Separator />
                {t.settings.uiLang.zhCN}
              </ToggleButton>
              <ToggleButton id="en">
                <ToggleButtonGroup.Separator />
                {t.settings.uiLang.en}
              </ToggleButton>
            </ToggleButtonGroup>
          </ScrollableFilterRow>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="pb-2">
          <Card.Title className="text-base">{t.settings.defaultTitleLang.label}</Card.Title>
          <Card.Description className="text-xs">{t.settings.defaultTitleLang.description}</Card.Description>
        </Card.Header>
        <Card.Content>
          <ScrollableFilterRow>
            <ToggleButtonGroup
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={new Set<string>([activeDefaultTitleLang])}
              onSelectionChange={(keys) => {
                const k = Array.from(keys)[0] as NonNullable<DefaultTitleLang> | undefined;
                if (k) void updateSettings({ defaultTitleLang: k });
              }}
              size="sm"
              aria-label={t.settings.defaultTitleLang.label}
            >
              <ToggleButton id="auto">{t.settings.defaultTitleLang.auto}</ToggleButton>
              <ToggleButton id="zh">
                <ToggleButtonGroup.Separator />
                {t.settings.defaultTitleLang.zh}
              </ToggleButton>
              <ToggleButton id="original">
                <ToggleButtonGroup.Separator />
                {t.settings.defaultTitleLang.original}
              </ToggleButton>
              <ToggleButton id="en">
                <ToggleButtonGroup.Separator />
                {t.settings.defaultTitleLang.en}
              </ToggleButton>
            </ToggleButtonGroup>
          </ScrollableFilterRow>
        </Card.Content>
      </Card>

      <Card>
        <Card.Content>
          <Switch
            isSelected={settings.includeSpecials}
            onChange={(includeSpecials) => void updateSettings({ includeSpecials })}
            className="w-full justify-between"
          >
            <Switch.Content>
              <div className="flex flex-col gap-0.5">
                <Label className="text-sm font-medium">{t.settings.includeSpecials.label}</Label>
                <span className="text-xs text-[var(--muted)]">{t.settings.includeSpecials.description}</span>
              </div>
            </Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="pb-2">
          <Card.Title className="text-base">{t.settings.theme.label}</Card.Title>
          <Card.Description className="text-xs">{t.settings.theme.description}</Card.Description>
        </Card.Header>
        <Card.Content>
          <ScrollableFilterRow>
            <ToggleButtonGroup
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={new Set<string>([settings.theme])}
              onSelectionChange={(keys) => {
                const k = Array.from(keys)[0] as AppSettingsDoc['theme'] | undefined;
                if (k) void updateSettings({ theme: k });
              }}
              size="sm"
              aria-label={t.settings.theme.label}
            >
              <ToggleButton id="dark">{t.settings.theme.dark}</ToggleButton>
              <ToggleButton id="light">
                <ToggleButtonGroup.Separator />
                {t.settings.theme.light}
              </ToggleButton>
              <ToggleButton id="system">
                <ToggleButtonGroup.Separator />
                {t.settings.theme.system}
              </ToggleButton>
            </ToggleButtonGroup>
          </ScrollableFilterRow>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="pb-2">
          <Card.Title className="text-base">{t.settings.homeSections.label}</Card.Title>
          <Card.Description className="text-xs">{t.settings.homeSections.description}</Card.Description>
        </Card.Header>
        <Card.Content className="space-y-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={settings.homeSections.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {settings.homeSections.map((section) => (
                <SortableSectionRow
                  key={section.id}
                  section={section}
                  onToggle={(enabled) => handleToggleSection(section.id, enabled)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="pb-2">
          <Card.Title className="text-base">{t.settings.dataManagement.label}</Card.Title>
          <Card.Description className="text-xs">{t.settings.dataManagement.description}</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-wrap gap-3">
          <Button variant="secondary" size="sm" onPress={handleExport}>
            <Download className="w-4 h-4 mr-1.5" />
            {t.settings.dataManagement.exportJson}
          </Button>
          <Button variant="secondary" size="sm" onPress={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1.5" />
            {t.settings.dataManagement.importJson}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            isDisabled={refreshingMeta !== null}
            onPress={handleRefreshAllMeta}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshingMeta ? 'animate-spin' : ''}`} />
            {refreshingMeta
              ? t.settings.dataManagement.refreshingAllToast(refreshingMeta.done, refreshingMeta.total)
              : t.settings.dataManagement.refreshAllMetadata}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFileChange}
          />
        </Card.Content>
      </Card>

      <Card>
        <Card.Header className="pb-2">
          <Card.Title className="text-base">{t.settings.account.label}</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-xs text-[var(--muted)]">
            {t.settings.account.description}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onPress={() => void signOut()}>
              <LogOut className="w-4 h-4 mr-1.5" />
              {t.settings.account.signOut}
            </Button>
            <Button
              variant="danger-soft"
              size="sm"
              onPress={() => void signOutAll()}
            >
              <ShieldAlert className="w-4 h-4 mr-1.5" />
              {t.settings.account.signOutAll}
            </Button>
          </div>
        </Card.Content>
      </Card>

      <AboutSection />

      <AlertDialog.Backdrop isOpen={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>{t.settings.dataManagement.importConfirmTitle}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-[var(--muted)]">
                {t.settings.dataManagement.importConfirmDescription}
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer className="gap-2">
              <Button variant="tertiary" onPress={() => setImportDialogOpen(false)}>
                {t.app.cancel}
              </Button>
              <Button variant="danger" onPress={confirmImport} isDisabled={importing}>
                {t.app.confirm}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </div>
  );
};
