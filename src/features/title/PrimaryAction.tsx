import React from 'react';
import { Button } from '@heroui/react';
import { Play, Check, RotateCcw } from 'lucide-react';
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
}

export const PrimaryAction: React.FC<PrimaryActionProps> = ({
  title,
  seasons,
  titleState,
  onMarkMovieWatched,
  onStartRewatch,
  onToggleEpisode,
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

  if (!episodic) {
    if (resume && resume.seconds > 0) {
      return (
        <Button variant="primary" onPress={onMarkMovieWatched}>
          <Play className="w-4 h-4 mr-1.5" />
          {t.detail.primaryAction.continueMovie(formatSeconds(resume.seconds))}
        </Button>
      );
    }
    return (
      <Button variant="primary" onPress={onMarkMovieWatched}>
        <Check className="w-4 h-4 mr-1.5" />
        {t.detail.primaryAction.markMovieWatched}
      </Button>
    );
  }

  // Episodic TV / custom series
  const nextEp = titleState.nextUp;

  if (hasResume && resume && resume.episodeKey) {
    const parsed = parseEpisodeKey(resume.episodeKey);
    const label = parsed
      ? t.detail.primaryAction.continueEpisode(
          parsed.seasonNumber,
          parsed.episodeNumber,
          formatSeconds(resume.seconds)
        )
      : `${resume.episodeKey.toUpperCase()} ${formatSeconds(resume.seconds)}`;

    return (
      <Button variant="primary" onPress={() => onToggleEpisode(resume.episodeKey || '')}>
        <Play className="w-4 h-4 mr-1.5" />
        {label}
      </Button>
    );
  }

  if (nextEp) {
    const isUnstarted = titleState.watchedCount === 0 && !hasResume;
    const parsed = parseEpisodeKey(nextEp.key);
    const label = isUnstarted
      ? t.detail.primaryAction.startWatching
      : parsed
        ? t.detail.primaryAction.markEpisodeWatched(parsed.seasonNumber, parsed.episodeNumber)
        : nextEp.key.toUpperCase();

    return (
      <Button variant="primary" onPress={() => onToggleEpisode(nextEp.key)}>
        {isUnstarted ? (
          <Play className="w-4 h-4 mr-1.5" />
        ) : (
          <Check className="w-4 h-4 mr-1.5" />
        )}
        {label}
      </Button>
    );
  }

  return null;
};
