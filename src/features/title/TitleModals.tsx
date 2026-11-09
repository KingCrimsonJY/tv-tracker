import React from 'react';
import { Modal, AlertDialog, RadioGroup, Radio, Label, Button } from '@heroui/react';
import { Check, Plus } from 'lucide-react';
import { DisplayLang, WatchListDoc, ListEntryDoc, TitleDoc } from '../../domain/types';
import { UpdateTitleDetailsInput } from '../../data/actions/types';
import { useI18n } from '../../i18n';
import { EditTitleDialog } from './EditTitleDialog';
import { usePendingAction } from '../../hooks/usePendingAction';
import { withPendingSpinner } from '../../components/pendingContent';

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
  onConfirmDelete: () => Promise<void>;
  undoPlaythroughOpen: boolean;
  onUndoPlaythroughOpenChange: (open: boolean) => void;
  onConfirmUndoPlaythrough: () => Promise<void>;
  deletePlaythroughId: string | null;
  onDeletePlaythroughIdChange: (id: string | null) => void;
  onConfirmDeletePlaythrough: (id: string) => Promise<void>;
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
  const [deletingTitle, runDeleteTitle] = usePendingAction();
  const [undoingPlaythrough, runUndoPlaythrough] = usePendingAction();
  const [deletingPlaythrough, runDeletePlaythrough] = usePendingAction();
  const languageOptions: Array<{ value: DisplayLang | 'default'; label: string; name?: string }> = [
    { value: 'default', label: t.detail.languageOptions.default },
    { value: 'zh', label: t.detail.languageOptions.zh, name: title.names.zh || '-' },
    { value: 'original', label: t.detail.languageOptions.original, name: title.names.original || '-' },
    { value: 'en', label: t.detail.languageOptions.en, name: title.names.en || '-' },
  ];
  const listArray = Object.values(lists);
  const deletingPtNum = title.playthroughs.find((p) => p.id === deletePlaythroughId)?.number ?? 1;

  return (
    <>
      <Modal.Backdrop isOpen={addToListOpen} onOpenChange={onAddToListOpenChange}>
        <Modal.Container size="sm" scroll="inside">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label={t.app.close} />
            <Modal.Header>
              <Modal.Heading>{t.detail.menu.addToList}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-2">
              {listArray.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center">{t.search.emptyListsInModal}</p>
              ) : (
                listArray.map((list) => {
                  const existingEntry = (entriesByList[list.id] ?? []).find((e) => e.titleId === title.id);
                  return (
                    <div
                      key={list.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-surface-secondary"
                    >
                      <span className="min-w-0 text-sm font-medium wrap-anywhere">{list.name}</span>
                      {existingEntry ? (
                        <Button
                          size="sm"
                          className="shrink-0"
                          variant="tertiary"
                          onPress={() => onRemoveListEntry(list.id, existingEntry.id)}
                        >
                          <Check className="w-4 h-4 text-success" />
                          {t.app.delete}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          className="shrink-0"
                          variant="secondary"
                          onPress={() => onAddListEntry(list.id, title.id)}
                        >
                          <Plus className="w-4 h-4" />
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
        <Modal.Container size="sm" scroll="inside">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label={t.app.close} />
            <Modal.Header>
              <Modal.Heading>{t.detail.menu.titleLanguage}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <RadioGroup
                className="gap-1"
                value={title.displayLang ?? 'default'}
                onChange={(val) => {
                  onUpdateDisplayLang(val === 'default' ? null : (val as DisplayLang));
                  onLangModalOpenChange(false);
                }}
                aria-label={t.detail.menu.titleLanguage}
              >
                {languageOptions.map((option) => (
                  <Radio key={option.value} value={option.value} className="m-0 w-full min-w-0">
                    <Radio.Content className="min-h-11 w-full items-start rounded-lg px-2 py-2">
                      <Radio.Control className="mt-0.5">
                        <Radio.Indicator />
                      </Radio.Control>
                      <Label className="min-w-0 flex-1 whitespace-normal break-words">
                        <span className="block">{option.label}</span>
                        {option.name && (
                          <span className="mt-0.5 block text-xs font-normal text-muted">{option.name}</span>
                        )}
                      </Label>
                    </Radio.Content>
                  </Radio>
                ))}
              </RadioGroup>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <EditTitleDialog
        title={title}
        isOpen={editModalOpen}
        onOpenChange={onEditModalOpenChange}
        onSave={onUpdateTitle}
      />

      <AlertDialog.Backdrop isOpen={deleteConfirmOpen} onOpenChange={onDeleteConfirmOpenChange}>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>{t.detail.menu.deleteTitle}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-muted">{t.detail.deleteConfirm}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer className="gap-2">
              <Button variant="tertiary" onPress={() => onDeleteConfirmOpenChange(false)}>
                {t.app.cancel}
              </Button>
              <Button variant="danger" isPending={deletingTitle} onPress={() => runDeleteTitle(onConfirmDelete)}>
                {withPendingSpinner(t.app.delete)}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>

      <AlertDialog.Backdrop isOpen={undoPlaythroughOpen} onOpenChange={onUndoPlaythroughOpenChange}>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>
                {title.playthroughs.length > 1
                  ? t.detail.playthroughs.cancelThisRewatch
                  : t.detail.playthroughs.clearWatchHistory}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-muted">
                {title.playthroughs.length > 1
                  ? t.detail.playthroughs.cancelRewatchConfirm
                  : t.detail.playthroughs.undoResetFirstConfirm}
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer className="gap-2">
              <Button variant="tertiary" onPress={() => onUndoPlaythroughOpenChange(false)}>
                {t.app.cancel}
              </Button>
              <Button
                variant="danger"
                isPending={undoingPlaythrough}
                onPress={() => runUndoPlaythrough(onConfirmUndoPlaythrough)}
              >
                {withPendingSpinner(t.app.confirm)}
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
              <AlertDialog.Heading>{t.detail.playthroughs.deletePlaythroughTitle(deletingPtNum)}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-muted">{t.detail.playthroughs.deletePlaythroughConfirm(deletingPtNum)}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer className="gap-2">
              <Button variant="tertiary" onPress={() => onDeletePlaythroughIdChange(null)}>
                {t.app.cancel}
              </Button>
              <Button
                variant="danger"
                isPending={deletingPlaythrough}
                onPress={() =>
                  runDeletePlaythrough(async () => {
                    if (deletePlaythroughId) await onConfirmDeletePlaythrough(deletePlaythroughId);
                  })
                }
              >
                {withPendingSpinner(t.app.delete)}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
};
