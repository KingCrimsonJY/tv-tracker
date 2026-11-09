import React, { useState } from 'react';
import { Dropdown, Drawer, Button, Label } from '@heroui/react';
import {
  MoreHorizontal,
  ListPlus,
  Clock,
  PauseCircle,
  XCircle,
  PlayCircle,
  Languages,
  Edit3,
  Trash2,
  CheckCheck,
  RefreshCw,
  Lock,
  LockOpen,
  type LucideIcon,
} from 'lucide-react';
import { TitleDoc } from '../../domain/types';
import { ComputedTitleState } from '../../domain/status';
import { useI18n } from '../../i18n';

interface TitleMenuProps {
  title: TitleDoc;
  titleState: ComputedTitleState;
  onAddToList: () => void;
  onOpenResume: () => void;
  onMarkWholeWatched: () => void;
  onSetManualState: (state: 'paused' | 'dropped' | null) => void;
  onOpenLangSelect: () => void;
  onOpenEdit: () => void;
  onRefreshMetadata: () => void;
  onRefreshPlaylist?: () => void;
  onDelete: () => void;
  onToggleStructureLock?: () => void;
}

interface MenuEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
  run: () => void;
}

export const TitleMenu: React.FC<TitleMenuProps> = ({
  title,
  titleState,
  onAddToList,
  onOpenResume,
  onMarkWholeWatched,
  onSetManualState,
  onOpenLangSelect,
  onOpenEdit,
  onRefreshMetadata,
  onRefreshPlaylist,
  onDelete,
  onToggleStructureLock,
}) => {
  const { t } = useI18n();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const finished = titleState.status === 'completed' || titleState.status === 'caught_up';

  // One list drives both the phone drawer and the desktop dropdown so they cannot drift apart.
  const entries: MenuEntry[] = [
    { id: 'addToList', label: t.detail.menu.addToList, icon: ListPlus, run: onAddToList },
    { id: 'resume', label: t.detail.menu.recordResumeTime, icon: Clock, run: onOpenResume },
    ...(!finished
      ? [{ id: 'markAll', label: t.detail.menu.markAllWatched, icon: CheckCheck, run: onMarkWholeWatched }]
      : []),
    ...(title.manualState
      ? [
          {
            id: 'clearManual',
            label: t.detail.menu.clearManualState,
            icon: PlayCircle,
            run: () => onSetManualState(null),
          },
        ]
      : [
          { id: 'pause', label: t.detail.menu.pause, icon: PauseCircle, run: () => onSetManualState('paused') },
          { id: 'drop', label: t.detail.menu.drop, icon: XCircle, run: () => onSetManualState('dropped') },
        ]),
    { id: 'lang', label: t.detail.menu.titleLanguage, icon: Languages, run: onOpenLangSelect },
    { id: 'edit', label: t.detail.menu.editMetadata, icon: Edit3, run: onOpenEdit },
    ...(title.source === 'tmdb'
      ? [{ id: 'refresh', label: t.detail.menu.refreshMetadata, icon: RefreshCw, run: onRefreshMetadata }]
      : []),
    ...(title.source === 'url' && title.sourceId && onRefreshPlaylist
      ? [{ id: 'refreshPlaylist', label: t.detail.menu.refreshPlaylist, icon: RefreshCw, run: onRefreshPlaylist }]
      : []),
    ...(titleState.isEpisodic && onToggleStructureLock
      ? [
          {
            id: 'structureLock',
            label: title.structureLocked ? t.upstream.unlock : t.upstream.lock,
            icon: title.structureLocked ? LockOpen : Lock,
            run: onToggleStructureLock,
          },
        ]
      : []),
    { id: 'delete', label: t.detail.menu.deleteTitle, icon: Trash2, danger: true, run: onDelete },
  ];

  const runEntry = (id: string) => {
    setDrawerOpen(false);
    entries.find((entry) => entry.id === id)?.run();
  };

  return (
    <>
      <div className="sm:hidden">
        <Button
          variant="secondary"
          size="lg"
          isIconOnly
          aria-label={t.detail.moreActionsAria}
          onPress={() => setDrawerOpen(true)}
        >
          <MoreHorizontal className="w-5 h-5" />
        </Button>

        <Drawer.Backdrop isOpen={drawerOpen} onOpenChange={setDrawerOpen}>
          <Drawer.Content placement="bottom">
            <Drawer.Dialog>
              <Drawer.Handle />
              <Drawer.Header>
                <Drawer.Heading>{t.detail.menu.title}</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body className="space-y-1 pb-6">
                {entries.map(({ id, label, icon: Icon, danger }) => (
                  <Button
                    key={id}
                    variant={danger ? 'danger-soft' : 'ghost'}
                    fullWidth
                    className="justify-start"
                    onPress={() => runEntry(id)}
                  >
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </Button>
                ))}
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </div>

      <div className="hidden sm:block">
        <Dropdown>
          <Button variant="secondary" size="lg" isIconOnly aria-label={t.detail.moreActionsAria}>
            <MoreHorizontal className="w-5 h-5" />
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu onAction={(key) => runEntry(String(key))}>
              {entries.map(({ id, label, icon: Icon, danger }) => (
                <Dropdown.Item key={id} id={id} textValue={label} variant={danger ? 'danger' : undefined}>
                  <Icon className={`size-4 shrink-0 ${danger ? 'text-danger' : 'text-muted'}`} />
                  <Label>{label}</Label>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </>
  );
};
