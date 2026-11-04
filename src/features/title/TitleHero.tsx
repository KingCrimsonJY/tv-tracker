import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@heroui/react';
import { MediaImage } from '../../components/MediaImage';
import type { ComputedTitleState } from '../../domain/progress';
import type { TitleDoc } from '../../domain/types';
import { zh } from '../../i18n/zh';

interface TitleHeroProps {
  title: TitleDoc;
  state: ComputedTitleState;
  primary: string;
  secondary?: string;
  metaParts: string[];
  onBack: () => void;
}

export const TitleHero: React.FC<TitleHeroProps> = ({
  title,
  state,
  primary,
  secondary,
  metaParts,
  onBack,
}) => {
  return (
    <>
      {/* Full-bleed Backdrop Hero (~55vh on phone) */}
      <div className="relative h-[55vh] sm:h-[48vh] lg:h-[52vh] w-full overflow-hidden">
        <MediaImage
          src={title.backdropPath || title.posterPath}
          alt={primary}
          aspect="backdrop"
          mediaType={title.mediaType}
          priority
          className="w-full h-full"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/65 to-black/30" />

        <div className="absolute top-4 left-4 sm:top-6 sm:left-6 z-20">
          <Button
            variant="secondary"
            isIconOnly
            onPress={onBack}
            aria-label={zh.app.back}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Overlapping Header Section */}
      <div className="relative z-10 -mt-28 sm:-mt-36 px-4 sm:px-6 lg:px-10">
        <div className="flex flex-col sm:flex-row gap-5 sm:gap-7 items-start sm:items-end">
          {/* Overlapping 2:3 Poster on tablet/desktop */}
          <div className="hidden sm:block w-36 md:w-44 lg:w-48 shrink-0 rounded-xl overflow-hidden shadow-2xl border border-[var(--border)] bg-[var(--surface)]">
            <MediaImage
              src={title.posterPath}
              alt={primary}
              aspect="poster"
              mediaType={title.mediaType}
              priority
            />
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            {/* Status & Rewatch / New Episode Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--foreground)]">
                {state.label}
              </span>
              {state.hasNewEpisodes && (
                <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-[var(--accent)] text-[var(--accent-foreground)]">
                  {zh.detail.newEpisodeBadge}
                </span>
              )}
              {state.isRewatching && (
                <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {state.playthroughNumber === 2
                    ? zh.status.rewatchingBadge
                    : zh.status.nthPlaythroughBadge(state.playthroughNumber)}
                </span>
              )}
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[var(--foreground)] leading-tight">
                {primary}
              </h1>
              {secondary && (
                <p className="mt-1 text-sm sm:text-base text-[var(--muted)] font-medium">
                  {secondary}
                </p>
              )}
            </div>

            {/* Single Meta Line: year · type · runtime/seasons · up to 2 genres */}
            <p className="text-xs sm:text-sm text-[var(--muted)] tabular-nums">
              {metaParts.join(' · ')}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
