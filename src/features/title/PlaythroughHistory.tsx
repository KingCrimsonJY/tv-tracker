import React, { useState } from 'react';
import { AlertDialog, Button } from '@heroui/react';
import type { ComputedTitleState } from '../../domain/progress';
import type { TitleDoc } from '../../domain/types';
import { zh } from '../../i18n/zh';

interface PlaythroughHistoryProps {
  title: TitleDoc;
  state: ComputedTitleState;
  onCancelRewatch: () => Promise<void>;
}

export const PlaythroughHistory: React.FC<PlaythroughHistoryProps> = ({
  title,
  state,
  onCancelRewatch,
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (title.playthroughs.length <= 1) return null;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          {zh.detail.playthroughs.historyTitle(title.playthroughs.length)}
        </h2>
        {state.isRewatching && (
          <Button
            variant="danger-soft"
            size="sm"
            onPress={() => setConfirmOpen(true)}
          >
            {zh.detail.playthroughs.cancelRewatch}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {title.playthroughs.map((pt) => (
          <div
            key={pt.id}
            className="flex items-center justify-between text-xs py-2 px-3 rounded-xl bg-[var(--surface-secondary)] tabular-nums"
          >
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
              <p>{zh.detail.playthroughs.cancelRewatchConfirm}</p>
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
    </section>
  );
};
