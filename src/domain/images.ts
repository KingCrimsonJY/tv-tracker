const tmdbUrl = /^https?:\/\/image\.tmdb\.org\/t\/p\/[^/]+(\/[^/?#]+)$/;
export function tmdbFilePath(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.match(tmdbUrl)?.[1] || value;
}
/** What a poster field may hold: nothing, an http(s) address, or a TMDB file path such as `/abc.jpg`. */
export function isImageReference(value: string): boolean {
  const text = value.trim();
  if (!text || /^\/[^/\s?#]+\.(?:jpg|jpeg|png|webp)$/i.test(text)) return true;
  try {
    return ['http:', 'https:'].includes(new URL(text).protocol);
  } catch {
    return false;
  }
}

/** Normalize image fields in titles, seasons, archived marks and legacy backup payloads. */
export function normalizeTmdbImages<T>(value: T): T {
  if (Array.isArray(value)) return value.map(normalizeTmdbImages) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        ['posterPath', 'backdropPath', 'stillPath'].includes(key) && typeof entry === 'string'
          ? tmdbFilePath(entry)
          : key === 'posters' && entry && typeof entry === 'object'
            ? Object.fromEntries(
                Object.entries(entry).map(([locale, image]) => [
                  locale,
                  typeof image === 'string' ? tmdbFilePath(image) : image,
                ]),
              )
            : normalizeTmdbImages(entry),
      ]),
    ) as T;
  }
  return value;
}
export function responsiveImage(src: string | null | undefined, kind: 'poster' | 'backdrop' | 'still' = 'poster') {
  const path = tmdbFilePath(src);
  if (!path || !/^\/[^/]+\.(?:jpg|jpeg|png|webp)$/i.test(path)) return { src: src || undefined };
  const widths = kind === 'poster' ? [154, 185, 342, 500, 780] : kind === 'backdrop' ? [300, 780, 1280] : [185, 300];
  const url = (width: number) => 'https://image.tmdb.org/t/p/w' + width + path;
  return {
    src: url(kind === 'poster' ? 342 : kind === 'backdrop' ? 780 : 300),
    srcSet: widths.map((width) => url(width) + ' ' + width + 'w').join(', '),
    sizes:
      kind === 'poster'
        ? '(max-width: 479px) 44vw, (max-width: 767px) 29vw, (max-width: 1023px) 20vw, 180px'
        : kind === 'backdrop'
          ? '(max-width: 1023px) 100vw, calc(100vw - 240px)'
          : '112px',
  };
}
