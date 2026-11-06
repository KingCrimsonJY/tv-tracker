import React from 'react';
import { Button, Chip } from '@heroui/react';
import { ArrowLeft, Film } from 'lucide-react';
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
  const { t } = useI18n();
  const backdropSrc = title.backdropPath || title.posterPath;
  const isCustomOrLink = title.source !== 'tmdb';

  return (
    <div className="relative">
      <div className="relative h-[clamp(260px,55vh,520px)] w-full overflow-hidden bg-default-100 pointer-events-none select-none">
        {backdropSrc ? (
          isCustomOrLink ? (
            <>
              <img
                src={backdropSrc}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover scale-110 blur-2xl opacity-50"
              />
              <div className="absolute inset-0 flex items-center justify-center p-6 pb-16 sm:hidden">
                <img
                  src={backdropSrc}
                  alt={displayTitle}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-lg"
                />
              </div>
            </>
          ) : (
            <img
              src={backdropSrc}
              alt={displayTitle}
              className="w-full h-full object-cover"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-default-300">
            <Film className="w-16 h-16 opacity-30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
      </div>

      <div className="absolute top-4 left-4 sm:left-6 z-20">
        <Button variant="secondary" size="sm" onPress={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t.app.back}
        </Button>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 sm:-mt-32">
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-end">
          <div
            className={`hidden sm:block rounded-xl overflow-hidden shadow-2xl border border-[var(--border)] bg-default-100 shrink-0 ${
              isCustomOrLink ? 'w-44 md:w-52 max-h-64' : 'w-36 md:w-44 aspect-[2/3]'
            }`}
          >
            {title.posterPath ? (
              <img
                src={title.posterPath}
                alt={displayTitle}
                className={`w-full h-full ${isCustomOrLink ? 'object-contain bg-black/40' : 'object-cover'}`}
              />
            ) : (
              <div className="w-full h-48 flex items-center justify-center text-[var(--muted)]">
                <Film className="w-10 h-10" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Chip
                size="sm"
                variant="soft"
                color={
                  titleState.status === 'completed' || titleState.status === 'caught_up'
                    ? 'success'
                    : titleState.status === 'watching'
                    ? 'accent'
                    : 'default'
                }
              >
                {t.status[titleState.status]}
              </Chip>
              {titleState.hasNewEpisodes && (
                <Chip size="sm" color="accent" variant="primary">
                  {t.detail.newEpisodeBadge}
                </Chip>
              )}
              {titleState.isRewatching && (
                <Chip size="sm" color="warning" variant="soft">
                  {titleState.playthroughNumber > 2
                    ? t.status.nthPlaythroughBadge(titleState.playthroughNumber)
                    : t.status.rewatchingBadge}
                </Chip>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[var(--foreground)]">
              {displayTitle}
            </h1>
            {showOriginalSub && (
              <div className="text-sm text-[var(--muted)]">{title.names.original}</div>
            )}
            <div className="text-xs sm:text-sm text-[var(--muted)]">
              {metaParts.join(' · ')}
            </div>
          </div>
        </div>

        {children && (
          <div className="mt-5 space-y-4">
            {children}
          </div>
        )}
      </div>
    </div>
  );
};
