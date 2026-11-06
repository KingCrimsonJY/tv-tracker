import React from 'react';
import { Button, Dropdown, Label } from '@heroui/react';
import { Check, MoreHorizontal, CheckCheck, Clock } from 'lucide-react';
import { EpisodeMeta } from '../../domain/types';
import { isEpisodeAired, resolveLocalizedText } from '../../domain/progress';
import { formatSeconds } from '../../domain/time';
import { useI18n } from '../../i18n';

interface EpisodeRowProps {
  seasonNumber: number;
  episode: EpisodeMeta;
  isWatched: boolean;
  resumeSeconds: number | null;
  today: string;
  treatAllAsAired: boolean;
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
  today,
  treatAllAsAired,
  isHighlighted,
  onToggle,
  onMarkUpToHere,
  onRecordTime,
}) => {
  const { t, locale, formatDate } = useI18n();
  const aired = isEpisodeAired(episode, today, treatAllAsAired);
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
      {/* Check circle: >= 44px tap target */}
      <button
        type="button"
        disabled={!aired}
        onClick={onToggle}
        aria-label={t.detail.seasons.checkEpisodeAria(seasonNumber, episode.number, isWatched)}
        className="w-11 h-11 flex items-center justify-center shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed"
      >
        <span
          className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
            isWatched
              ? 'bg-accent text-accent-foreground'
              : aired
                ? 'border-2 border-muted hover:border-foreground'
                : 'border-2 border-border'
          }`}
        >
          {isWatched && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
        </span>
      </button>

      {/* Thumbnail on tablet and up */}
      {episode.stillPath && (
        <div className="hidden sm:block w-28 aspect-video rounded-lg overflow-hidden bg-surface-secondary shrink-0">
          <img
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
