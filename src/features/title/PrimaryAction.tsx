import React from 'react';
import { Check, MoreHorizontal, Play, RotateCcw } from 'lucide-react';
import { Button, ProgressBar } from '@heroui/react';
import { type ComputedTitleState, formatSeconds } from '../../domain/progress';
import type { TitleDoc } from '../../domain/types';
import { zh } from '../../i18n/zh';

interface PrimaryActionProps {
  title: TitleDoc;
  state: ComputedTitleState;
  label: string;
  hasMovieResume: boolean;
  movieResumePct: number;
  onPrimaryAction: () => void;
  onOpenMenu: () => void;
}

export const PrimaryAction: React.FC<PrimaryActionProps> = ({
  title,
  state,
  label,
  hasMovieResume,
  movieResumePct,
  onPrimaryAction,
  onOpenMenu,
}) => {
  return (
    <>
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="primary"
          size="lg"
          isDisabled={state.status === 'unaired'}
          onPress={onPrimaryAction}
          className="min-h-[48px] px-6 font-semibold gap-2 rounded-xl shadow-lg"
        >
          {state.status === 'completed' || state.status === 'caught_up' ? (
            <RotateCcw className="w-4 h-4" />
          ) : state.status === 'watching' ? (
            <Check className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          <span>{label}</span>
        </Button>

        <Button
          variant="secondary"
          isIconOnly
          onPress={onOpenMenu}
          aria-label={zh.detail.moreActionsAria}
          className="min-w-[48px] min-h-[48px] rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
        >
          <MoreHorizontal className="w-5 h-5" />
        </Button>
      </div>

      {hasMovieResume && title.resume && (
        <div className="max-w-md pt-1 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[var(--accent-text)] font-medium tabular-nums">
            <span>
              {zh.detail.primaryAction.continueMovie(
                formatSeconds(title.resume.seconds)
              )}
            </span>
            {title.runtimeMin && (
              <span className="text-[var(--muted)]">
                {zh.detail.resumeModal.runtimeHint(title.runtimeMin)}
              </span>
            )}
          </div>
          <ProgressBar
            aria-label={zh.detail.movieWatchingProgress}
            value={movieResumePct}
            size="sm"
            className="w-full"
          >
            <ProgressBar.Track className="h-1.5 bg-[var(--surface-tertiary)] rounded-full overflow-hidden">
              <ProgressBar.Fill className="h-full bg-[var(--accent)] rounded-full" />
            </ProgressBar.Track>
          </ProgressBar>
        </div>
      )}
    </>
  );
};
