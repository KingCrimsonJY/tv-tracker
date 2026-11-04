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
import { Drawer } from '@heroui/react';
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
              <button
                type="button"
                onClick={() => {
                  onMenuOpenChange(false);
                  onAddToListModalOpenChange(true);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-sm hover:bg-[var(--surface-secondary)] transition-colors text-left"
              >
                <FolderPlus className="w-4 h-4 text-[var(--muted)]" />
                <span>{zh.detail.menu.addToList}</span>
              </button>

              <button
                type="button"
                onClick={onOpenResumeModal}
                className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-sm hover:bg-[var(--surface-secondary)] transition-colors text-left"
              >
                <Clock className="w-4 h-4 text-[var(--muted)]" />
                <span>{zh.detail.menu.recordResumeTime}</span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  onMenuOpenChange(false);
                  await onMarkWholeTitleWatched();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-sm hover:bg-[var(--surface-secondary)] transition-colors text-left"
              >
                <CheckCheck className="w-4 h-4 text-[var(--muted)]" />
                <span>{zh.detail.menu.markAllWatched}</span>
              </button>

              {title.manualState !== 'paused' && (
                <button
                  type="button"
                  onClick={async () => {
                    onMenuOpenChange(false);
                    await onSetManualState('paused');
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-sm hover:bg-[var(--surface-secondary)] transition-colors text-left"
                >
                  <PauseCircle className="w-4 h-4 text-[var(--muted)]" />
                  <span>{zh.detail.menu.pause}</span>
                </button>
              )}

              {title.manualState !== 'dropped' && (
                <button
                  type="button"
                  onClick={async () => {
                    onMenuOpenChange(false);
                    await onSetManualState('dropped');
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-sm hover:bg-[var(--surface-secondary)] transition-colors text-left"
                >
                  <Ban className="w-4 h-4 text-[var(--muted)]" />
                  <span>{zh.detail.menu.drop}</span>
                </button>
              )}

              {title.manualState && (
                <button
                  type="button"
                  onClick={async () => {
                    onMenuOpenChange(false);
                    await onSetManualState(null);
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-sm hover:bg-[var(--surface-secondary)] transition-colors text-left"
                >
                  <Play className="w-4 h-4 text-[var(--muted)]" />
                  <span>{zh.detail.menu.clearManualState}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onMenuOpenChange(false);
                  onLangModalOpenChange(true);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-sm hover:bg-[var(--surface-secondary)] transition-colors text-left"
              >
                <Globe className="w-4 h-4 text-[var(--muted)]" />
                <span>{zh.detail.menu.titleLanguage}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onMenuOpenChange(false);
                  onEditModalOpenChange(true);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-sm hover:bg-[var(--surface-secondary)] transition-colors text-left"
              >
                <Edit3 className="w-4 h-4 text-[var(--muted)]" />
                <span>{zh.detail.menu.editMetadata}</span>
              </button>

              {title.source === 'tmdb' && (
                <button
                  type="button"
                  onClick={async () => {
                    onMenuOpenChange(false);
                    await onRefreshMetadata();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-sm hover:bg-[var(--surface-secondary)] transition-colors text-left"
                >
                  <RefreshCw className="w-4 h-4 text-[var(--muted)]" />
                  <span>{zh.detail.menu.refreshMetadata}</span>
                </button>
              )}

              {title.source === 'url' && title.sourceId && onRefreshPlaylist && (
                <button
                  type="button"
                  onClick={async () => {
                    onMenuOpenChange(false);
                    await onRefreshPlaylist();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-sm hover:bg-[var(--surface-secondary)] transition-colors text-left"
                >
                  <RefreshCw className="w-4 h-4 text-[var(--muted)]" />
                  <span>{zh.detail.menu.refreshPlaylist}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onMenuOpenChange(false);
                  setDeleteConfirmOpen(true);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-sm text-[var(--danger)] hover:bg-red-500/10 transition-colors text-left"
              >
                <Trash2 className="w-4 h-4" />
                <span>{zh.detail.menu.deleteTitle}</span>
              </button>
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
