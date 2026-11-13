import React from 'react';
import { Link } from 'react-router-dom';
import { ProgressBar } from '@heroui/react';
import { computeTitleState, getTitleContinueProgressRatio, pickPoster, resolveDisplayTitle } from '../domain/progress';
import type { DefaultTitleLang, ProgressDoc, SeasonDoc, TitleDoc } from '../domain/types';
import { useToday } from '../hooks/useToday';
import { useI18n } from '../i18n';
import { MediaImage } from './MediaImage';

export interface PosterCardProps {
  title: TitleDoc;
  seasons: SeasonDoc[];
  progress: ProgressDoc | undefined;
  defaultLang?: DefaultTitleLang;
  includeSpecials?: boolean;
}

/**
 * The poster, the title (two lines at most) and one line of status: a status word, or while watching a
 * thin progress bar with the episode count. Nothing else belongs on a card.
 * The wrapper decides what a press does (open the title, or select it) and must carry the `group` class.
 */
export const PosterCardBody: React.FC<PosterCardProps & { isSelected?: boolean }> = ({
  title,
  seasons,
  progress,
  defaultLang = 'auto',
  includeSpecials = false,
  isSelected = false,
}) => {
  const { locale, t } = useI18n();
  const { primary } = resolveDisplayTitle(title.names, title.displayLang, defaultLang, locale);
  const state = computeTitleState(title, seasons, progress, { includeSpecials, todayStr: useToday() });
  const isWatching = state.status === 'watching';
  const ratio = getTitleContinueProgressRatio(title, seasons, state.progressRatio);
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));

  return (
    <>
      <div
        className={`relative rounded-xl overflow-hidden border bg-surface transition-transform duration-200 group-hover:scale-[1.02] ${
          isSelected ? 'border-accent ring-2 ring-accent' : 'border-border'
        }`}
      >
        <MediaImage
          src={pickPoster(title, locale)}
          alt={primary}
          aspect="poster"
          mediaType={title.mediaType}
          className="w-full"
        />
        {isWatching && (
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-scrim-strong via-scrim-mid to-transparent">
            <ProgressBar
              aria-label={`${primary} ${t.app.watchProgressAriaSuffix}`}
              value={pct}
              size="sm"
              className="w-full"
            >
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
          </div>
        )}
      </div>

      <div className="mt-2 px-0.5">
        <h3 className="text-sm font-medium text-foreground line-clamp-2 leading-snug group-hover:text-accent-soft-foreground transition-colors">
          {primary}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted tabular-nums">
          {state.hasNewEpisodes ? (
            <span className="text-accent-soft-foreground font-medium">{t.detail.newEpisodeBadge}</span>
          ) : (
            <span>{t.status[state.status]}</span>
          )}
          {isWatching && state.isEpisodic && state.countableCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0">
                {state.watchedCount}/{state.countableCount}
              </span>
            </>
          )}
        </div>
      </div>
    </>
  );
};

/**
 * A card that opens the title. `inert` takes the link out of the tab order and the accessibility tree while
 * something else (the library's selection checkbox) acts for the card.
 */
export const PosterCard: React.FC<PosterCardProps & { isSelected?: boolean; inert?: boolean }> = React.memo(
  ({ inert, ...card }) => (
    <Link
      to={`/title/${card.title.id}`}
      inert={inert}
      className="group flex flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
    >
      <PosterCardBody {...card} />
    </Link>
  ),
);
