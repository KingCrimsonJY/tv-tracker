import React from 'react';
import { Check, CheckCheck, Clock, MoreHorizontal } from 'lucide-react';
import { Dropdown, ProgressBar } from '@heroui/react';
import { MediaImage } from '../../components/MediaImage';
import { formatSeconds } from '../../domain/progress';
import type { EpisodeMeta, ProgressDoc, TitleDoc } from '../../domain/types';
import { zh } from '../../i18n/zh';

interface EpisodeRowProps {
  title: TitleDoc;
  ep: EpisodeMeta;
  seasonNumber: number;
  aired: boolean;
  progress: ProgressDoc | undefined;
  isNextUp?: boolean;
  onToggleWatched: (episodeKey: string) => void;
  onMarkUpTo: (episodeKey: string) => void;
  onRecordResume: (episodeKey: string) => void;
}

export const EpisodeRow: React.FC<EpisodeRowProps> = ({
  title,
  ep,
  seasonNumber,
  aired,
  progress,
  isNextUp = false,
  onToggleWatched,
  onMarkUpTo,
  onRecordResume,
}) => {
  const watched = Boolean(progress?.watched[ep.key]);
  const hasResume = title.resume?.episodeKey === ep.key;

  const epResumePct =
    hasResume && title.resume && ep.runtime && ep.runtime > 0
      ? Math.max(
          2,
          Math.min(
            100,
            Math.round((title.resume.seconds / (ep.runtime * 60)) * 100)
          )
        )
      : 50;

  return (
    <div
      id={`ep-${ep.key}`}
      className={`flex items-center justify-between gap-3 p-3 sm:p-4 transition-colors ${
        !aired
          ? 'opacity-50'
          : isNextUp
            ? 'bg-[var(--accent-subtle)]/50'
            : 'hover:bg-[var(--surface-secondary)]'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* >= 44px tap target check circle */}
        <button
          type="button"
          disabled={!aired}
          onClick={() => onToggleWatched(ep.key)}
          aria-label={zh.detail.seasons.checkEpisodeAria(
            seasonNumber,
            ep.number,
            watched
          )}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 rounded-full focus:outline-none disabled:cursor-not-allowed"
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${
              watched
                ? 'bg-[var(--accent)] border-[var(--accent)] text-[var(--accent-foreground)]'
                : aired
                  ? 'border-[var(--muted)] hover:border-[var(--foreground)]'
                  : 'border-[var(--border)]'
            }`}
          >
            {watched && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
          </span>
        </button>

        {/* Episode Still Thumbnail on tablet and up */}
        {ep.stillPath && (
          <div className="hidden sm:block w-28 shrink-0 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--surface-secondary)]">
            <MediaImage
              src={ep.stillPath}
              alt={ep.name || zh.detail.seasons.episodePrefix(ep.number)}
              aspect="still"
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--foreground)] truncate">
              {zh.detail.seasons.episodePrefix(ep.number)} ·{' '}
              {ep.name || zh.detail.seasons.episodeDefaultName(ep.number)}
            </span>
            {hasResume && title.resume && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-text)] text-[11px] font-medium tabular-nums shrink-0">
                {formatSeconds(title.resume.seconds)}
              </span>
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)] tabular-nums">
            {ep.airDate ? (
              <span>
                {aired
                  ? ep.airDate
                  : zh.detail.seasons.unairedWithDate(ep.airDate)}
              </span>
            ) : (
              !aired && <span>{zh.detail.seasons.unairedNoDate}</span>
            )}
            {ep.runtime && (
              <>
                <span aria-hidden="true">·</span>
                <span>{zh.detail.seasons.runtimeMinutes(ep.runtime)}</span>
              </>
            )}
          </div>

          {hasResume && title.resume && !watched && (
            <div className="mt-2 max-w-xs">
              <ProgressBar
                aria-label={`${ep.key} ${zh.detail.movieWatchingProgress}`}
                value={epResumePct}
                size="sm"
                className="w-full"
              >
                <ProgressBar.Track className="h-1 bg-[var(--surface-tertiary)] rounded-full overflow-hidden">
                  <ProgressBar.Fill className="h-full bg-[var(--accent)] rounded-full" />
                </ProgressBar.Track>
              </ProgressBar>
            </div>
          )}
        </div>
      </div>

      {/* Episode Row Actions Menu */}
      {aired && (
        <Dropdown>
          <Dropdown.Trigger
            aria-label={zh.detail.seasons.episodeMoreAria(
              seasonNumber,
              ep.number
            )}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-tertiary)] transition-colors outline-none cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu
              aria-label={zh.detail.seasons.episodeMoreAria(
                seasonNumber,
                ep.number
              )}
              onAction={(key) => {
                if (key === 'up-to-here') {
                  onMarkUpTo(ep.key);
                } else if (key === 'record-time') {
                  onRecordResume(ep.key);
                }
              }}
            >
              <Dropdown.Item
                id="up-to-here"
                textValue={zh.detail.seasons.episodeMenu.markUpToHere}
              >
                <div className="flex items-center gap-2 text-xs">
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>{zh.detail.seasons.episodeMenu.markUpToHere}</span>
                </div>
              </Dropdown.Item>
              <Dropdown.Item
                id="record-time"
                textValue={zh.detail.seasons.episodeMenu.recordTime}
              >
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{zh.detail.seasons.episodeMenu.recordTime}</span>
                </div>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      )}
    </div>
  );
};
