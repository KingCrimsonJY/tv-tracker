import React, { useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Button, Modal } from '@heroui/react';
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
  const [editDoubanScore, setEditDoubanScore] = useState(
    title.ratings?.douban || ''
  );
  const [editDoubanUrl, setEditDoubanUrl] = useState(
    title.externalIds?.douban || ''
  );
  const [editOverview, setEditOverview] = useState(title.overview.zh || '');
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (editModalOpen) {
      setEditZhName(title.names.zh || '');
      setEditOrigName(title.names.original || '');
      setEditPoster(title.posterPath || '');
      setEditDoubanScore(title.ratings?.douban || '');
      setEditDoubanUrl(title.externalIds?.douban || '');
      setEditOverview(title.overview.zh || '');
      setEditError(null);
    }
  }, [editModalOpen, title]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedScore = editDoubanScore.trim()
      ? Number(editDoubanScore.trim())
      : undefined;
    if (
      parsedScore !== undefined &&
      (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > 10)
    ) {
      setEditError(zh.detail.editModal.invalidDoubanScore);
      return;
    }

    await onUpdateTitleDetails({
      name: editZhName.trim() || undefined,
      originalName: editOrigName.trim() || title.names.original,
      posterPath: editPoster.trim() || null,
      overview: editOverview.trim(),
      doubanScore: editDoubanScore.trim(),
      doubanUrl: editDoubanUrl.trim(),
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
                  <button
                    key={opt.id ?? 'default'}
                    type="button"
                    onClick={async () => {
                      await onUpdateTitleLanguage(opt.id);
                      onLangModalOpenChange(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 min-h-[44px] rounded-xl text-sm font-medium border transition-colors ${
                      selected
                        ? 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent-text)]'
                        : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--foreground)]'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {selected && <Check className="w-4 h-4" />}
                  </button>
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
                    <button
                      key={list.id}
                      type="button"
                      onClick={async () => {
                        if (existing) {
                          await onRemoveEntryFromList(list.id, existing.id);
                        } else {
                          await onAddTitleToList(list.id, title.id);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 min-h-[44px] rounded-xl text-sm font-medium border transition-colors ${
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
                    </button>
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

      {/* Edit Metadata & Manual Douban Modal */}
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
                <div>
                  <label className="block text-xs text-[var(--muted)] mb-1">
                    {zh.detail.editModal.zhNameLabel}
                  </label>
                  <input
                    type="text"
                    value={editZhName}
                    onChange={(e) => setEditZhName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--muted)] mb-1">
                    {zh.detail.editModal.originalNameLabel}
                  </label>
                  <input
                    type="text"
                    value={editOrigName}
                    onChange={(e) => setEditOrigName(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--muted)] mb-1">
                    {zh.detail.editModal.doubanScoreLabel}
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={editDoubanScore}
                    onChange={(e) => {
                      setEditDoubanScore(e.target.value);
                      setEditError(null);
                    }}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[var(--muted)] mb-1">
                    {zh.detail.editModal.doubanUrlLabel}
                  </label>
                  <input
                    type="text"
                    value={editDoubanUrl}
                    onChange={(e) => setEditDoubanUrl(e.target.value)}
                    placeholder={zh.detail.editModal.doubanUrlPlaceholder}
                    className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">
                  {zh.detail.editModal.posterPathLabel}
                </label>
                <input
                  type="text"
                  value={editPoster}
                  onChange={(e) => setEditPoster(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--muted)] mb-1">
                  {zh.detail.editModal.overviewLabel}
                </label>
                <textarea
                  rows={3}
                  value={editOverview}
                  onChange={(e) => setEditOverview(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm"
                />
              </div>

              {editError && (
                <p className="text-xs text-[var(--danger)]">{editError}</p>
              )}

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

      {/* Delete Confirmation Modal */}
      <Modal.Backdrop
        isOpen={deleteConfirmOpen}
        onOpenChange={onDeleteConfirmOpenChange}
        isDismissable
      >
        <Modal.Container size="sm" placement="center">
          <Modal.Dialog className="bg-[var(--overlay)] border border-[var(--border)] rounded-2xl p-6 text-[var(--foreground)] outline-none">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold">
                {zh.detail.menu.deleteTitle}
              </Modal.Heading>
            </Modal.Header>
            <p className="mt-3 text-sm text-[var(--muted)] leading-relaxed">
              {zh.detail.deleteConfirm}
            </p>
            <div className="mt-5 flex justify-end gap-2">
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
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
};
