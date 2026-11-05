import React, { useState } from 'react';
import {
  Ban,
  CheckCheck,
  Clock,
  Edit3,
  FolderPlus,
  Globe,
  PauseCircle,
  Play,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { AlertDialog, Button, Drawer } from '@heroui/react';
import type { UpdateTitleDetailsInput } from '../../context/TrackerContext';
import type { ComputedTitleState } from '../../domain/progress';
import type {
  DisplayLang,
  ListEntryDoc,
  ManualState,
  TitleDoc,
  WatchListDoc,
} from '../../domain/types';
import { zh } from '../../i18n/zh';
import { TitleModals } from './TitleModals';

interface TitleMenuProps {
  title: TitleDoc;
  state: ComputedTitleState;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  langModalOpen: boolean;
  onLangModalOpenChange: (open: boolean) => void;
  editModalOpen: boolean;
  onEditModalOpenChange: (open: boolean) => void;
  addToListModalOpen: boolean;
  onAddToListModalOpenChange: (open: boolean) => void;
  lists: Record<string, WatchListDoc>;
  entriesByList: Record<string, ListEntryDoc[]>;
  onOpenResumeModal: () => void;
  onMarkWholeTitleWatched: () => Promise<void>;
  onCancelRewatch: () => Promise<void>;
  onSetManualState: (state: ManualState) => Promise<void>;
  onRefreshMetadata: () => Promise<void>;
  onRefreshPlaylist?: () => Promise<void>;
  onUpdateTitleLanguage: (displayLang: DisplayLang | null) => Promise<void>;
  onUpdateTitleDetails: (input: UpdateTitleDetailsInput) => Promise<void>;
  onAddTitleToList: (listId: string, titleId: string) => Promise<void>;
  onRemoveEntryFromList: (listId: string, entryId: string) => Promise<void>;
  onDeleteTitle: () => Promise<void>;
}

export const TitleMenu: React.FC<TitleMenuProps> = ({
  title,
  state,
  menuOpen,
  onMenuOpenChange,
  langModalOpen,
  onLangModalOpenChange,
  editModalOpen,
  onEditModalOpenChange,
  addToListModalOpen,
  onAddToListModalOpenChange,
  lists,
  entriesByList,
  onOpenResumeModal,
  onMarkWholeTitleWatched,
  onCancelRewatch,
  onSetManualState,
  onRefreshMetadata,
  onRefreshPlaylist,
  onUpdateTitleLanguage,
  onUpdateTitleDetails,
  onAddTitleToList,
  onRemoveEntryFromList,
  onDeleteTitle,
}) => {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [undoConfirmOpen, setUndoConfirmOpen] = useState(false);

  const canUndoPlaythrough =
    title.playthroughs.length > 1 ||
    state.watchedCount > 0 ||
    Boolean(title.resume) ||
    Boolean(title.playthroughs[0]?.completedAt);
  const isSinglePlaythrough = title.playthroughs.length <= 1;

  return (
    <>
      <Drawer.Backdrop
        isOpen={menuOpen}
        onOpenChange={onMenuOpenChange}
        isDismissable
      >
        <Drawer.Content placement="bottom" className="sm:max-w-md sm:mx-auto">
          <Drawer.Dialog>
            <Drawer.Handle />
            <Drawer.Header>
              <Drawer.Heading>{zh.detail.menu.title}</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="space-y-1">
              <Button
                variant="ghost"
                fullWidth
                onPress={() => {
                  onMenuOpenChange(false);
                  onAddToListModalOpenChange(true);
                }}
                className="justify-start gap-3"
              >
                <FolderPlus className="w-4 h-4 text-[var(--muted)]" />
                <span>{zh.detail.menu.addToList}</span>
              </Button>

              <Button
                variant="ghost"
                fullWidth
                onPress={onOpenResumeModal}
                className="justify-start gap-3"
              >
                <Clock className="w-4 h-4 text-[var(--muted)]" />
                <span>{zh.detail.menu.recordResumeTime}</span>
              </Button>

              <Button
                variant="ghost"
                fullWidth
                onPress={async () => {
                  onMenuOpenChange(false);
                  await onMarkWholeTitleWatched();
                }}
                className="justify-start gap-3"
              >
                <CheckCheck className="w-4 h-4 text-[var(--muted)]" />
                <span>{zh.detail.menu.markAllWatched}</span>
              </Button>

              {canUndoPlaythrough && (
                <Button
                  variant="ghost"
                  fullWidth
                  onPress={() => {
                    onMenuOpenChange(false);
                    setUndoConfirmOpen(true);
                  }}
                  className="justify-start gap-3"
                >
                  <RotateCcw className="w-4 h-4 text-[var(--muted)]" />
                  <span>{zh.detail.menu.undoPlaythrough}</span>
                </Button>
              )}

              {title.manualState !== 'paused' && (
                <Button
                  variant="ghost"
                  fullWidth
                  onPress={async () => {
                    onMenuOpenChange(false);
                    await onSetManualState('paused');
                  }}
                  className="justify-start gap-3"
                >
                  <PauseCircle className="w-4 h-4 text-[var(--muted)]" />
                  <span>{zh.detail.menu.pause}</span>
                </Button>
              )}

              {title.manualState !== 'dropped' && (
                <Button
                  variant="ghost"
                  fullWidth
                  onPress={async () => {
                    onMenuOpenChange(false);
                    await onSetManualState('dropped');
                  }}
                  className="justify-start gap-3"
                >
                  <Ban className="w-4 h-4 text-[var(--muted)]" />
                  <span>{zh.detail.menu.drop}</span>
                </Button>
              )}

              {title.manualState && (
                <Button
                  variant="ghost"
                  fullWidth
                  onPress={async () => {
                    onMenuOpenChange(false);
                    await onSetManualState(null);
                  }}
                  className="justify-start gap-3"
                >
                  <Play className="w-4 h-4 text-[var(--muted)]" />
                  <span>{zh.detail.menu.clearManualState}</span>
                </Button>
              )}

              <Button
                variant="ghost"
                fullWidth
                onPress={() => {
                  onMenuOpenChange(false);
                  onLangModalOpenChange(true);
                }}
                className="justify-start gap-3"
              >
                <Globe className="w-4 h-4 text-[var(--muted)]" />
                <span>{zh.detail.menu.titleLanguage}</span>
              </Button>

              <Button
                variant="ghost"
                fullWidth
                onPress={() => {
                  onMenuOpenChange(false);
                  onEditModalOpenChange(true);
                }}
                className="justify-start gap-3"
              >
                <Edit3 className="w-4 h-4 text-[var(--muted)]" />
                <span>{zh.detail.menu.editMetadata}</span>
              </Button>

              {title.source === 'tmdb' && (
                <Button
                  variant="ghost"
                  fullWidth
                  onPress={async () => {
                    onMenuOpenChange(false);
                    await onRefreshMetadata();
                  }}
                  className="justify-start gap-3"
                >
                  <RefreshCw className="w-4 h-4 text-[var(--muted)]" />
                  <span>{zh.detail.menu.refreshMetadata}</span>
                </Button>
              )}

              {title.source === 'url' && title.sourceId && onRefreshPlaylist && (
                <Button
                  variant="ghost"
                  fullWidth
                  onPress={async () => {
                    onMenuOpenChange(false);
                    await onRefreshPlaylist();
                  }}
                  className="justify-start gap-3"
                >
                  <RefreshCw className="w-4 h-4 text-[var(--muted)]" />
                  <span>{zh.detail.menu.refreshPlaylist}</span>
                </Button>
              )}

              <Button
                variant="danger-soft"
                fullWidth
                onPress={() => {
                  onMenuOpenChange(false);
                  setDeleteConfirmOpen(true);
                }}
                className="justify-start gap-3"
              >
                <Trash2 className="w-4 h-4" />
                <span>{zh.detail.menu.deleteTitle}</span>
              </Button>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

      <AlertDialog.Backdrop
        isOpen={undoConfirmOpen}
        onOpenChange={setUndoConfirmOpen}
        isDismissable
      >
        <AlertDialog.Container size="sm" placement="center">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>
                {zh.detail.playthroughs.cancelRewatch}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                {isSinglePlaythrough
                  ? zh.detail.playthroughs.undoResetFirstConfirm
                  : zh.detail.playthroughs.cancelRewatchConfirm}
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                variant="secondary"
                size="sm"
                onPress={() => setUndoConfirmOpen(false)}
              >
                {zh.app.cancel}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onPress={async () => {
                  setUndoConfirmOpen(false);
                  await onCancelRewatch();
                }}
              >
                {zh.app.confirm}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>

      <TitleModals
        title={title}
        lists={lists}
        entriesByList={entriesByList}
        langModalOpen={langModalOpen}
        onLangModalOpenChange={onLangModalOpenChange}
        editModalOpen={editModalOpen}
        onEditModalOpenChange={onEditModalOpenChange}
        addToListModalOpen={addToListModalOpen}
        onAddToListModalOpenChange={onAddToListModalOpenChange}
        deleteConfirmOpen={deleteConfirmOpen}
        onDeleteConfirmOpenChange={setDeleteConfirmOpen}
        onUpdateTitleLanguage={onUpdateTitleLanguage}
        onUpdateTitleDetails={onUpdateTitleDetails}
        onAddTitleToList={onAddTitleToList}
        onRemoveEntryFromList={onRemoveEntryFromList}
        onConfirmDeleteTitle={onDeleteTitle}
      />
    </>
  );
};
