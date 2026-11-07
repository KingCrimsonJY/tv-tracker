import React from 'react';
import { Button } from '@heroui/react';
import { Check, RotateCcw } from 'lucide-react';
import { SeasonDoc, TitleDoc } from '../../domain/types';
import { ComputedTitleState, isEpisodic } from '../../domain/status';
import { parseEpisodeKey } from '../../domain/progress';
import { formatSeconds } from '../../domain/time';
import { useI18n } from '../../i18n';

interface PrimaryActionProps {
  title: TitleDoc;
  seasons: SeasonDoc[];
  titleState: ComputedTitleState;
  onMarkMovieWatched: () => void;
  onStartRewatch: () => void;
  onToggleEpisode: (epKey: string) => void;
  onOpenResume: (epKey?: string) => void;
}

export const PrimaryAction: React.FC<PrimaryActionProps> = ({
  title,
  seasons,
  titleState,
  onMarkMovieWatched,
  onStartRewatch,
  onToggleEpisode,
  onOpenResume,
}) => {
  const { t, formatDate } = useI18n();
  const episodic = isEpisodic(title, seasons);

  if (titleState.status === 'completed' || titleState.status === 'caught_up') {
    const label =
      titleState.status === 'completed'
        ? t.detail.primaryAction.completedStartRewatch
        : t.detail.primaryAction.caughtUpStartRewatch;
    return (
      <Button variant="secondary" onPress={onStartRewatch}>
        <RotateCcw className="w-4 h-4 mr-1.5" />
        {label}
      </Button>
    );
  }

  if (episodic && titleState.status === 'unaired') {
    return (
      <Button variant="secondary" isDisabled>
        {t.detail.primaryAction.unaired}
      </Button>
    );
  }

  if (!episodic && titleState.status === 'unreleased') {
    const formattedDate =
      title.releaseDate && title.releaseDate.trim() !== ''
        ? formatDate(title.releaseDate.trim())
        : null;
    return (
      <Button variant="secondary" isDisabled>
        {formattedDate
          ? t.detail.primaryAction.unreleasedWithDate(formattedDate)
          : t.detail.primaryAction.unreleased}
      </Button>
    );
  }

  const resume = title.resume;
  const hasResume = Boolean(resume && resume.seconds > 0);
  const resumeNode =
    hasResume && resume ? (
      <Button
        variant="ghost"
        size="sm"
        onPress={() => onOpenResume(resume.episodeKey ?? undefined)}
        className="text-xs sm:text-sm text-muted hover:text-foreground transition-colors tabular-nums cursor-pointer px-1 py-1"
      >
        {t.detail.primaryAction.stoppedAt(formatSeconds(resume.seconds))}
      </Button>
    ) : null;

  if (!episodic) {
    return (
      <>
        <Button variant="primary" onPress={onMarkMovieWatched}>
          <Check className="w-4 h-4 mr-1.5" />
          {t.detail.primaryAction.markMovieWatched}
        </Button>
        {resumeNode}
      </>
    );
  }

  // Episodic TV / custom series
  const targetEpKey = (hasResume && resume?.episodeKey) || titleState.nextUp?.key;
  if (targetEpKey) {
    const parsed = parseEpisodeKey(targetEpKey);
    const label = parsed
      ? t.detail.primaryAction.markEpisodeWatched(parsed.seasonNumber, parsed.episodeNumber)
      : targetEpKey.toUpperCase();

    return (
      <>
        <Button variant="primary" onPress={() => onToggleEpisode(targetEpKey)}>
          <Check className="w-4 h-4 mr-1.5" />
          {label}
        </Button>
        {resumeNode}
      </>
    );
  }

  return null;
};
