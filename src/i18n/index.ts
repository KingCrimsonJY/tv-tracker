import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { trackerStore } from '../data/store.ts';
import type { TimeParseErrorCode } from '../domain/time.ts';
import type { UiLangSetting, UiLocale } from '../domain/types.ts';
import { en } from './messages/en.ts';
import { type MessageCatalog, zhCN } from './messages/zh-CN.ts';

export { en, type MessageCatalog, zhCN };

export const RESOLVED_LOCALE_STORAGE_KEY = 'zhenji_resolved_locale';

export function detectSystemLocale(rawLang?: string): UiLocale {
  const lang =
    rawLang ??
    (typeof navigator !== 'undefined' ? navigator.language || 'zh-CN' : 'zh-CN');
  return lang.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

export function resolveUiLocale(
  uiLang: UiLangSetting | undefined,
  systemLang?: string
): UiLocale {
  if (uiLang === 'zh-CN' || uiLang === 'en') {
    return uiLang;
  }
  return detectSystemLocale(systemLang);
}

export const resolveActiveLocale = resolveUiLocale;

export function getCachedResolvedLocale(): UiLocale | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(RESOLVED_LOCALE_STORAGE_KEY);
    if (saved === 'zh-CN' || saved === 'en') {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

export function applyResolvedLocaleToDom(locale: UiLocale): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(RESOLVED_LOCALE_STORAGE_KEY, locale);
    } catch {
      // Ignore storage write errors
    }
  }
}

export function getActiveLocaleFromStore(): UiLocale {
  const uiLang = trackerStore.getState().settings?.uiLang;
  if (uiLang === 'zh-CN' || uiLang === 'en') {
    return uiLang;
  }
  const cached = getCachedResolvedLocale();
  if (cached && (!uiLang || uiLang === 'system')) {
    return detectSystemLocale();
  }
  return resolveUiLocale(uiLang);
}

export function getActiveCatalog(locale?: UiLocale): MessageCatalog {
  const resolved = locale ?? getActiveLocaleFromStore();
  return resolved === 'en' ? en : zhCN;
}

export function translateErrorByCode(
  code: string | undefined,
  catalog: MessageCatalog,
  options?: { field?: string; status?: number; fallback?: string }
): string {
  if (code === 'VALIDATION_ERROR' && options?.field) {
    return catalog.errors.VALIDATION_FIELD(options.field);
  }
  if (code && Object.prototype.hasOwnProperty.call(catalog.errors, code)) {
    const entry = catalog.errors[code as keyof MessageCatalog['errors']];
    if (typeof entry === 'string') {
      return entry;
    }
  }
  if (options?.status) {
    return catalog.errors.HTTP_ERROR(options.status);
  }
  return options?.fallback || catalog.app.errorGeneric;
}

export function translateErrorObject(
  err: unknown,
  catalog: MessageCatalog,
  fallback?: string
): string {
  if (err && typeof err === 'object') {
    const maybeCode = (err as { code?: unknown }).code;
    const maybeField = (err as { field?: unknown }).field;
    const maybeStatus = (err as { status?: unknown }).status;
    if (typeof maybeCode === 'string' && maybeCode.length > 0) {
      return translateErrorByCode(maybeCode, catalog, {
        field: typeof maybeField === 'string' ? maybeField : undefined,
        status: typeof maybeStatus === 'number' ? maybeStatus : undefined,
        fallback,
      });
    }
    if (typeof maybeStatus === 'number') {
      return catalog.errors.HTTP_ERROR(maybeStatus);
    }
  }
  return fallback || catalog.app.errorGeneric;
}

export function translateTimeParseError(
  err: { code: TimeParseErrorCode; maxMinutes?: number },
  catalog: MessageCatalog
): string {
  if (err.code === 'EXCEEDS_RUNTIME') {
    return catalog.timeErrors.EXCEEDS_RUNTIME(err.maxMinutes ?? 0);
  }
  return catalog.timeErrors[err.code];
}

export function useI18n() {
  const uiLang = useSyncExternalStore(
    trackerStore.subscribe,
    () => trackerStore.getState().settings.uiLang ?? 'system',
    () => 'system' as UiLangSetting
  );

  const locale: UiLocale = useMemo(() => {
    if (uiLang === 'zh-CN' || uiLang === 'en') return uiLang;
    const cached = getCachedResolvedLocale();
    if (cached && typeof navigator === 'undefined') return cached;
    return resolveUiLocale(uiLang);
  }, [uiLang]);

  const t: MessageCatalog = locale === 'en' ? en : zhCN;

  const formatDate = useCallback(
    (
      value: number | string | Date,
      options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }
    ): string => {
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return String(value);
      return new Intl.DateTimeFormat(locale, options).format(date);
    },
    [locale]
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions): string => {
      return new Intl.NumberFormat(locale, options).format(value);
    },
    [locale]
  );

  const formatPlural = useCallback(
    (
      count: number,
      forms: { zero?: string; one: string; other: string }
    ): string => {
      if (count === 0 && forms.zero !== undefined) {
        return forms.zero;
      }
      const rule = new Intl.PluralRules(locale).select(count);
      const template = rule === 'one' ? forms.one : forms.other;
      return template.replace('{count}', formatNumber(count));
    },
    [locale, formatNumber]
  );

  const translateError = useCallback(
    (err: unknown, fallback?: string): string =>
      translateErrorObject(err, t, fallback),
    [t]
  );

  const translateTimeError = useCallback(
    (err: { code: TimeParseErrorCode; maxMinutes?: number }): string =>
      translateTimeParseError(err, t),
    [t]
  );

  return {
    locale,
    uiLang,
    t,
    formatDate,
    formatNumber,
    formatPlural,
    translateError,
    translateTimeError,
  };
}
