import React from 'react';
import { Button, Chip } from '@heroui/react';
import { ArrowLeft } from 'lucide-react';
import { MediaImage } from '../../components/MediaImage';
import { pickBackdrop, pickPoster } from '../../domain/progress';
import { TitleDoc } from '../../domain/types';
import { ComputedTitleState } from '../../domain/status';
import { useI18n } from '../../i18n';

interface TitleHeroProps {
  title: TitleDoc;
  titleState: ComputedTitleState;
  displayTitle: string;
  showOriginalSub: boolean;
  metaParts: string[];
  onBack: () => void;
  children?: React.ReactNode;
}

export const TitleHero: React.FC<TitleHeroProps> = ({
  title,
  titleState,
  displayTitle,
  showOriginalSub,
  metaParts,
  onBack,
  children,
}) => {
  const { t, locale } = useI18n();
  const posterUrl = pickPoster(title, locale);
  const backdropUrl = pickBackdrop(title, locale);

  return (
    <div className="relative w-full overflow-hidden">
      {/* Backdrop Image Layer with pixel-clamped height */}
      <div className="relative w-full h-[clamp(240px,42vh,440px)] bg-surface-secondary overflow-hidden">
        {backdropUrl ? (
          <img
            src={backdropUrl}
            alt=""
            className="w-full h-full object-cover object-top"
            loading="eager"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface-tertiary via-surface-secondary to-surface" />
        )}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, var(--background) 0%, color-mix(in oklab, var(--background) 85%, transparent) 35%, color-mix(in oklab, var(--background) 35%, transparent) 100%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--background)]/75 via-transparent to-transparent pointer-events-none" />

        {/* Back button */}
        <div className="absolute top-3 left-3 sm:top-5 sm:left-6 z-20">
          <Button
            variant="secondary"
            size="sm"
            isIconOnly
            aria-label={t.app.back}
            onPress={onBack}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Single positioned content layer above the hero */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-28 sm:-mt-32 pb-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-6">
          <div
            className={`${
              posterUrl ? 'hidden sm:block' : 'block'
            } w-24 sm:w-28 md:w-36 aspect-[2/3] rounded-xl overflow-hidden shadow-xl border border-border shrink-0 bg-surface-secondary`}
          >
            <MediaImage
              src={posterUrl}
              alt={displayTitle}
              aspect="poster"
              mediaType={title.mediaType}
              className="w-full h-full"
              priority
            />
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {titleState.isRewatching && title.manualState === null ? (
                <Chip size="sm" color="accent" variant="soft">
                  {titleState.activePlaythroughNumber === 2
                    ? t.status.rewatchingBadge
                    : t.status.nthPlaythroughBadge(titleState.activePlaythroughNumber)}
                </Chip>
              ) : (
                <Chip
                  size="sm"
                  variant="soft"
                  color={
                    titleState.status === 'completed' || titleState.status === 'caught_up'
                      ? 'success'
                      : titleState.status === 'watching'
                        ? 'accent'
                        : titleState.status === 'paused' || titleState.status === 'dropped'
                          ? 'warning'
                          : 'default'
                  }
                >
                  {t.status[titleState.status]}
                </Chip>
              )}

              {titleState.hasNewEpisodes && (
                <Chip size="sm" color="accent" variant="primary">
                  {t.status.newEpisodesBadge}
                </Chip>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-tight">
              {displayTitle}
            </h1>

            {showOriginalSub && (
              <p className="text-xs sm:text-sm text-muted truncate">{title.names.original}</p>
            )}

            <p className="text-xs sm:text-sm text-muted">{metaParts.join(' · ')}</p>
          </div>
        </div>

        {children && <div className="mt-4 space-y-3">{children}</div>}
      </div>
    </div>
  );
};
