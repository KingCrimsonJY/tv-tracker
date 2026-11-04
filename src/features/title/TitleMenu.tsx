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
  Trash2,
} from 'lucide-react';
import { Button, Drawer } from '@heroui/react';
import type { UpdateTitleDetailsInput } from '../../context/TrackerContext';
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
  onSetManualState: (state: ManualState) => Promise<void>;
  onRefreshMetadata: () => Promise<void>;
  onRefreshPlaylist?: () => Promise<void>;
  onUpdateTitleLanguage: (displayLang: DisplayLang | null) => Promise<void>;
  onUpdateTitleDetails: (input: UpdateTitleDetailsInput) => Promise<void>;
  onAddTitleToList: (listId: string, titleId: string) => Promise<void>;
  onRemoveEntryFromList: (listId: string, entryId: string) => Promise<void>;
  onDeleteTitle: () => Promise<void>;
}

const menuRowClass =
  'w-full justify-start gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-sm font-normal text-[var(--foreground)] hover:bg-[var(--surface-secondary)]';

export const TitleMenu: React.FC<TitleMenuProps> = ({
  title,
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

  return (
    <>
      <Drawer.Backdrop
        isOpen={menuOpen}
        onOpenChange={onMenuOpenChange}
        isDismissable
      >
        <Drawer.Content placement="bottom" className="sm:max-w-md sm:mx-auto">
          <Drawer.Dialog className="bg-[var(--overlay)] border-t sm:border border-[var(--border)] rounded-t-3xl sm:rounded-2xl sm:mb-6 p-5 text-[var(--foreground)] outline-none">
            <Drawer.Handle />
            <Drawer.Header className="pb-3 border-b border-[var(--separator)]">
              <Drawer.Heading className="text-base font-semibold">
                {zh.detail.menu.title}
              </Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body className="py-3 space-y-1">
              <Button
                variant="ghost"
                fullWidth
                onPress={() => {
                  onMenuOpenChange(false);
                  onAddToListModalOpenChange(true);
                }}
                className={menuRowClass}
              >
                <FolderPlus className="w-4 h-4 text-[var(--muted)]" />
                <span>{zh.detail.menu.addToList}</span>
              </Button>

              <Button
                variant="ghost"
                fullWidth
                onPress={onOpenResumeModal}
                className={menuRowClass}
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
                className={menuRowClass}
              >
                <CheckCheck className="w-4 h-4 text-[var(--muted)]" />
                <span>{zh.detail.menu.markAllWatched}</span>
              </Button>

              {title.manualState !== 'paused' && (
                <Button
                  variant="ghost"
                  fullWidth
                  onPress={async () => {
                    onMenuOpenChange(false);
                    await onSetManualState('paused');
                  }}
                  className={menuRowClass}
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
                  className={menuRowClass}
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
                  className={menuRowClass}
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
                className={menuRowClass}
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
                className={menuRowClass}
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
                  className={menuRowClass}
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
                  className={menuRowClass}
                >
                  <RefreshCw className="w-4 h-4 text-[var(--muted)]" />
                  <span>{zh.detail.menu.refreshPlaylist}</span>
                </Button>
              )}

              <Button
                variant="ghost"
                fullWidth
                onPress={() => {
                  onMenuOpenChange(false);
                  setDeleteConfirmOpen(true);
                }}
                className="w-full justify-start gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-sm font-normal text-[var(--danger)] hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" />
                <span>{zh.detail.menu.deleteTitle}</span>
              </Button>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>

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
