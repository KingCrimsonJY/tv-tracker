import type { AppSettingsDoc } from './types.ts';

export const DEFAULT_APP_SETTINGS: AppSettingsDoc = {
  uiLang: 'system',
  defaultTitleLang: 'auto',
  includeSpecials: false,
  homeSections: [
    { id: 'continue_watching', enabled: true },
    { id: 'new_episodes', enabled: true },
    { id: 'pinned_lists', enabled: true },
    { id: 'recently_added', enabled: false },
    { id: 'watchlist', enabled: false },
  ],
  theme: 'dark',
};
