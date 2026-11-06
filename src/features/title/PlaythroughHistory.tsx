import React from 'react';
import { Card, Chip, Button } from '@heroui/react';
import { History, Undo2, Trash2 } from 'lucide-react';
import { Playthrough } from '../../domain/types';
import { useI18n } from '../../i18n';

interface PlaythroughHistoryProps {
  playthroughs: Playthrough[];
  activePlaythroughId: string;
  hasAnyProgress: boolean;
  onUndoLatest: () => void;
  onDeletePlaythrough: (playthroughId: string) => void;
}

export const PlaythroughHistory: React.FC<PlaythroughHistoryProps> = ({
  playthroughs,
  activePlaythroughId,
  hasAnyProgress,
  onUndoLatest,
  onDeletePlaythrough,
}) => {
  const { t, formatDate } = useI18n();

  if (!hasAnyProgress && playthroughs.length <= 1) return null;

  const sorted = [...playthroughs].sort((a, b) => a.number - b.number);
  const latestPtId = sorted[sorted.length - 1]?.id;
  const completedCount = playthroughs.filter((p) => p.completedAt !== null).length;

  return (
    <Card>
      <Card.Header className="pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[var(--muted)]" />
          <Card.Title className="text-base">{t.detail.playthroughs.historyTitle(completedCount)}</Card.Title>
        </div>
      </Card.Header>
      <Card.Content className="space-y-2">
        {sorted.map((pt) => {
          const isActive = pt.id === activePlaythroughId;
          const isLatest = pt.id === latestPtId;
          const startDate = formatDate(pt.startedAt);
          const endDate = pt.completedAt ? formatDate(pt.completedAt) : null;

          return (
            <div
              key={pt.id}
              className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[var(--surface-secondary)] text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-[var(--foreground)]">
                  {t.detail.playthroughs.nthPlaythrough(pt.number)}
                </span>
                {isActive && !pt.completedAt && (
                  <Chip size="sm" color="accent" variant="soft">
                    {t.detail.playthroughs.inProgress}
                  </Chip>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[var(--muted)]">
                  {endDate
                    ? t.detail.playthroughs.completedAt(endDate)
                    : t.detail.playthroughs.startedAt(startDate)}
                </span>
                {isLatest && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={onUndoLatest}
                  >
                    <Undo2 className="w-3.5 h-3.5 mr-1" />
                    {t.detail.playthroughs.undoLatest}
                  </Button>
                )}
                {sorted.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    aria-label={t.detail.playthroughs.deletePlaythroughAria(pt.number)}
                    onPress={() => onDeletePlaythrough(pt.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-danger" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </Card.Content>
    </Card>
  );
};
