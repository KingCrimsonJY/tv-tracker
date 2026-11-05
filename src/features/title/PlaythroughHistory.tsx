import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { AlertDialog, Button } from '@heroui/react';
import {
  type ComputedTitleState,
  renumberPlaythroughsByStartDate,
} from '../../domain/progress';
import type { Playthrough, TitleDoc } from '../../domain/types';
import { zh } from '../../i18n/zh';

interface PlaythroughHistoryProps {
  title: TitleDoc;
  state: ComputedTitleState;
  onCancelRewatch: () => Promise<void>;
  onDeletePlaythrough: (playthroughId: string) => Promise<void>;
}

export const PlaythroughHistory: React.FC<PlaythroughHistoryProps> = ({
  title,
  state,
  onCancelRewatch,
  onDeletePlaythrough,
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Playthrough | null>(null);

  const orderedPlaythroughs = renumberPlaythroughsByStartDate(title.playthroughs);
  const hasAnyHistory =
    orderedPlaythroughs.length > 1 ||
    state.watchedCount > 0 ||
    Boolean(title.resume) ||
    Boolean(orderedPlaythroughs[0]?.completedAt);

  if (!hasAnyHistory) return null;

  const isSinglePlaythrough = orderedPlaythroughs.length <= 1;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          {zh.detail.playthroughs.historyTitle(orderedPlaythroughs.length)}
        </h2>
        <Button
          variant="danger-soft"
          size="sm"
          onPress={() => setConfirmOpen(true)}
        >
          {zh.detail.playthroughs.undoLatest}
        </Button>
      </div>

      <div className="space-y-2">
        {orderedPlaythroughs.map((pt) => (
          <div
            key={pt.id}
            className="flex items-center justify-between gap-2 text-xs py-2 px-3 rounded-xl bg-[var(--surface-secondary)] tabular-nums"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 min-w-0">
              <span className="font-medium text-[var(--foreground)]">
                {zh.detail.playthroughs.nthPlaythrough(pt.number)}
              </span>
              <span className="text-[var(--muted)]">
                {zh.detail.playthroughs.startedAt(
                  new Date(pt.startedAt).toLocaleDateString('zh-CN')
                )}
                {pt.completedAt
                  ? ` · ${zh.detail.playthroughs.completedAt(
                      new Date(pt.completedAt).toLocaleDateString('zh-CN')
                    )}`
                  : ` · ${zh.detail.playthroughs.inProgress}`}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              aria-label={zh.detail.playthroughs.deletePlaythroughAria(pt.number)}
              onPress={() => setDeleteTarget(pt)}
            >
              <Trash2 className="w-3.5 h-3.5 text-[var(--muted)]" />
            </Button>
          </div>
        ))}
      </div>

      <AlertDialog.Backdrop isOpen={confirmOpen} onOpenChange={setConfirmOpen} isDismissable>
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
              <Button variant="secondary" size="sm" onPress={() => setConfirmOpen(false)}>
                {zh.app.cancel}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onPress={async () => {
                  setConfirmOpen(false);
                  await onCancelRewatch();
                }}
              >
                {zh.app.confirm}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>

      <AlertDialog.Backdrop
        isOpen={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        isDismissable
      >
        <AlertDialog.Container size="sm" placement="center">
          <AlertDialog.Dialog>
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>
                {deleteTarget
                  ? zh.detail.playthroughs.deletePlaythroughTitle(deleteTarget.number)
                  : zh.detail.playthroughs.cancelRewatch}
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                {isSinglePlaythrough
                  ? zh.detail.playthroughs.undoResetFirstConfirm
                  : deleteTarget
                    ? zh.detail.playthroughs.deletePlaythroughConfirm(deleteTarget.number)
                    : ''}
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button variant="secondary" size="sm" onPress={() => setDeleteTarget(null)}>
                {zh.app.cancel}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onPress={async () => {
                  const target = deleteTarget;
                  setDeleteTarget(null);
                  if (target) {
                    await onDeletePlaythrough(target.id);
                  }
                }}
              >
                {zh.app.delete}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </section>
  );
};
