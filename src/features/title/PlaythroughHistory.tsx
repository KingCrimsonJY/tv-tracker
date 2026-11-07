import React from 'react';
import { Card, Chip, Button, Dropdown, Label } from '@heroui/react';
import { Check, MoreHorizontal, Trash2, RotateCcw } from 'lucide-react';
import { Playthrough } from '../../domain/types';
import { countCompletedPlaythroughs } from '../../domain/status';
import { useI18n } from '../../i18n';

interface PlaythroughHistoryProps {
  playthroughs: Playthrough[];
  onUndoLatest: () => void;
  onDeletePlaythrough: (playthroughId: string) => void;
}

export const PlaythroughHistory: React.FC<PlaythroughHistoryProps> = ({
  playthroughs,
  onUndoLatest,
  onDeletePlaythrough,
}) => {
  const { t, formatDate } = useI18n();

  const completedCount = countCompletedPlaythroughs(playthroughs);
  if (completedCount === 0 && playthroughs.length <= 1) return null;

  const sorted = [...playthroughs].sort((a, b) => a.number - b.number);
  const latestPtId = sorted[sorted.length - 1]?.id;
  const currentYear = new Date().getFullYear();

  const formatRowDate = (ts: number): string => {
    const year = new Date(ts).getFullYear();
    return formatDate(
      ts,
      year === currentYear ? { month: 'short', day: 'numeric' } : { year: 'numeric', month: 'short', day: 'numeric' },
    );
  };

  return (
    <Card>
      <Card.Header className="pb-1 flex flex-row items-center justify-between gap-3">
        <Card.Title className="text-base">{t.detail.playthroughs.title}</Card.Title>
        <span className="text-xs text-[var(--muted)] shrink-0">
          {t.detail.playthroughs.watchedCount(completedCount)}
        </span>
      </Card.Header>
      <Card.Content className="pt-1">
        <div className="divide-y divide-[var(--border)]">
          {sorted.map((pt) => {
            const isCompleted = pt.completedAt != null;
            const isLatest = pt.id === latestPtId;
            const isSinglePlaythrough = sorted.length === 1;
            const isRewatchInProgress = !isCompleted && sorted.length > 1;

            const dateLabel =
              isCompleted && pt.completedAt != null
                ? t.detail.playthroughs.finishedOn(formatRowDate(pt.completedAt))
                : t.detail.playthroughs.startedOn(formatRowDate(pt.startedAt));

            const menuItemLabel = isSinglePlaythrough
              ? t.detail.playthroughs.clearWatchHistory
              : isRewatchInProgress
                ? t.detail.playthroughs.cancelThisRewatch
                : t.detail.playthroughs.deleteThisRecord;

            const handleMenuAction = () => {
              if (isSinglePlaythrough || (isRewatchInProgress && isLatest)) {
                onUndoLatest();
              } else {
                onDeletePlaythrough(pt.id);
              }
            };

            return (
              <div key={pt.id} className="flex items-center gap-3 py-3 first:pt-2 last:pb-1">
                {isCompleted ? (
                  <span
                    className="w-6 h-6 rounded-full bg-success-subtle text-success flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </span>
                ) : (
                  <span
                    className="w-6 h-6 rounded-full border-2 border-accent text-accent text-xs font-semibold tabular-nums flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    {pt.number}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[var(--foreground)]">
                      {t.detail.playthroughs.nthWatch(pt.number)}
                    </span>
                    {!isCompleted && (
                      <Chip size="sm" color="accent" variant="soft">
                        {t.detail.playthroughs.inProgress}
                      </Chip>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{dateLabel}</p>
                </div>

                <div className="shrink-0">
                  <Dropdown>
                    <Button variant="ghost" isIconOnly aria-label={t.detail.playthroughs.moreAria(pt.number)}>
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                    <Dropdown.Popover placement="bottom end">
                      <Dropdown.Menu onAction={() => handleMenuAction()}>
                        <Dropdown.Item id="danger-action" variant="danger">
                          {isRewatchInProgress ? (
                            <RotateCcw className="w-4 h-4 mr-2 shrink-0" />
                          ) : (
                            <Trash2 className="w-4 h-4 mr-2 shrink-0" />
                          )}
                          <Label>{menuItemLabel}</Label>
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </div>
              </div>
            );
          })}
        </div>
      </Card.Content>
    </Card>
  );
};
