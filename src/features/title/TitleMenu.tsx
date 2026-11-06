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
  Undo2,
  RefreshCw,
} from 'lucide-react';
import { TitleDoc } from '../../domain/types';
import { ComputedTitleState } from '../../domain/status';
import { useI18n } from '../../i18n';

interface TitleMenuProps {
  title: TitleDoc;
  titleState: ComputedTitleState;
  hasAnyProgress: boolean;
  onAddToList: () => void;
  onOpenResume: () => void;
  onMarkWholeWatched: () => void;
  onUndoPlaythrough: () => void;
  onSetManualState: (state: 'paused' | 'dropped' | null) => void;
  onOpenLangSelect: () => void;
  onOpenEdit: () => void;
  onRefreshMetadata: () => void;
  onRefreshPlaylist?: () => void;
  onDelete: () => void;
}

export const TitleMenu: React.FC<TitleMenuProps> = ({
  title,
  titleState,
  hasAnyProgress,
  onAddToList,
  onOpenResume,
  onMarkWholeWatched,
  onUndoPlaythrough,
  onSetManualState,
  onOpenLangSelect,
  onOpenEdit,
  onRefreshMetadata,
  onRefreshPlaylist,
  onDelete,
}) => {
  const { t } = useI18n();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleAction = (key: string) => {
    setDrawerOpen(false);
    switch (key) {
      case 'addToList':
        onAddToList();
        break;
      case 'resume':
        onOpenResume();
        break;
      case 'markAll':
        onMarkWholeWatched();
        break;
      case 'undoPlaythrough':
        onUndoPlaythrough();
        break;
      case 'pause':
        onSetManualState('paused');
        break;
      case 'drop':
        onSetManualState('dropped');
        break;
      case 'clearManual':
        onSetManualState(null);
        break;
      case 'lang':
        onOpenLangSelect();
        break;
      case 'edit':
        onOpenEdit();
        break;
      case 'refresh':
        onRefreshMetadata();
        break;
      case 'refreshPlaylist':
        onRefreshPlaylist?.();
        break;
      case 'delete':
        onDelete();
        break;
    }
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
                <Button variant="ghost" className="w-full justify-start" onPress={() => handleAction('addToList')}>
                  <ListPlus className="w-4 h-4 mr-3" />
                  {t.detail.menu.addToList}
                </Button>
                <Button variant="ghost" className="w-full justify-start" onPress={() => handleAction('resume')}>
                  <Clock className="w-4 h-4 mr-3" />
                  {t.detail.menu.recordResumeTime}
                </Button>
                {titleState.status !== 'completed' && titleState.status !== 'caught_up' && (
                  <Button variant="ghost" className="w-full justify-start" onPress={() => handleAction('markAll')}>
                    <CheckCheck className="w-4 h-4 mr-3" />
                    {t.detail.menu.markAllWatched}
                  </Button>
                )}
                {hasAnyProgress && (
                  <Button variant="ghost" className="w-full justify-start" onPress={() => handleAction('undoPlaythrough')}>
                    <Undo2 className="w-4 h-4 mr-3" />
                    {t.detail.menu.undoPlaythrough}
                  </Button>
                )}
                {title.manualState !== null ? (
                  <Button variant="ghost" className="w-full justify-start" onPress={() => handleAction('clearManual')}>
                    <PlayCircle className="w-4 h-4 mr-3" />
                    {t.detail.menu.clearManualState}
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" className="w-full justify-start" onPress={() => handleAction('pause')}>
                      <PauseCircle className="w-4 h-4 mr-3" />
                      {t.detail.menu.pause}
                    </Button>
                    <Button variant="ghost" className="w-full justify-start" onPress={() => handleAction('drop')}>
                      <XCircle className="w-4 h-4 mr-3" />
                      {t.detail.menu.drop}
                    </Button>
                  </>
                )}
                <Button variant="ghost" className="w-full justify-start" onPress={() => handleAction('lang')}>
                  <Languages className="w-4 h-4 mr-3" />
                  {t.detail.menu.titleLanguage}
                </Button>
                <Button variant="ghost" className="w-full justify-start" onPress={() => handleAction('edit')}>
                  <Edit3 className="w-4 h-4 mr-3" />
                  {t.detail.menu.editMetadata}
                </Button>
                {title.source === 'tmdb' && (
                  <Button variant="ghost" className="w-full justify-start" onPress={() => handleAction('refresh')}>
                    <RefreshCw className="w-4 h-4 mr-3" />
                    {t.detail.menu.refreshMetadata}
                  </Button>
                )}
                {title.source === 'url' && title.sourceId && onRefreshPlaylist && (
                  <Button variant="ghost" className="w-full justify-start" onPress={() => handleAction('refreshPlaylist')}>
                    <RefreshCw className="w-4 h-4 mr-3" />
                    {t.detail.menu.refreshPlaylist}
                  </Button>
                )}
                <Button variant="danger-soft" className="w-full justify-start" onPress={() => handleAction('delete')}>
                  <Trash2 className="w-4 h-4 mr-3" />
                  {t.detail.menu.deleteTitle}
                </Button>
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </div>

      <div className="hidden sm:block">
        <Dropdown>
          <Button
            variant="secondary"
            size="lg"
            isIconOnly
            aria-label={t.detail.moreActionsAria}
          >
            <MoreHorizontal className="w-5 h-5" />
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu onAction={(k) => handleAction(String(k))}>
              <Dropdown.Item id="addToList">
                <ListPlus className="w-4 h-4 mr-2" />
                <Label>{t.detail.menu.addToList}</Label>
              </Dropdown.Item>
              <Dropdown.Item id="resume">
                <Clock className="w-4 h-4 mr-2" />
                <Label>{t.detail.menu.recordResumeTime}</Label>
              </Dropdown.Item>
              {titleState.status !== 'completed' && titleState.status !== 'caught_up' && (
                <Dropdown.Item id="markAll">
                  <CheckCheck className="w-4 h-4 mr-2" />
                  <Label>{t.detail.menu.markAllWatched}</Label>
                </Dropdown.Item>
              )}
              {hasAnyProgress && (
                <Dropdown.Item id="undoPlaythrough">
                  <Undo2 className="w-4 h-4 mr-2" />
                  <Label>{t.detail.menu.undoPlaythrough}</Label>
                </Dropdown.Item>
              )}
              {title.manualState !== null ? (
                <Dropdown.Item id="clearManual">
                  <PlayCircle className="w-4 h-4 mr-2" />
                  <Label>{t.detail.menu.clearManualState}</Label>
                </Dropdown.Item>
              ) : (
                <>
                  <Dropdown.Item id="pause">
                    <PauseCircle className="w-4 h-4 mr-2" />
                    <Label>{t.detail.menu.pause}</Label>
                  </Dropdown.Item>
                  <Dropdown.Item id="drop">
                    <XCircle className="w-4 h-4 mr-2" />
                    <Label>{t.detail.menu.drop}</Label>
                  </Dropdown.Item>
                </>
              )}
              <Dropdown.Item id="lang">
                <Languages className="w-4 h-4 mr-2" />
                <Label>{t.detail.menu.titleLanguage}</Label>
              </Dropdown.Item>
              <Dropdown.Item id="edit">
                <Edit3 className="w-4 h-4 mr-2" />
                <Label>{t.detail.menu.editMetadata}</Label>
              </Dropdown.Item>
              {title.source === 'tmdb' && (
                <Dropdown.Item id="refresh">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  <Label>{t.detail.menu.refreshMetadata}</Label>
                </Dropdown.Item>
              )}
              {title.source === 'url' && title.sourceId && onRefreshPlaylist && (
                <Dropdown.Item id="refreshPlaylist">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  <Label>{t.detail.menu.refreshPlaylist}</Label>
                </Dropdown.Item>
              )}
              <Dropdown.Item id="delete" variant="danger">
                <Trash2 className="w-4 h-4 mr-2" />
                <Label>{t.detail.menu.deleteTitle}</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </>
  );
};
