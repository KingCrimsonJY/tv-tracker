import React, { useState } from 'react';
import { AlertDialog, Button, Dropdown, Label, Modal, Separator, Toolbar } from '@heroui/react';
import { CircleCheck, ListPlus, Plus, Trash2 } from 'lucide-react';
import { withPendingSpinner } from '../../components/pendingContent';
import { useTracker } from '../../context/TrackerContext';
import type { BatchOutcome } from '../../data/actions/batch';
import { selectLists } from '../../data/selectors';
import { useTrackerState } from '../../data/useTrackerState';
import { BATCH_STATUSES, type BatchStatus } from '../../domain/batch';
import { compareRank } from '../../domain/ordering';
import { usePendingAction } from '../../hooks/usePendingAction';
import { useI18n } from '../../i18n';

interface BatchActionBarProps {
  selectedIds: readonly string[];
  /** Called after a batch was stored; the page leaves selection mode. */
  onFinished: () => void;
}

/**
 * Floating actions for the selected titles. It sits above the phone tab bar and is centered in the
 * content area beside the tablet rail and the desktop sidebar. Labels collapse to icons on narrow phones.
 */
export const BatchActionBar: React.FC<BatchActionBarProps> = ({ selectedIds, onFinished }) => {
  const { t } = useI18n();
  const { batchSetStatus, batchAddToList, batchRemoveTitles, showToast } = useTracker();
  const lists = useTrackerState(selectLists);
  const [listPickerOpen, setListPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isBusy, run] = usePendingAction();
  const count = selectedIds.length;
  const text = t.library.batch;
  const sortedLists = Object.values(lists).sort(compareRank);

  /** Report what happened; a failed batch has already been rolled back and announced. */
  const finish = (outcome: BatchOutcome, done: (changed: number) => string, unchanged: string) => {
    if (!outcome.stored) return;
    showToast(outcome.changed ? done(outcome.changed) : unchanged, outcome.changed ? 'success' : 'default');
    onFinished();
  };

  const setStatus = (status: BatchStatus) =>
    run(async () => finish(await batchSetStatus(selectedIds, status), text.statusDone, text.statusUnchanged));

  const addToList = (listId: string, listName: string) =>
    run(async () => {
      setListPickerOpen(false);
      finish(
        await batchAddToList(selectedIds, listId),
        (changed) => text.addedToList(changed, listName),
        text.alreadyInList(listName),
      );
    });

  const remove = () =>
    run(async () => {
      const outcome = await batchRemoveTitles(selectedIds);
      setDeleteOpen(false);
      finish(outcome, text.deleted, text.statusUnchanged);
    });

  const idle = count === 0 || isBusy;
  const label = (value: string) => <span className="max-[479px]:sr-only">{value}</span>;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom,0px)+12px)] z-30 flex justify-center px-3 sm:bottom-6 sm:left-20 lg:left-64">
        <Toolbar isAttached aria-label={text.toolbarAria} className="pointer-events-auto max-w-full">
          <span role="status" className="px-3 text-sm font-medium whitespace-nowrap tabular-nums text-foreground">
            {text.selectedCount(count)}
          </span>
          <Separator orientation="vertical" />
          <Dropdown>
            <Button variant="ghost" size="sm" isDisabled={idle}>
              <CircleCheck className="size-4" />
              {label(text.setStatus)}
            </Button>
            <Dropdown.Popover placement="top">
              <Dropdown.Menu aria-label={text.setStatus} onAction={(key) => void setStatus(key as BatchStatus)}>
                {BATCH_STATUSES.map((status) => (
                  <Dropdown.Item key={status} id={status} textValue={text.status[status]}>
                    <Label>{text.status[status]}</Label>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          <Button variant="ghost" size="sm" isDisabled={idle} onPress={() => setListPickerOpen(true)}>
            <ListPlus className="size-4" />
            {label(text.addToList)}
          </Button>
          <Button variant="danger-soft" size="sm" isDisabled={idle} onPress={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
            {label(text.delete)}
          </Button>
        </Toolbar>
      </div>

      <Modal.Backdrop isOpen={listPickerOpen} onOpenChange={setListPickerOpen}>
        <Modal.Container size="sm" scroll="inside">
          <Modal.Dialog>
            <Modal.CloseTrigger aria-label={t.app.close} />
            <Modal.Header>
              <Modal.Heading>{text.addToListTitle(count)}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-2">
              {sortedLists.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">{t.search.emptyListsInModal}</p>
              ) : (
                sortedLists.map((list) => (
                  <Button
                    key={list.id}
                    variant="secondary"
                    fullWidth
                    className="h-auto min-h-11 justify-between gap-3 py-2 text-left"
                    onPress={() => void addToList(list.id, list.name)}
                  >
                    <span className="min-w-0 whitespace-normal wrap-anywhere">{list.name}</span>
                    <Plus className="size-4 shrink-0" />
                  </Button>
                ))
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      <AlertDialog.Backdrop isOpen={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Heading>{text.deleteTitle(count)}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="text-sm text-muted">{text.deleteConfirm}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer className="gap-2">
              <Button variant="tertiary" onPress={() => setDeleteOpen(false)}>
                {t.app.cancel}
              </Button>
              <Button variant="danger" isPending={isBusy} onPress={() => void remove()}>
                {withPendingSpinner(text.delete)}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
};
