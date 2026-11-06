import React, { useState, useEffect } from 'react';
import {
  Modal,
  AlertDialog,
  RadioGroup,
  Radio,
  TextField,
  Label,
  Input,
  TextArea,
  Button,
} from '@heroui/react';
import { Check, Plus } from 'lucide-react';
import { DisplayLang, WatchListDoc, ListEntryDoc, TitleDoc } from '../../domain/types';
import { UpdateTitleDetailsInput } from '../../data/actions/types';
import { useI18n } from '../../i18n';

interface TitleModalsProps {
  title: TitleDoc;
  lists: Record<string, WatchListDoc>;
  entriesByList: Record<string, ListEntryDoc[]>;
  addToListOpen: boolean;
  onAddToListOpenChange: (open: boolean) => void;
  onAddListEntry: (listId: string, titleId: string) => void;
  onRemoveListEntry: (listId: string, entryId: string) => void;
  langModalOpen: boolean;
  onLangModalOpenChange: (open: boolean) => void;
  onUpdateDisplayLang: (lang: DisplayLang | null) => void;
  editModalOpen: boolean;
  onEditModalOpenChange: (open: boolean) => void;
  onUpdateTitle: (patch: UpdateTitleDetailsInput) => void;
  deleteConfirmOpen: boolean;
  onDeleteConfirmOpenChange: (open: boolean) => void;
  onConfirmDelete: () => void;
  undoPlaythroughOpen: boolean;
  onUndoPlaythroughOpenChange: (open: boolean) => void;
  onConfirmUndoPlaythrough: () => void;
  deletePlaythroughId: string | null;
  onDeletePlaythroughIdChange: (id: string | null) => void;
  onConfirmDeletePlaythrough: (id: string) => void;
}

