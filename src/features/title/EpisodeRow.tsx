import React from 'react';
import { Button, Dropdown, Label } from '@heroui/react';
import { Check, MoreHorizontal, CheckCheck, Clock } from 'lucide-react';
import { EpisodeMeta, TitleDoc } from '../../domain/types';
import { isEpisodeAired, makeEpisodeKey } from '../../domain/airing';
import { formatSeconds } from '../../domain/time';
import { resolveLocalizedText } from '../../domain/ordering';
import { useI18n } from '../../i18n';

interface EpisodeRowProps {
  seasonNumber: number;
  ep: EpisodeMeta;
  title: TitleDoc;
  isWatched: boolean;
  today: string;
  isHighlighted: boolean;
  onToggle: (epKey: string) => void;
  onMarkUpTo: (epKey: string) => void;
  onOpenResume: (epKey: string) => void;
}

export const EpisodeRow: React.FC<EpisodeRowProps> = ({
  seasonNumber,
  ep,
  title,
  isWatched,
  today,
  isHighlighted,
  onToggle,
  onMarkUpTo,
  onOpenResume,
}) => {
  const { t, locale } = useI18n();
  const epKey = makeEpisodeKey(seasonNumber, ep.number);
  const aired = title.source !== 'tmdb' ? true : isEpisodeAired(ep, today);
  const hasResumeHere = title.resume?.episodeKey === epKey;
  const resolvedEpName =
    resolveLocalizedText(ep.name, locale) ||
    t.detail.seasons.episodeDefaultName(ep.number);

  return (
    <div
      id={`episode-${epKey}`}
      className={`flex items-center justify-between gap-3 p-2.5 sm:p-3 rounded-xl border transition-colors ${
        isHighlighted
          ? 'bg-accent/15 border-accent'
          : !aired
          ? 'bg-[var(--surface)]/40 border-[var(--border)]/40 opacity-55'
          : 'bg-[var(--surface)] border-[var(--border)] hover:border-default-300/40'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          disabled={!aired}
          onClick={() => aired && onToggle(epKey)}
          aria-label={t.detail.seasons.checkEpisodeAria(seasonNumber, ep.number, isWatched)}
          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            !aired ? 'cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <span
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
              isWatched
                ? 'bg-accent border-accent text-accent-foreground'
                : 'border-default-300 hover:border-accent'
            }`}
          >
            {isWatched && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </span>
        </button>

        {ep.stillPath && (
          <div className="hidden sm:block w-24 aspect-video rounded-lg overflow-hidden bg-default-100 shrink-0">
            <img
              src={ep.stillPath}
              alt={resolvedEpName}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-sm font-medium truncate ${
                isWatched ? 'text-[var(--muted)]' : 'text-[var(--foreground)]'
              }`}
            >
              {t.detail.seasons.episodePrefix(ep.number)} · {resolvedEpName}
            </span>
            {hasResumeHere && title.resume && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium">
                {formatSeconds(title.resume.seconds)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)] mt-0.5">
            {!aired && ep.airDate ? (
              <span>{t.detail.seasons.unairedWithDate(ep.airDate)}</span>
            ) : !aired ? (
              <span>{t.detail.seasons.unairedNoDate}</span>
            ) : (
              <>
                {ep.airDate && <span>{ep.airDate}</span>}
                {ep.runtime && <span>{t.detail.seasons.runtimeMinutes(ep.runtime)}</span>}
              </>
            )}
          </div>
        </div>
      </div>

      {aired && (
        <Dropdown>
          <Button
            size="sm"
            variant="ghost"
            isIconOnly
            aria-label={t.detail.seasons.episodeMoreAria(seasonNumber, ep.number)}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
          <Dropdown.Popover>
            <Dropdown.Menu
              onAction={(key) => {
                if (key === 'upTo') onMarkUpTo(epKey);
                if (key === 'resume') onOpenResume(epKey);
              }}
            >
              <Dropdown.Item id="upTo">
                <CheckCheck className="w-4 h-4 mr-2" />
                <Label>{t.detail.seasons.episodeMenu.markUpToHere}</Label>
              </Dropdown.Item>
              <Dropdown.Item id="resume">
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
