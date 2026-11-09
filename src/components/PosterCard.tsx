import React from 'react';
import { Link } from 'react-router-dom';
import { ProgressBar } from '@heroui/react';
import { computeTitleState, getTitleContinueProgressRatio, pickPoster, resolveDisplayTitle } from '../domain/progress';
import type { DefaultTitleLang, ProgressDoc, SeasonDoc, TitleDoc } from '../domain/types';
import { useI18n } from '../i18n';
import { MediaImage } from './MediaImage';

interface PosterCardProps {
  title: TitleDoc;
  seasons: SeasonDoc[];
  progress: ProgressDoc | undefined;
  defaultLang?: DefaultTitleLang;
  includeSpecials?: boolean;
}

/**
 * Density rule (Section 6 & 7):
 * A card shows the poster, title (max 2 lines), and either a small status indicator
 * or, while watching, a thin progress bar. Nothing else.
 */
export const PosterCard: React.FC<PosterCardProps> = React.memo(
  ({ title, seasons, progress, defaultLang = 'auto', includeSpecials = false }) => {
    const { locale, t } = useI18n();
    const { primary } = resolveDisplayTitle(title.names, title.displayLang, defaultLang, locale);
    const state = computeTitleState(title, seasons, progress, { includeSpecials });
    const posterSrc = pickPoster(title, locale);

    const isWatching = state.status === 'watching';
    const ratio = getTitleContinueProgressRatio(title, seasons, state.progressRatio);
    const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));

    return (
      <Link
        to={`/title/${title.id}`}
        className="group flex flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl"
      >
        <div className="relative rounded-xl overflow-hidden border border-border bg-surface transition-transform duration-200 group-hover:scale-[1.02]">
          <MediaImage src={posterSrc} alt={primary} aspect="poster" mediaType={title.mediaType} className="w-full" />

          {/* Thin progress bar at bottom of poster while watching */}
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
      </Link>
    );
  },
);
