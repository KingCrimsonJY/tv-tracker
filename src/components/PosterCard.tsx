import React from 'react';
import { Link } from 'react-router-dom';
import { ProgressBar } from '@heroui/react';
import { computeTitleState, resolveDisplayTitle } from '../domain/progress';
import type { ProgressDoc, SeasonDoc, TitleDoc } from '../domain/types';
import { zh } from '../i18n/zh';
import { MediaImage } from './MediaImage';

interface PosterCardProps {
  title: TitleDoc;
  seasons: SeasonDoc[];
  progress: ProgressDoc | undefined;
  defaultLang?: 'zh' | 'original' | 'en';
  includeSpecials?: boolean;
}

/**
 * Density rule (Section 6 & 7):
 * A card shows the poster, title (max 2 lines), and either a small status indicator
 * or, while watching, a thin progress bar. Nothing else.
 */
export const PosterCard: React.FC<PosterCardProps> = ({
  title,
  seasons,
  progress,
  defaultLang = 'zh',
  includeSpecials = false,
}) => {
  const { primary } = resolveDisplayTitle(title.names, title.displayLang, defaultLang);
  const state = computeTitleState(title, seasons, progress, { includeSpecials });

  const isWatching = state.status === 'watching';
  const pct = Math.round(state.progressRatio * 100);

  return (
    <Link
      to={`/title/${title.id}`}
      className="group flex flex-col text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6] rounded-xl"
    >
      <div className="relative rounded-xl overflow-hidden border border-white/[0.07] bg-[#1a1a1f] transition-transform duration-200 group-hover:scale-[1.02]">
        <MediaImage
          src={title.posterPath}
          alt={primary}
          aspect="poster"
          mediaType={title.mediaType}
          className="w-full"
        />

        {/* Thin progress bar at bottom of poster while watching */}
        {isWatching && (
          <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
            <ProgressBar
              aria-label={`${primary} 观看进度`}
              value={Math.max(6, pct)}
              size="sm"
              className="w-full"
            >
              <ProgressBar.Track className="h-1 bg-white/20 rounded-full overflow-hidden">
                <ProgressBar.Fill className="h-full bg-[#3b82f6] rounded-full" />
              </ProgressBar.Track>
            </ProgressBar>
          </div>
        )}
      </div>

      <div className="mt-2 px-0.5">
        <h3 className="text-sm font-medium text-[#f4f4f6] line-clamp-2 leading-snug group-hover:text-white transition-colors">
          {primary}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-[#9ca3af] tabular-nums">
          {state.hasNewEpisodes ? (
            <span className="text-[#3b82f6] font-medium">{zh.detail.newEpisodeBadge}</span>
          ) : (
            <span>{state.label}</span>
          )}
          {isWatching && state.countableCount > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {state.watchedCount}/{state.countableCount}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
};
