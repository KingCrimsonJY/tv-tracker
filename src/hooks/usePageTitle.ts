import { useEffect } from 'react';
import { useI18n } from '../i18n';

/**
 * Name the browser tab after the current screen ("Library · Zhenji"), so tabs, history entries and screen
 * readers can tell the screens apart. Without a name, or after leaving, the title is the app name alone.
 */
export function usePageTitle(name?: string | null): void {
  const { t } = useI18n();
  const appName = t.app.name;
  useEffect(() => {
    document.title = name ? `${name} · ${appName}` : appName;
    return () => {
      document.title = appName;
    };
  }, [name, appName]);
}
