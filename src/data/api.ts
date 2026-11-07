import type {
  AppSettingsDoc,
  AppStateSnapshot,
  LinkImportResult,
  ListEntryDoc,
  PlaylistRefreshResult,
  ProgressDoc,
  Ratings,
  SeasonDoc,
  StateMutationResult,
  SystemInfoResponse,
  TitleAtomicActionInput,
  TitleDoc,
  TmdbSearchItem,
  WatchListDoc,
} from '../domain/types.ts';

export type { LinkImportResult, SystemInfoResponse, TmdbSearchItem };
export type TmdbSearchHit = TmdbSearchItem;

const IFRAME_TOKEN_STORAGE_KEY = 'zhenji_iframe_session_token';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly field?: string;

  constructor(status: number, message: string, code?: string, field?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function getIframeBearerToken(): string | null {
  if (!isRunningInIframe()) return null;
  try {
    return (
      window.sessionStorage.getItem(IFRAME_TOKEN_STORAGE_KEY) || window.localStorage.getItem(IFRAME_TOKEN_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function setIframeBearerToken(token: string | null | undefined): void {
  if (!isRunningInIframe()) return;
  try {
    if (token) {
      window.sessionStorage.setItem(IFRAME_TOKEN_STORAGE_KEY, token);
      window.localStorage.setItem(IFRAME_TOKEN_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(IFRAME_TOKEN_STORAGE_KEY);
      window.localStorage.removeItem(IFRAME_TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage access errors
  }
}

export function clearIframeBearerToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(IFRAME_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(IFRAME_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const bearer = getIframeBearerToken();
  if (bearer && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${bearer}`);
  }
  return fetch(input, {
    ...init,
    credentials: 'same-origin',
    headers,
  });
}

async function apiJson<T>(input: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await apiFetch(input, { ...init, headers });
  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    let message = `Request failed (HTTP ${res.status})`;
    let code: string | undefined;
    let field: string | undefined;
    if (isJson) {
      try {
        const body = (await res.json()) as {
          code?: string;
          message?: string;
          error?: string;
          field?: string;
        };
        if (body.code) code = body.code;
        if (body.field) field = body.field;
        if (body.message) message = body.message;
        else if (body.error) message = body.error;
      } catch {
        // ignore parse error
      }
    }
    throw new ApiError(res.status, message, code, field);
  }

  if (!isJson) {
    throw new ApiError(res.status, 'Invalid JSON response', 'INTERNAL_ERROR');
  }

  return (await res.json()) as T;
}

export async function fetchAuthStatus(): Promise<{
  needsSetup: boolean;
  authenticated: boolean;
}> {
  return apiJson('/api/auth/status');
}

export async function setupPasswordApi(password: string, setupCode: string): Promise<void> {
  const res = await apiJson<{ ok: boolean; token?: string }>('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify({ password, setupCode }),
  });
  if (res.token) {
    setIframeBearerToken(res.token);
  }
}

export async function loginPasswordApi(password: string): Promise<void> {
  const res = await apiJson<{ ok: boolean; token?: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
  if (res.token) {
    setIframeBearerToken(res.token);
  }
}

export async function logoutApi(): Promise<void> {
  try {
    await apiJson('/api/auth/logout', { method: 'POST' });
  } finally {
    clearIframeBearerToken();
  }
}

export async function logoutAllApi(): Promise<void> {
  try {
    await apiJson('/api/auth/logout-all', { method: 'POST' });
  } finally {
    clearIframeBearerToken();
  }
}

export async function fetchStateSnapshot(): Promise<AppStateSnapshot> {
  return apiJson<AppStateSnapshot>('/api/state');
}

export async function putTitleApi(
  id: string,
  payload: {
    title: TitleDoc;
    seasons?: SeasonDoc[];
    progress?: Record<string, ProgressDoc>;
  },
): Promise<StateMutationResult> {
  return apiJson<StateMutationResult>(`/api/titles/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function patchTitleApi(id: string, patch: Partial<Omit<TitleDoc, 'id'>>): Promise<StateMutationResult> {
  return apiJson<StateMutationResult>(`/api/titles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function postTitleActionApi(id: string, payload: TitleAtomicActionInput): Promise<StateMutationResult> {
  return apiJson<StateMutationResult>(`/api/titles/${encodeURIComponent(id)}/actions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteTitleApi(id: string): Promise<StateMutationResult> {
  return apiJson<StateMutationResult>(`/api/titles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function putSeasonsApi(titleId: string, seasons: SeasonDoc[]): Promise<StateMutationResult> {
  return apiJson<StateMutationResult>(`/api/titles/${encodeURIComponent(titleId)}/seasons`, {
    method: 'PUT',
    body: JSON.stringify({ seasons }),
  });
}

export async function putProgressApi(
  titleId: string,
  playthroughId: string,
  payload: { watched: Record<string, number>; movieWatchedAt?: number },
): Promise<StateMutationResult> {
  return apiJson<StateMutationResult>(
    `/api/titles/${encodeURIComponent(titleId)}/progress/${encodeURIComponent(playthroughId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}

export async function patchProgressApi(
  titleId: string,
  playthroughId: string,
  patch: {
    set?: Record<string, number>;
    unset?: string[];
    movieWatchedAt?: number | null;
  },
): Promise<StateMutationResult> {
  return apiJson<StateMutationResult>(
    `/api/titles/${encodeURIComponent(titleId)}/progress/${encodeURIComponent(playthroughId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  );
}

export async function deleteProgressApi(titleId: string, playthroughId: string): Promise<StateMutationResult> {
  return apiJson<StateMutationResult>(
    `/api/titles/${encodeURIComponent(titleId)}/progress/${encodeURIComponent(playthroughId)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function putListApi(listId: string, payload: Omit<WatchListDoc, 'id'>): Promise<StateMutationResult> {
  return apiJson<StateMutationResult>(`/api/lists/${encodeURIComponent(listId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function patchListApi(
  listId: string,
  patch: Partial<Omit<WatchListDoc, 'id'>>,
): Promise<StateMutationResult> {
  return apiJson<StateMutationResult>(`/api/lists/${encodeURIComponent(listId)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteListApi(listId: string): Promise<StateMutationResult> {
  return apiJson<StateMutationResult>(`/api/lists/${encodeURIComponent(listId)}`, {
    method: 'DELETE',
  });
}

export async function putListEntryApi(
  listId: string,
  entryId: string,
  payload: Omit<ListEntryDoc, 'id'>,
): Promise<StateMutationResult> {
  return apiJson<StateMutationResult>(
    `/api/lists/${encodeURIComponent(listId)}/entries/${encodeURIComponent(entryId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}

export async function patchListEntryApi(
  listId: string,
  entryId: string,
  patch: Partial<Omit<ListEntryDoc, 'id'>>,
): Promise<StateMutationResult> {
  return apiJson<StateMutationResult>(
    `/api/lists/${encodeURIComponent(listId)}/entries/${encodeURIComponent(entryId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  );
}

export async function deleteListEntryApi(listId: string, entryId: string): Promise<StateMutationResult> {
  return apiJson<StateMutationResult>(
    `/api/lists/${encodeURIComponent(listId)}/entries/${encodeURIComponent(entryId)}`,
    {
      method: 'DELETE',
    },
  );
}

export async function patchSettingsApi(patch: Partial<AppSettingsDoc>): Promise<StateMutationResult> {
  return apiJson<StateMutationResult>('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function importDataApi(payload: unknown): Promise<StateMutationResult> {
  return apiJson<StateMutationResult>('/api/import', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function searchTmdbApi(
  query: string,
  lang: 'zh-CN' | 'en-US' = 'zh-CN',
  signal?: AbortSignal,
): Promise<{ configured?: boolean; results: TmdbSearchItem[] }> {
  return apiJson<{ configured?: boolean; results: TmdbSearchItem[] }>(
    `/api/tmdb/search?q=${encodeURIComponent(query)}&lang=${encodeURIComponent(lang)}`,
    { signal },
  );
}

export async function fetchTmdbGenresApi(): Promise<{
  zh: Record<number, string>;
  en: Record<number, string>;
}> {
  return apiJson<{ zh: Record<number, string>; en: Record<number, string> }>('/api/tmdb/genres');
}

export async function fetchTmdbDetailsApi(
  mediaType: 'movie' | 'tv',
  sourceId: string,
): Promise<{ title: TitleDoc; seasons: SeasonDoc[] }> {
  return apiJson<{ title: TitleDoc; seasons: SeasonDoc[] }>(
    `/api/tmdb/${encodeURIComponent(mediaType)}/${encodeURIComponent(sourceId)}`,
  );
}

export async function fetchRatingsApi(params: { imdbId?: string }): Promise<{
  ratings?: Ratings;
}> {
  const query = new URLSearchParams();
  if (params.imdbId) query.set('imdbId', params.imdbId);
  return apiJson(`/api/ratings?${query.toString()}`);
}

export async function importLinkApi(url: string, force?: boolean, signal?: AbortSignal): Promise<LinkImportResult> {
  return apiJson<LinkImportResult>('/api/import/link', {
    signal,
    method: 'POST',
    body: JSON.stringify({ url, ...(force ? { force: true } : {}) }),
  });
}

export async function refreshLinkPlaylistApi(titleId: string): Promise<PlaylistRefreshResult> {
  return apiJson<PlaylistRefreshResult>(`/api/titles/${encodeURIComponent(titleId)}/refresh-link`, {
    method: 'POST',
  });
}

export async function fetchSystemInfoApi(): Promise<SystemInfoResponse> {
  return apiJson<SystemInfoResponse>('/api/system/info');
}

export function refreshMetadataApi(titleId: string): Promise<import('../domain/types.ts').MetadataRefreshResult> {
  return apiJson(`/api/titles/${encodeURIComponent(titleId)}/refresh-metadata`, { method: 'POST' });
}

export function previewStructureApi(titleId: string): Promise<import('../domain/structure.ts').StructurePreview> {
  return apiJson(`/api/titles/${encodeURIComponent(titleId)}/structure`);
}
export function decideStructureApi(
  titleId: string,
  input: { decision: 'keep' | 'adopt'; version: number; signature: string },
): Promise<StateMutationResult> {
  return apiJson(`/api/titles/${encodeURIComponent(titleId)}/structure`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
export function changeTitleSourceApi(
  titleId: string,
  input: { action: 'manual' } | { action: 'relink'; sourceId: string; mediaType: 'movie' | 'tv' },
): Promise<StateMutationResult> {
  return apiJson(`/api/titles/${encodeURIComponent(titleId)}/source`, { method: 'POST', body: JSON.stringify(input) });
}
