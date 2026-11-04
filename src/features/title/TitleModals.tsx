import React, { useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import {
  AlertDialog,
  Button,
  Input,
  Label,
  Modal,
  TextArea,
  TextField,
  toast,
} from '@heroui/react';
import type { UpdateTitleDetailsInput } from '../../context/TrackerContext';
import type {
  DisplayLang,
  ListEntryDoc,
  TitleDoc,
  WatchListDoc,
} from '../../domain/types';
import { zh } from '../../i18n/zh';

interface TitleModalsProps {
  title: TitleDoc;
  lists: Record<string, WatchListDoc>;
  entriesByList: Record<string, ListEntryDoc[]>;
  langModalOpen: boolean;
  onLangModalOpenChange: (open: boolean) => void;
  editModalOpen: boolean;
  onEditModalOpenChange: (open: boolean) => void;
  addToListModalOpen: boolean;
  onAddToListModalOpenChange: (open: boolean) => void;
  deleteConfirmOpen: boolean;
  onDeleteConfirmOpenChange: (open: boolean) => void;
  onUpdateTitleLanguage: (displayLang: DisplayLang | null) => Promise<void>;
  onUpdateTitleDetails: (input: UpdateTitleDetailsInput) => Promise<void>;
  onAddTitleToList: (listId: string, titleId: string) => Promise<void>;
  onRemoveEntryFromList: (listId: string, entryId: string) => Promise<void>;
  onConfirmDeleteTitle: () => Promise<void>;
}

export const TitleModals: React.FC<TitleModalsProps> = ({
  title,
  lists,
  entriesByList,
  langModalOpen,
  onLangModalOpenChange,
  editModalOpen,
  onEditModalOpenChange,
  addToListModalOpen,
  onAddToListModalOpenChange,
  deleteConfirmOpen,
  onDeleteConfirmOpenChange,
  onUpdateTitleLanguage,
  onUpdateTitleDetails,
  onAddTitleToList,
  onRemoveEntryFromList,
  onConfirmDeleteTitle,
}) => {
  const [editZhName, setEditZhName] = useState(title.names.zh || '');
  const [editOrigName, setEditOrigName] = useState(title.names.original || '');
  const [editPoster, setEditPoster] = useState(title.posterPath || '');
  const [editOverview, setEditOverview] = useState(title.overview.zh || '');

  useEffect(() => {
    if (editModalOpen) {
      setEditZhName(title.names.zh || '');
      setEditOrigName(title.names.original || '');
      setEditPoster(title.posterPath || '');
      setEditOverview(title.overview.zh || '');
    }
  }, [editModalOpen, title]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateTitleDetails({
      name: editZhName.trim() || undefined,
      originalName: editOrigName.trim() || title.names.original,
      posterPath: editPoster.trim() || null,
      overview: editOverview.trim(),
    });
    onEditModalOpenChange(false);
  };

  return (
    <>
      {/* Title Language Modal */}
      <Modal.Backdrop
        isOpen={langModalOpen}
        onOpenChange={onLangModalOpenChange}
        isDismissable
      >
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)] outline-none">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold">
                {zh.detail.menu.titleLanguage}
              </Modal.Heading>
            </Modal.Header>
            <div className="mt-4 space-y-2">
              {(
                [
                  { id: null, label: zh.detail.languageOptions.default },
                  { id: 'zh', label: zh.detail.languageOptions.zh },
                  { id: 'original', label: zh.detail.languageOptions.original },
                  { id: 'en', label: zh.detail.languageOptions.en },
                ] as { id: DisplayLang | null; label: string }[]
              ).map((opt) => {
                const selected = title.displayLang === opt.id;
                return (
                  <Button
                    key={opt.id ?? 'default'}
                    variant={selected ? 'secondary' : 'ghost'}
                    fullWidth
                    onPress={async () => {
                      await onUpdateTitleLanguage(opt.id);
                      onLangModalOpenChange(false);
                    }}
                    className={`w-full justify-between px-4 py-3 min-h-[44px] rounded-xl text-sm font-medium border ${
                      selected
                        ? 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent-text)]'
                        : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground)]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {selected && <Check className="w-4 h-4" />}
                  </Button>
                );
              })}
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Add to List Modal */}
      <Modal.Backdrop
        isOpen={addToListModalOpen}
        onOpenChange={onAddToListModalOpenChange}
        isDismissable
      >
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)] outline-none">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold">
                {zh.detail.menu.addToList}
              </Modal.Heading>
            </Modal.Header>
            <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
              {Object.values(lists).length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  {zh.lists.emptyListsTitle}
                </p>
              ) : (
                Object.values(lists).map((list) => {
                  const entries = entriesByList[list.id] || [];
                  const existing = entries.find((e) => e.titleId === title.id);
                  return (
                    <Button
                      key={list.id}
                      variant={existing ? 'secondary' : 'ghost'}
                      fullWidth
                      onPress={async () => {
                        if (existing) {
                          await onRemoveEntryFromList(list.id, existing.id);
                        } else {
                          await toast.promise(
                            onAddTitleToList(list.id, title.id),
                            {
                              loading: zh.search.addingToListToast,
                              success: zh.search.addedToListToast(list.name),
                              error: (err) =>
                                err instanceof Error
                                  ? err.message
                                  : zh.search.addToListFailedToast,
                            }
                          );
                        }
                      }}
                      className={`w-full justify-between px-4 py-3 min-h-[44px] rounded-xl text-sm font-medium border ${
                        existing
                          ? 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent-text)]'
                          : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground)]'
                      }`}
                    >
                      <span className="truncate">{list.name}</span>
                      {existing ? (
                        <Check className="w-4 h-4 shrink-0" />
                      ) : (
                        <Plus className="w-4 h-4 shrink-0 text-[var(--muted)]" />
                      )}
                    </Button>
                  );
                })
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onPress={() => onAddToListModalOpenChange(false)}
              >
                {zh.app.close}
              </Button>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Edit Metadata Modal */}
      <Modal.Backdrop
        isOpen={editModalOpen}
        onOpenChange={onEditModalOpenChange}
        isDismissable
      >
        <Modal.Container size="md" placement="center" scroll="inside">
          <Modal.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)] outline-none">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold">
                {zh.detail.editModal.title}
              </Modal.Heading>
            </Modal.Header>
            <form onSubmit={handleSaveEdit} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <TextField value={editZhName} onChange={setEditZhName} fullWidth>
                  <Label className="block text-xs text-[var(--muted)] mb-1">
                    {zh.detail.editModal.zhNameLabel}
                  </Label>
                  <Input className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]" />
                </TextField>
                <TextField value={editOrigName} onChange={setEditOrigName} fullWidth>
                  <Label className="block text-xs text-[var(--muted)] mb-1">
                    {zh.detail.editModal.originalNameLabel}
                  </Label>
                  <Input className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]" />
                </TextField>
              </div>

              <TextField value={editPoster} onChange={setEditPoster} fullWidth>
                <Label className="block text-xs text-[var(--muted)] mb-1">
                  {zh.detail.editModal.posterPathLabel}
                </Label>
                <Input className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]" />
              </TextField>

              <TextField value={editOverview} onChange={setEditOverview} fullWidth>
                <Label className="block text-xs text-[var(--muted)] mb-1">
                  {zh.detail.editModal.overviewLabel}
                </Label>
                <TextArea
                  rows={3}
                  className="w-full p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--foreground)]"
                />
              </TextField>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onPress={() => onEditModalOpenChange(false)}
                >
                  {zh.app.cancel}
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  {zh.app.save}
                </Button>
              </div>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog.Backdrop
        isOpen={deleteConfirmOpen}
        onOpenChange={onDeleteConfirmOpenChange}
        isDismissable
      >
        <AlertDialog.Container size="sm" placement="center">
          <AlertDialog.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)] outline-none">
            <AlertDialog.Header className="flex items-center gap-3">
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading className="text-base font-semibold">
                {zh.detail.menu.deleteTitle}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="mt-3 text-sm text-[var(--muted)] leading-relaxed">
              <p>{zh.detail.deleteConfirm}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onPress={() => onDeleteConfirmOpenChange(false)}
              >
                {zh.app.cancel}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onPress={async () => {
                  onDeleteConfirmOpenChange(false);
                  await onConfirmDeleteTitle();
                }}
              >
                {zh.app.delete}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
};
