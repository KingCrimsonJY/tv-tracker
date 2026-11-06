import React from 'react';
import { Button } from '@heroui/react';
import { Play, Check, RotateCcw } from 'lucide-react';
import { TitleDoc } from '../../domain/types';
import { parseEpisodeKey } from '../../domain/airing';
import { ComputedTitleState } from '../../domain/status';
import { formatSeconds } from '../../domain/time';
import { useI18n } from '../../i18n';

interface PrimaryActionProps {
  title: TitleDoc;
  titleState: ComputedTitleState;
  onMarkMovieWatched: () => void;
  onStartRewatch: () => void;
  onToggleEpisode: (episodeKey: string) => void;
}

export const PrimaryAction: React.FC<PrimaryActionProps> = ({
  title,
  titleState,
  onMarkMovieWatched,
  onStartRewatch,
  onToggleEpisode,
}) => {
  const { t } = useI18n();
  const isEpisodeBased = title.mediaType === 'tv' || titleState.countableCount > 0;

  if (titleState.status === 'completed') {
    return (
      <Button variant="primary" size="lg" onPress={onStartRewatch}>
        <RotateCcw className="w-4 h-4 mr-2" />
        {t.detail.primaryAction.completedStartRewatch}
      </Button>
    );
  }

  if (titleState.status === 'caught_up') {
    return (
      <Button variant="primary" size="lg" onPress={onStartRewatch}>
        <RotateCcw className="w-4 h-4 mr-2" />
        {t.detail.primaryAction.caughtUpStartRewatch}
      </Button>
    );
  }

  if (!isEpisodeBased) {
    if (title.resume) {
      const timeStr = formatSeconds(title.resume.seconds);
      return (
        <Button variant="primary" size="lg" onPress={onMarkMovieWatched}>
          <Play className="w-4 h-4 mr-2 fill-current" />
          {t.detail.primaryAction.continueMovie(timeStr)}
        </Button>
      );
    }
    return (
      <Button variant="primary" size="lg" onPress={onMarkMovieWatched}>
        <Check className="w-4 h-4 mr-2" />
        {t.detail.primaryAction.markMovieWatched}
      </Button>
    );
  }

  if (titleState.status === 'unaired' || !titleState.nextUp) {
    return (
      <Button variant="secondary" size="lg" isDisabled>
        {t.detail.primaryAction.unaired}
      </Button>
    );
  }

  if (title.resume && title.resume.episodeKey) {
    const parsed = parseEpisodeKey(title.resume.episodeKey);
    const sNum = parsed?.seasonNumber ?? titleState.nextUp.seasonNumber;
    const eNum = parsed?.episodeNumber ?? titleState.nextUp.number;
    const timeStr = formatSeconds(title.resume.seconds);
    return (
      <Button
        variant="primary"
        size="lg"
        onPress={() => onToggleEpisode(title.resume!.episodeKey!)}
      >
        <Play className="w-4 h-4 mr-2 fill-current" />
        {t.detail.primaryAction.continueEpisode(sNum, eNum, timeStr)}
      </Button>
    );
  }

  if (titleState.watchedCount === 0) {
    return (
      <Button
        variant="primary"
        size="lg"
        onPress={() => onToggleEpisode(titleState.nextUp!.key)}
      >
        <Play className="w-4 h-4 mr-2 fill-current" />
        {t.detail.primaryAction.startWatching}
      </Button>
    );
  }

  return (
    <Button
      variant="primary"
      size="lg"
      onPress={() => onToggleEpisode(titleState.nextUp!.key)}
    >
      <Check className="w-4 h-4 mr-2" />
      {t.detail.primaryAction.markEpisodeWatched(
        titleState.nextUp.seasonNumber,
        titleState.nextUp.number
      )}
    </Button>
  );
};
