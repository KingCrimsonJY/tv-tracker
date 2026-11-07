import React from 'react';
import { Button, Checkbox, Dropdown, Label } from '@heroui/react';
import { MoreHorizontal, CheckCheck, Clock } from 'lucide-react';
import { EpisodeMeta } from '../../domain/types';
import { resolveLocalizedText } from '../../domain/progress';
import { formatSeconds } from '../../domain/time';
import { useI18n } from '../../i18n';

interface EpisodeRowProps {
  seasonNumber: number;
  episode: EpisodeMeta;
  isWatched: boolean;
  resumeSeconds: number | null;
  aired: boolean;
  isHighlighted: boolean;
  onToggle: () => void;
  onMarkUpToHere: () => void;
  onRecordTime: () => void;
}

export const EpisodeRow: React.FC<EpisodeRowProps> = ({
  seasonNumber,
  episode,
  isWatched,
  resumeSeconds,
  aired,
  isHighlighted,
  onToggle,
  onMarkUpToHere,
  onRecordTime,
}) => {
  const { t, locale, formatDate } = useI18n();
  const resolvedEpTitle =
    resolveLocalizedText(episode.name, locale) ||
    t.detail.seasons.episodeDefaultName(episode.number);

  return (
    <div
      id={`episode-${episode.key}`}
      className={`flex items-center gap-3 p-2.5 sm:p-3 rounded-xl border transition-colors ${
        isHighlighted
          ? 'border-accent bg-accent/10'
          : 'border-border bg-surface hover:border-muted/50'
      } ${!aired ? 'opacity-55' : ''}`}
    >
      <Checkbox
        isSelected={isWatched}
        isDisabled={!aired && !isWatched}
        onChange={onToggle}
        aria-label={t.detail.seasons.checkEpisodeAria(seasonNumber, episode.number, isWatched)}
        className="m-0 shrink-0"
      >
        <Checkbox.Content className="size-11 justify-center">
          <Checkbox.Control className="size-6">
            <Checkbox.Indicator />
          </Checkbox.Control>
        </Checkbox.Content>
      </Checkbox>

      {/* Thumbnail on tablet and up */}
      {episode.stillPath && (
        <div className="hidden sm:block w-28 aspect-video rounded-lg overflow-hidden bg-surface-secondary shrink-0">
          <img
            referrerPolicy="no-referrer"
            src={episode.stillPath}
            alt={resolvedEpTitle}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Episode Title & Meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm sm:text-base truncate">
            {t.detail.seasons.episodePrefix(episode.number)} · {resolvedEpTitle}
          </span>
          {resumeSeconds !== null && resumeSeconds > 0 && !isWatched && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium shrink-0">
              {formatSeconds(resumeSeconds)}
            </span>
          )}
        </div>
        <div className="text-xs text-muted flex items-center gap-2 mt-0.5">
          {episode.airDate ? (
            <span>
              {aired
                ? formatDate(episode.airDate)
                : t.detail.seasons.unairedWithDate(formatDate(episode.airDate))}
            </span>
          ) : (
            !aired && <span>{t.detail.seasons.unairedNoDate}</span>
          )}
          {episode.runtime && <span>· {t.detail.seasons.runtimeMinutes(episode.runtime)}</span>}
        </div>
      </div>

      {/* Row menu */}
      {aired && (
        <Dropdown>
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            aria-label={t.detail.seasons.episodeMoreAria(seasonNumber, episode.number)}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu
              onAction={(key) => {
                if (key === 'mark-up-to') onMarkUpToHere();
                if (key === 'record-time') onRecordTime();
              }}
            >
              <Dropdown.Item id="mark-up-to">
                <CheckCheck className="w-4 h-4 mr-2" />
                <Label>{t.detail.seasons.episodeMenu.markUpToHere}</Label>
              </Dropdown.Item>
              <Dropdown.Item id="record-time">
                <Clock className="w-4 h-4 mr-2" />
                <Label>{t.detail.seasons.episodeMenu.recordTime}</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      )}
    </div>
  );
};
