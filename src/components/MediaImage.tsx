import React, { useState } from 'react';
import { Film, Tv } from 'lucide-react';

interface MediaImageProps {
  src: string | null | undefined;
  alt: string;
  aspect?: 'poster' | 'backdrop' | 'still';
  mediaType?: 'movie' | 'tv' | 'other';
  className?: string;
  priority?: boolean;
}

export const MediaImage: React.FC<MediaImageProps> = ({
  src,
  alt,
  aspect = 'poster',
  mediaType = 'movie',
  className = '',
  priority = false,
}) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const aspectClass =
    aspect === 'poster'
      ? 'aspect-[2/3]'
      : aspect === 'backdrop'
        ? 'aspect-video'
        : 'aspect-video';

  if (!src || failed) {
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-[var(--surface-tertiary)] via-[var(--surface-secondary)] to-[var(--surface)] flex flex-col items-center justify-center p-3 text-center select-none ${aspectClass} ${className}`}
        role="img"
        aria-label={alt}
      >
        <div className="w-9 h-9 rounded-full bg-[var(--surface)]/60 flex items-center justify-center text-[var(--muted)] mb-2">
          {mediaType === 'tv' ? <Tv className="w-4 h-4" /> : <Film className="w-4 h-4" />}
        </div>
        <span className="text-xs font-medium text-[var(--foreground-secondary)] line-clamp-2 px-1 leading-snug">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-[var(--surface)] ${aspectClass} ${className}`}
    >
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          loaded ? 'opacity-100' : 'opacity-90'
        }`}
      />
    </div>
  );
};
