import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * A text input value mirrored into a URL search parameter (so Back and refresh keep it).
 *
 * The input must own its value. React Router applies navigations as transitions, so an input whose value is
 * read back from the URL lags a render behind; during IME composition that resets the field and commits the
 * intermediate pinyin before the chosen characters.
 */
export function useSearchQueryParam(name: string): [string, (value: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const [value, setValue] = useState(() => searchParams.get(name) ?? '');

  useEffect(() => {
    if ((searchParams.get(name) ?? '') === value) return;
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(name, value);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );
  }, [name, value, searchParams, setSearchParams]);

  return [value, setValue];
}
