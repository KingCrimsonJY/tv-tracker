import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** React Router gives the first history entry of a tab the key "default"; there is nothing to go back to. */
export function hasInAppHistory(locationKey: string): boolean {
  return locationKey !== 'default';
}

/** Go back within the app, or to `fallback` when the page was opened directly (deep link, PWA launch). */
export function useBackNavigation(fallback: string): () => void {
  const navigate = useNavigate();
  const { key } = useLocation();
  return useCallback(() => {
    if (hasInAppHistory(key)) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [fallback, key, navigate]);
}