export const TitleModals: React.FC<TitleModalsProps> = ({
  title,
  lists,
  entriesByList,
  addToListOpen,
  onAddToListOpenChange,
  onAddListEntry,
  onRemoveListEntry,
  langModalOpen,
  onLangModalOpenChange,
  onUpdateDisplayLang,
  editModalOpen,
  onEditModalOpenChange,
  onUpdateTitle,
  deleteConfirmOpen,
  onDeleteConfirmOpenChange,
  onConfirmDelete,
  undoPlaythroughOpen,
  onUndoPlaythroughOpenChange,
  onConfirmUndoPlaythrough,
  deletePlaythroughId,
  onDeletePlaythroughIdChange,
  onConfirmDeletePlaythrough,
}) => {
  const { t } = useI18n();
  const [editZhTitle, setEditZhTitle] = useState(title.names.zh || '');
  const [editOriginalTitle, setEditOriginalTitle] = useState(title.names.original || '');
  const [editPosterUrl, setEditPosterUrl] = useState(title.posterPath ?? '');
  const [editOverview, setEditOverview] = useState(title.overview.zh || title.overview.en || '');

  useEffect(() => {
    if (editModalOpen) {
      setEditZhTitle(title.names.zh || '');
      setEditOriginalTitle(title.names.original || '');
      setEditPosterUrl(title.posterPath ?? '');
      setEditOverview(title.overview.zh || title.overview.en || '');
    }
  }, [editModalOpen, title]);

  const listArray = Object.values(lists);
  const deletingPtNum =
    title.playthroughs.find((p) => p.id === deletePlaythroughId)?.number ?? 1;

  return (
    <>
      <Modal.Backdrop isOpen={addToListOpen} onOpenChange={onAddToListOpenChange}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t.detail.menu.addToList}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-2">
              {listArray.length === 0 ? (
                <p className="text-sm text-[var(--muted)] py-4 text-center">
                  {t.search.emptyListsInModal}
                </p>
              ) : (
                listArray.map((list) => {
                  const existingEntry = (entriesByList[list.id] ?? []).find(
                    (e) => e.titleId === title.id
                  );
                  return (
                    <div
                      key={list.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--surface-secondary)]"
                    >
                      <span className="text-sm font-medium">{list.name}</span>
                      {existingEntry ? (
                        <Button
                          size="sm"
                          variant="tertiary"
                          onPress={() => onRemoveListEntry(list.id, existingEntry.id)}
                        >
                          <Check className="w-4 h-4 mr-1 text-success" />
                          {t.app.delete}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => onAddListEntry(list.id, title.id)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {t.lists.addActionShort}
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop isOpen={langModalOpen} onOpenChange={onLangModalOpenChange}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t.detail.menu.titleLanguage}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <RadioGroup
                value={title.displayLang ?? 'default'}
                onChange={(val) => {
                  onUpdateDisplayLang(val === 'default' ? null : (val as DisplayLang));
                  onLangModalOpenChange(false);
                }}
                aria-label={t.detail.menu.titleLanguage}
              >
                <Radio value="default">
                  <Radio.Control><Radio.Indicator /></Radio.Control>
                  <Radio.Content><Label>{t.detail.languageOptions.default}</Label></Radio.Content>
                </Radio>
                <Radio value="zh">
                  <Radio.Control><Radio.Indicator /></Radio.Control>
                  <Radio.Content><Label>{t.detail.languageOptions.zh} ({title.names.zh || '-'})</Label></Radio.Content>
                </Radio>
                <Radio value="original">
                  <Radio.Control><Radio.Indicator /></Radio.Control>
                  <Radio.Content><Label>{t.detail.languageOptions.original} ({title.names.original || '-'})</Label></Radio.Content>
                </Radio>
                <Radio value="en">
                  <Radio.Control><Radio.Indicator /></Radio.Control>
                  <Radio.Content><Label>{t.detail.languageOptions.en} ({title.names.en || '-'})</Label></Radio.Content>
                </Radio>
              </RadioGroup>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <Modal.Backdrop isOpen={editModalOpen} onOpenChange={onEditModalOpenChange}>
        <Modal.Container size="md" scroll="inside">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t.detail.editModal.title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-4">
              <TextField value={editZhTitle} onChange={setEditZhTitle}>
                <Label>{t.detail.editModal.zhNameLabel}</Label>
                <Input />
              </TextField>
              <TextField value={editOriginalTitle} onChange={setEditOriginalTitle}>
                <Label>{t.detail.editModal.originalNameLabel}</Label>
                <Input />
              </TextField>
              <TextField value={editPosterUrl} onChange={setEditPosterUrl}>
                <Label>{t.detail.editModal.posterPathLabel}</Label>
                <Input type="url" />
              </TextField>
              <TextField value={editOverview} onChange={setEditOverview}>
                <Label>{t.detail.editModal.overviewLabel}</Label>
                <TextArea rows={3} />
              </TextField>
            </Modal.Body>
            <Modal.Footer className="gap-2">
              <Button variant="tertiary" onPress={() => onEditModalOpenChange(false)}>
                {t.app.cancel}
              </Button>
              <Button
                variant="primary"
                onPress={() => {
                  onUpdateTitle({
                    name: editZhTitle.trim() || title.names.zh || title.names.original,
                    originalName: editOriginalTitle.trim() || title.names.original,
                    posterPath: editPosterUrl.trim() || null,
                    overview: editOverview.trim(),
                  });
                  onEditModalOpenChange(false);
                }}
              >
                {t.app.save}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <AlertDialog.Backdrop isOpen={deleteConfirmOpen} onOpenChange={onDeleteConfirmOpenChange}>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>{t.detail.menu.deleteTitle}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-[var(--muted)]">{t.detail.deleteConfirm}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer className="gap-2">
              <Button variant="tertiary" onPress={() => onDeleteConfirmOpenChange(false)}>
                {t.app.cancel}
              </Button>
              <Button variant="danger" onPress={onConfirmDelete}>
                {t.app.delete}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>

      <AlertDialog.Backdrop isOpen={undoPlaythroughOpen} onOpenChange={onUndoPlaythroughOpenChange}>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>{t.detail.playthroughs.cancelRewatch}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-[var(--muted)]">
                {title.playthroughs.length > 1
                  ? t.detail.playthroughs.cancelRewatchConfirm
                  : t.detail.playthroughs.undoResetFirstConfirm}
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer className="gap-2">
              <Button variant="tertiary" onPress={() => onUndoPlaythroughOpenChange(false)}>
                {t.app.cancel}
              </Button>
              <Button variant="danger" onPress={onConfirmUndoPlaythrough}>
                {t.app.confirm}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>

      <AlertDialog.Backdrop
        isOpen={Boolean(deletePlaythroughId)}
        onOpenChange={(open) => !open && onDeletePlaythroughIdChange(null)}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>
                {t.detail.playthroughs.deletePlaythroughTitle(deletingPtNum)}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-[var(--muted)]">
                {t.detail.playthroughs.deletePlaythroughConfirm(deletingPtNum)}
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer className="gap-2">
              <Button variant="tertiary" onPress={() => onDeletePlaythroughIdChange(null)}>
                {t.app.cancel}
              </Button>
              <Button
                variant="danger"
                onPress={() => deletePlaythroughId && onConfirmDeletePlaythrough(deletePlaythroughId)}
              >
                {t.app.delete}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
};
