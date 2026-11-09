import { responsiveImage } from '../domain/images';
import React, { useState } from 'react';
import { Film, Tv } from 'lucide-react';

interface MediaImageProps {
  src: string | null | undefined;
  alt: string;
  aspect?: 'poster' | 'backdrop' | 'still';
  mediaType?: 'movie' | 'tv' | 'other';
  className?: string;
  priority?: boolean;
  compact?: boolean;
}

export const MediaImage: React.FC<MediaImageProps> = ({
  src,
  alt,
  aspect = 'poster',
  mediaType = 'movie',
  className = '',
  priority = false,
  compact = false,
}) => {
  const [imageState, setImageState] = useState<{ src: typeof src; status: 'loaded' | 'failed' } | null>(null);
  // A failed old URL must not suppress a replacement image after metadata refresh.
  const failed = imageState?.src === src && imageState?.status === 'failed';
  const loaded = imageState?.src === src && imageState?.status === 'loaded';

  const aspectClass = aspect === 'poster' ? 'aspect-[2/3]' : aspect === 'backdrop' ? 'aspect-video' : 'aspect-video';

  if (!src || failed) {
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-surface-tertiary via-surface-secondary to-surface flex flex-col items-center justify-center ${
          compact ? 'p-1' : 'p-3'
        } text-center select-none ${aspectClass} ${className}`}
        role="img"
        aria-label={alt}
      >
        <div
          className={`${
            compact ? 'w-5 h-5 mb-0.5' : 'w-9 h-9 mb-2'
          } rounded-full bg-surface/60 flex items-center justify-center text-muted shrink-0`}
        >
          {mediaType === 'tv' ? (
            <Tv className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
          ) : (
            <Film className={compact ? 'w-3 h-3' : 'w-4 h-4'} />
          )}
        </div>
        <span
          className={`${
            compact ? 'text-[10px] leading-tight' : 'text-xs leading-snug'
          } font-medium text-foreground-secondary line-clamp-2 px-0.5 break-words`}
        >
          {alt}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden bg-surface ${aspectClass} ${className}`}>
      <img
        {...responsiveImage(src, aspect)}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        referrerPolicy="no-referrer"
        onLoad={() => setImageState({ src, status: 'loaded' })}
        onError={() => setImageState({ src, status: 'failed' })}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          loaded ? 'opacity-100' : 'opacity-90'
        }`}
      />
    </div>
  );
};
