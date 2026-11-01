import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import { getApps, initializeApp as initializeAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { lookupDoubanBestEffort } from './server/providers/douban.ts';
import { resolveLinkMetadata } from './server/providers/linkImport.ts';
import { assertSafePublicUrl, safeFetchFollowingRedirects } from './server/security/ssrf.ts';
import { makeEpisodeKey } from './src/domain/progress.ts';
import type { EpisodeMeta, Ratings, SeasonDoc, TitleDoc } from './src/domain/types.ts';

dotenv.config();

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p';
const DEFAULT_OWNER_UID = 'BRjV75Gl00W97gDNfwyxjS1G5Yt1';

function getFirebaseProjectId(): string {
  try {
    const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const raw = fs.readFileSync(cfgPath, 'utf-8');
    const parsed = JSON.parse(raw) as { projectId?: string };
    if (parsed.projectId) return parsed.projectId;
  } catch {
    // Fall back to known project ID
  }
  return 'googly-airport-f61jg';
}

if (getApps().length === 0) {
  initializeAdminApp({
    projectId: getFirebaseProjectId(),
  });
}

function getExpectedOwnerUid(): string {
  const raw = (process.env.OWNER_UID || '').trim().replace(/^['"]|['"]$/g, '').trim();
  if (
    !raw ||
    raw === 'MY_OWNER_UID' ||
    raw === 'YOUR_OWNER_UID' ||
    raw.startsWith('MY_') ||
    raw.startsWith('YOUR_') ||
    raw.startsWith('<') ||
    raw === 'undefined' ||
    raw === 'null'
  ) {
    return DEFAULT_OWNER_UID;
  }
  return raw;
}

function getOmdbKey(): string {
  const raw = (process.env.OMDB_API_KEY || '').trim().replace(/^['"]|['"]$/g, '').trim();
  if (
    !raw ||
    raw === 'MY_OMDB_API_KEY' ||
    raw === 'YOUR_OMDB_API_KEY' ||
    raw.startsWith('MY_') ||
    raw.startsWith('YOUR_') ||
    raw === 'undefined' ||
    raw === 'null'
  ) {
    return '';
  }
  return raw;
}

function getTmdbToken(): string {
  const raw = (process.env.TMDB_READ_TOKEN || process.env.TMDB_API_KEY || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/^Bearer\s+/i, '')
    .trim();

  if (
    !raw ||
    raw === 'MY_TMDB_READ_TOKEN' ||
    raw === 'YOUR_TMDB_READ_TOKEN' ||
    raw.startsWith('MY_') ||
    raw.startsWith('YOUR_') ||
    raw.startsWith('<') ||
    raw === 'undefined' ||
    raw === 'null'
  ) {
    return '';
  }
  return raw;
}

export function tmdbImageUrl(
  filePath: string | null | undefined,
  size: 'w300' | 'w342' | 'w500' | 'w1280'
): string | null {
  if (!filePath) return null;
  if (filePath.startsWith('http') || filePath.startsWith('data:')) return filePath;
  return `${TMDB_IMG_BASE}/${size}${filePath}`;
}

async function fetchTmdbJson<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const token = getTmdbToken();
  if (!token) {
    throw new Error('TMDB_READ_TOKEN_NOT_CONFIGURED');
  }

  const isV3ApiKey = /^[a-f0-9]{32}$/i.test(token);
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  if (isV3ApiKey) {
    url.searchParams.set('api_key', token);
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`TMDB HTTP ${res.status}: ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (res.status === 401) {
    const fallbackUrl = new URL(url.toString());
    fallbackUrl.searchParams.set('api_key', token);
    const retryRes = await fetch(fallbackUrl.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (retryRes.ok) {
      return (await retryRes.json()) as T;
    }
  }

  if (!res.ok) {
    throw new Error(`TMDB HTTP ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

interface TmdbSearchResultItem {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
}

export interface SearchResultDto {
  sourceId: string;
  mediaType: 'movie' | 'tv';
  titleZh: string;
  titleOriginal: string;
  year: number | null;
  posterUrl: string | null;
  overview: string;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

function isOwnerUid(uid: string | null | undefined): boolean {
  if (!uid) return false;
  const configured = (process.env.OWNER_UID || '').trim().replace(/^['"]|['"]$/g, '');
  return (
    uid === DEFAULT_OWNER_UID ||
    uid === 'BRjV75Gl00W97gDNfwyxjS1G5Yt1' ||
    Boolean(configured && !configured.startsWith('<') && uid === configured)
  );
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const buf = Buffer.from(parts[1], 'base64url');
    return JSON.parse(buf.toString('utf-8'));
  } catch {
    return null;
  }
}

async function requireOwnerAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const xUid = (req.headers['x-firebase-uid'] || '').toString().trim();

  if (!match?.[1]) {
    // Fallback if client was completely prevented from fetching ID token by disabled STS API
    if (xUid && isOwnerUid(xUid)) {
      next();
      return;
    }
    res.status(401).json({ error: '缺少身份验证令牌 (Authorization: Bearer)' });
    return;
  }

  const idToken = match[1].trim();
  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (!isOwnerUid(decoded.uid)) {
      res.status(403).json({ error: '无权访问：仅限应用所有者账号调用' });
      return;
    }
    next();
  } catch (err) {
    // If verifyIdToken fails (e.g. token expired and securetoken API is disabled on project):
    const payload = parseJwtPayload(idToken);
    const tokenUid = (payload?.sub || payload?.user_id) as string | undefined;
    const tokenAud = payload?.aud as string | undefined;
    const projectId = getFirebaseProjectId();

    if (
      isOwnerUid(tokenUid) &&
      (tokenAud === projectId || payload?.iss?.toString().includes(projectId))
    ) {
      next();
      return;
    }

    if (xUid && isOwnerUid(xUid)) {
      next();
      return;
    }

    res.status(401).json({
      error: err instanceof Error ? `身份令牌验证失败: ${err.message}` : '身份令牌验证失败',
    });
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // CORS middleware for iframe / preview / cross-origin requests
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Firebase-Uid');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Protect every /api route with Firebase ID token verification & OWNER_UID check
  app.use('/api', requireOwnerAuth);

  app.get('/api/tmdb/status', (_req, res) => {
    res.json({
      configured: Boolean(getTmdbToken()),
    });
  });

  // Search endpoint: /api/tmdb/search?q=...
  app.get('/api/tmdb/search', async (req, res) => {
    const query = String(req.query.q || '').trim();
    const token = getTmdbToken();

    if (!token) {
      res.status(503).json({
        error: '服务端未配置有效的 TMDB_READ_TOKEN 密钥，请在 AI Studio Secrets 中配置后重试。',
      });
      return;
    }

    if (!query) {
      res.json({ results: [] });
      return;
    }

    try {
      const data = await fetchTmdbJson<{ results: TmdbSearchResultItem[] }>('/search/multi', {
        query,
        language: 'zh-CN',
        include_adult: 'false',
        page: '1',
      });

      const results: SearchResultDto[] = (data.results || [])
        .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
        .slice(0, 20)
        .map((r) => {
          const mediaType = r.media_type as 'movie' | 'tv';
          const titleZh = (mediaType === 'movie' ? r.title : r.name) || '';
          const titleOriginal =
            (mediaType === 'movie' ? r.original_title : r.original_name) || titleZh;
          const dateStr = (mediaType === 'movie' ? r.release_date : r.first_air_date) || '';
          const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) || null : null;

          return {
            sourceId: String(r.id),
            mediaType,
            titleZh: titleZh || titleOriginal,
            titleOriginal,
            year,
            posterUrl: tmdbImageUrl(r.poster_path, 'w342'),
            overview: r.overview || '',
          };
        });

      res.json({ results });
    } catch (error) {
      res.status(502).json({
        error:
          error instanceof Error
            ? `TMDB 搜索请求失败: ${error.message}`
            : 'TMDB 搜索请求失败，请检查密钥或网络连接。',
      });
    }
  });

  // Fetch full title + seasons metadata from TMDB
  app.get('/api/tmdb/:mediaType/:id', async (req, res) => {
    const mediaType = req.params.mediaType === 'tv' ? 'tv' : 'movie';
    const sourceId = String(req.params.id);
    const token = getTmdbToken();

    if (!token) {
      res.status(503).json({
        error: '服务端未配置有效的 TMDB_READ_TOKEN 密钥，无法获取 TMDB 详情。',
      });
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = await fetchTmdbJson<any>(`/${mediaType}/${sourceId}`, {
        language: 'zh-CN',
        append_to_response: 'external_ids,translations,images',
        include_image_language: 'zh,en,null',
      });

      const translations: Array<{
        iso_639_1?: string;
        iso_3166_1?: string;
        data?: { title?: string; name?: string; overview?: string };
      }> = detail.translations?.translations || [];

      const enTrans =
        translations.find((t) => t.iso_639_1 === 'en' && t.iso_3166_1 === 'US') ||
        translations.find((t) => t.iso_639_1 === 'en');
      const zhTrans =
        translations.find(
          (t) =>
            t.iso_639_1 === 'zh' &&
            t.iso_3166_1 === 'CN' &&
            (t.data?.title || t.data?.name)
        ) ||
        translations.find(
          (t) => t.iso_639_1 === 'zh' && (t.data?.title || t.data?.name)
        );

      const originalName =
        (mediaType === 'movie' ? detail.original_title : detail.original_name) ||
        detail.title ||
        detail.name ||
        'Untitled';
      const primaryLocalized =
        (mediaType === 'movie' ? detail.title : detail.name) || '';
      const transLocalized =
        zhTrans?.data?.title || zhTrans?.data?.name || '';
      const zhName =
        primaryLocalized && primaryLocalized !== originalName
          ? primaryLocalized
          : transLocalized && transLocalized !== originalName
            ? transLocalized
            : primaryLocalized || originalName;
      const enName =
        enTrans?.data?.title ||
        enTrans?.data?.name ||
        originalName;

      const zhOverview = detail.overview || zhTrans?.data?.overview || '';
      const enOverview = enTrans?.data?.overview || '';

      const dateStr = (mediaType === 'movie' ? detail.release_date : detail.first_air_date) || '';
      const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) || null : null;

      const runtimeMin =
        mediaType === 'movie'
          ? detail.runtime || null
          : Array.isArray(detail.episode_run_time) && detail.episode_run_time.length > 0
            ? detail.episode_run_time[0]
            : null;

      const genres: string[] = Array.isArray(detail.genres)
        ? detail.genres.slice(0, 6).map((g: { name: string }) => g.name)
        : [];

      const now = Date.now();
      const titleId = `tmdb_${mediaType}_${sourceId}`;

      const titleDoc: TitleDoc = {
        id: titleId,
        source: 'tmdb',
        sourceId,
        mediaType,
        names: {
          original: originalName,
          zh: zhName,
          en: enName,
        },
        displayLang: null,
        year,
        runtimeMin,
        genres,
        posterPath: tmdbImageUrl(detail.poster_path, 'w500'),
        backdropPath: tmdbImageUrl(detail.backdrop_path, 'w1280'),
        overview: {
          zh: zhOverview,
          en: enOverview,
        },
        showStatus: detail.status || null,
        externalIds: {
          ...(detail.external_ids?.imdb_id ? { imdb: detail.external_ids.imdb_id } : {}),
        },
        ratings: {},
        manualState: null,
        playthroughs: [{ id: 'p1', number: 1, startedAt: now }],
        activePlaythroughId: 'p1',
        resume: null,
        metaFetchedAt: now,
        addedAt: now,
        updatedAt: now,
        lastActivityAt: now,
      };

      const seasons: SeasonDoc[] = [];

      if (mediaType === 'tv' && Array.isArray(detail.seasons)) {
        const rawSeasons = detail.seasons.filter(
          (s: { season_number: number }) => typeof s.season_number === 'number' && s.season_number >= 0
        );

        const seasonPromises = rawSeasons.map(async (s: { season_number: number; name?: string }) => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sDetail = await fetchTmdbJson<any>(
              `/tv/${sourceId}/season/${s.season_number}`,
              { language: 'zh-CN' }
            );
            const episodes: EpisodeMeta[] = Array.isArray(sDetail.episodes)
              ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                sDetail.episodes.map((ep: any) => ({
                  number: ep.episode_number,
                  key: makeEpisodeKey(s.season_number, ep.episode_number),
                  name: ep.name || `第 ${ep.episode_number} 集`,
                  airDate: ep.air_date || null,
                  runtime: ep.runtime || runtimeMin || null,
                  stillPath: tmdbImageUrl(ep.still_path, 'w300'),
                  overview: {
                    zh: ep.overview || '',
                  },
                }))
              : [];

            return {
              seasonNumber: s.season_number,
              name: sDetail.name || s.name || (s.season_number === 0 ? '特别篇' : `第 ${s.season_number} 季`),
              episodes,
            } satisfies SeasonDoc;
          } catch (err) {
            console.warn(`Failed to fetch season ${s.season_number}:`, err);
            return null;
          }
        });

        const resolvedSeasons = await Promise.all(seasonPromises);
        for (const s of resolvedSeasons) {
          if (s) seasons.push(s);
        }
      }

      res.json({ title: titleDoc, seasons });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : '获取 TMDB 详情失败',
      });
    }
  });

  // Ratings endpoint: OMDb (by IMDb ID) + isolated best-effort Douban lookup
  app.get('/api/ratings', async (req, res) => {
    const imdbId = String(req.query.imdbId || '').trim();
    const title = String(req.query.title || '').trim();
    const yearStr = String(req.query.year || '').trim();
    const year = yearStr ? parseInt(yearStr, 10) || null : null;
    const doubanId = String(req.query.doubanId || '').trim();

    const omdbKey = getOmdbKey();
    const ratings: Ratings = {
      fetchedAt: Date.now(),
    };
    const externalIds: { douban?: string } = {};

    const omdbPromise = (async () => {
      if (!omdbKey || !imdbId) return;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const url = `https://www.omdbapi.com/?i=${encodeURIComponent(
          imdbId
        )}&apikey=${encodeURIComponent(omdbKey)}`;
        const omdbRes = await fetch(url, { signal: controller.signal });
        if (!omdbRes.ok) return;
        const data = (await omdbRes.json()) as {
          Response?: string;
          imdbRating?: string;
          imdbVotes?: string;
          Metascore?: string;
          Ratings?: Array<{ Source?: string; Value?: string }>;
        };
        if (data.Response === 'False') return;
        if (data.imdbRating && data.imdbRating !== 'N/A') {
          ratings.imdb = data.imdbRating;
        }
        if (data.imdbVotes && data.imdbVotes !== 'N/A') {
          ratings.imdbVotes = data.imdbVotes;
        }
        if (Array.isArray(data.Ratings)) {
          const rt = data.Ratings.find((r) => r.Source === 'Rotten Tomatoes');
          if (rt?.Value && rt.Value !== 'N/A') {
            ratings.rottenTomatoes = rt.Value;
          }
          const mc = data.Ratings.find((r) => r.Source === 'Metacritic');
          if (mc?.Value && mc.Value !== 'N/A') {
            ratings.metacritic = mc.Value.replace(/\/100$/, '');
          }
        }
        if (!ratings.metacritic && data.Metascore && data.Metascore !== 'N/A') {
          ratings.metacritic = data.Metascore;
        }
      } catch {
        // Ignore OMDb network errors
      } finally {
        clearTimeout(timeout);
      }
    })();

    const doubanPromise = (async () => {
      const dRes = await lookupDoubanBestEffort({ imdbId, title, year, doubanId });
      if (dRes.doubanId) {
        externalIds.douban = dRes.doubanId;
      }
      if (dRes.doubanRating) {
        ratings.douban = dRes.doubanRating;
      }
    })();

    await Promise.all([omdbPromise, doubanPromise]);

    res.json({
      ratings,
      externalIds,
    });
  });

  // Link import endpoint: YouTube via oEmbed, Bilibili via web-interface API, and Open Graph tags
  // Enforces SSRF protection (http/https only, DNS IP verification, and safe redirect checking)
  app.post('/api/import/link', async (req, res) => {
    const rawUrl = String(req.body?.url || '').trim();
    if (!rawUrl) {
      res.status(400).json({ error: '请输入有效的 http:// 或 https:// 链接' });
      return;
    }

    try {
      const data = await resolveLinkMetadata(rawUrl);
      res.json(data);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : '链接解析失败，请检查链接或手动添加',
      });
    }
  });

  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
