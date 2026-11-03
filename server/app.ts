import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import {
  authPasswordRequestSchema,
  importPayloadSchema,
  patchListEntryRequestSchema,
  patchListRequestSchema,
  patchProgressRequestSchema,
  patchSettingsRequestSchema,
  patchTitleRequestSchema,
  putListEntryRequestSchema,
  putListRequestSchema,
  putProgressRequestSchema,
  putSeasonsRequestSchema,
  putTitleRequestSchema,
} from '../src/domain/schemas.ts';
import type { ProgressDoc, StateMutationResult } from '../src/domain/types.ts';
import {
  clearSessionCookie,
  generateSessionToken,
  getClientIp,
  hashPassword,
  hashSessionToken,
  isSameOriginRequest,
  LoginRateLimiter,
  parseCookies,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
  setSessionCookie,
  verifyPassword,
} from './auth.ts';
import { ConflictError, NotFoundError, type TrackerRepository } from './db/repository.ts';
import { resolveLinkMetadata } from './providers/linkImport.ts';
import {
  fetchCombinedRatings,
  fetchTmdbTitleDetails,
  isTmdbConfigured,
  searchTmdb,
} from './providers/tmdb.ts';

export interface CreateAppOptions {
  repo: TrackerRepository;
  nowFn?: () => number;
  envPasswordHash?: string;
  trustProxy?: boolean;
  isProduction?: boolean;
  rateLimiter?: LoginRateLimiter;
}

function extractAuthToken(req: Request): { token: string | null; viaCookie: boolean } {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]?.trim()) {
      return { token: match[1].trim(), viaCookie: false };
    }
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  if (cookieToken && cookieToken.trim()) {
    return { token: cookieToken.trim(), viaCookie: true };
  }

  return { token: null, viaCookie: false };
}

export function createApp(options: CreateAppOptions): Express {
  const {
    repo,
    nowFn = () => Date.now(),
    envPasswordHash,
    trustProxy = process.env.TRUST_PROXY === '1',
    isProduction = process.env.NODE_ENV === 'production',
    rateLimiter = new LoginRateLimiter(),
  } = options;

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const sseClients = new Set<Response>();

  function broadcastMutation(mutation: StateMutationResult): void {
    const payload = `data: ${JSON.stringify(mutation)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(payload);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  function getActivePasswordHash(): string | null {
    const rawEnv = (envPasswordHash !== undefined ? envPasswordHash : process.env.APP_PASSWORD_HASH || '')
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .trim();
    if (rawEnv && rawEnv.startsWith('scrypt:')) {
      return rawEnv;
    }
    return repo.getStoredPasswordHash();
  }

  function isSessionAuthenticated(req: Request): {
    authenticated: boolean;
    tokenHash: string | null;
    viaCookie: boolean;
  } {
    const { token, viaCookie } = extractAuthToken(req);
    if (!token) {
      return { authenticated: false, tokenHash: null, viaCookie: false };
    }
    const tokenHash = hashSessionToken(token);
    const now = nowFn();
    const valid = repo.verifyAndTouchSession(tokenHash, now, now + SESSION_TTL_MS);
    return {
      authenticated: valid,
      tokenHash: valid ? tokenHash : null,
      viaCookie,
    };
  }

  // Healthcheck (no auth)
  app.get('/healthz', (_req, res) => {
    res.status(200).type('text/plain').send('ok');
  });

  // Auth status (no auth required)
  app.get('/api/auth/status', (req, res) => {
    const activeHash = getActivePasswordHash();
    const needsSetup = !activeHash;
    const { authenticated } = isSessionAuthenticated(req);
    res.json({ needsSetup, authenticated });
  });

  // First-run password setup (one-time only while no password exists)
  app.post('/api/auth/setup', (req, res, next) => {
    try {
      const activeHash = getActivePasswordHash();
      if (activeHash) {
        res.status(403).json({ error: '密码已设置，无法重复初始化' });
        return;
      }

      const { password } = authPasswordRequestSchema.parse(req.body);
      const now = nowFn();
      const passwordHash = hashPassword(password);
      repo.setStoredPasswordHash(passwordHash, now);

      const { token, tokenHash } = generateSessionToken();
      repo.createSession(tokenHash, now, now + SESSION_TTL_MS);
      setSessionCookie(res, token, isProduction);

      res.json({ ok: true, token });
    } catch (err) {
      next(err);
    }
  });

  // Password login
  app.post('/api/auth/login', (req, res, next) => {
    try {
      const now = nowFn();
      const clientIp = getClientIp(req, trustProxy);

      if (rateLimiter.isBlocked(clientIp, now)) {
        res.status(429).json({ error: '登录尝试次数过多，请 15 分钟后再试' });
        return;
      }

      const activeHash = getActivePasswordHash();
      if (!activeHash) {
        res.status(400).json({ error: '尚未设置密码，请先设置密码' });
        return;
      }

      const { password } = authPasswordRequestSchema.parse(req.body);
      if (!verifyPassword(password, activeHash)) {
        rateLimiter.recordFailure(clientIp, now);
        res.status(401).json({ error: '密码错误' });
        return;
      }

      rateLimiter.clear(clientIp);
      const { token, tokenHash } = generateSessionToken();
      repo.createSession(tokenHash, now, now + SESSION_TTL_MS);
      setSessionCookie(res, token, isProduction);

      res.json({ ok: true, token });
    } catch (err) {
      next(err);
    }
  });

  // Session authentication & CSRF middleware for all remaining /api routes
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const { token, viaCookie } = extractAuthToken(req);
    if (!token) {
      res.status(401).json({ error: '未登录或会话已过期' });
      return;
    }

    const isMutating =
      req.method === 'POST' ||
      req.method === 'PUT' ||
      req.method === 'PATCH' ||
      req.method === 'DELETE';

    if (viaCookie && isMutating && !isSameOriginRequest(req)) {
      res.status(403).json({ error: '跨站请求被拒绝 (Origin 校验未通过)' });
      return;
    }

    const tokenHash = hashSessionToken(token);
    const now = nowFn();
    if (!repo.verifyAndTouchSession(tokenHash, now, now + SESSION_TTL_MS)) {
      res.status(401).json({ error: '会话已过期，请重新登录' });
      return;
    }

    res.locals.tokenHash = tokenHash;
    next();
  });

  // Logout current session
  app.post('/api/auth/logout', (_req, res) => {
    const tokenHash = res.locals.tokenHash as string | undefined;
    if (tokenHash) {
      repo.deleteSession(tokenHash);
    }
    clearSessionCookie(res, isProduction);
    res.json({ ok: true });
  });

  // Logout all sessions
  app.post('/api/auth/logout-all', (_req, res) => {
    repo.deleteAllSessions();
    clearSessionCookie(res, isProduction);
    res.json({ ok: true });
  });

  // Full state snapshot
  app.get('/api/state', (_req, res) => {
    res.json(repo.getState());
  });

  // Server-Sent Events stream
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(': connected\n\n');
    sseClients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // Titles & Seasons routes
  app.put('/api/titles/:id', (req, res, next) => {
    try {
      const id = String(req.params.id);
      const parsed = putTitleRequestSchema.parse(req.body);

      const titleDoc = 'title' in parsed ? { ...parsed.title, id } : { ...parsed, id };
      const seasons = parsed.seasons;

      let progressMap: Record<string, ProgressDoc> | undefined;
      if (parsed.progress !== undefined) {
        if (
          typeof parsed.progress === 'object' &&
          parsed.progress !== null &&
          'playthroughId' in parsed.progress &&
          typeof parsed.progress.playthroughId === 'string' &&
          'watched' in parsed.progress
        ) {
          const single = parsed.progress as ProgressDoc;
          progressMap = { [single.playthroughId]: single };
        } else {
          progressMap = parsed.progress as Record<string, ProgressDoc>;
        }
      }

      const mutation = repo.putTitle(id, {
        title: titleDoc,
        seasons,
        progress: progressMap,
      });
      broadcastMutation(mutation);
      res.json(mutation);
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/titles/:id', (req, res, next) => {
    try {
      const id = String(req.params.id);
      const patch = patchTitleRequestSchema.parse(req.body);
      const mutation = repo.patchTitle(id, patch);
      broadcastMutation(mutation);
      res.json(mutation);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/titles/:id', (req, res, next) => {
    try {
      const id = String(req.params.id);
      const mutation = repo.deleteTitle(id);
      broadcastMutation(mutation);
      res.json(mutation);
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/titles/:id/seasons', (req, res, next) => {
    try {
      const id = String(req.params.id);
      const parsed = putSeasonsRequestSchema.parse(req.body);
      const seasons = Array.isArray(parsed) ? parsed : parsed.seasons;
      const mutation = repo.replaceSeasons(id, seasons);
      broadcastMutation(mutation);
      res.json(mutation);
    } catch (err) {
      next(err);
    }
  });

  // Progress routes
  app.put('/api/titles/:id/progress/:playthroughId', (req, res, next) => {
    try {
      const titleId = String(req.params.id);
      const playthroughId = String(req.params.playthroughId);
      const parsed = putProgressRequestSchema.parse(req.body);
      const mutation = repo.putProgress(titleId, playthroughId, {
        watched: parsed.watched,
        movieWatchedAt: parsed.movieWatchedAt,
      });
      broadcastMutation(mutation);
      res.json(mutation);
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/titles/:id/progress/:playthroughId', (req, res, next) => {
    try {
      const titleId = String(req.params.id);
      const playthroughId = String(req.params.playthroughId);
      const parsed = patchProgressRequestSchema.parse(req.body);
      const mutation = repo.patchProgress(titleId, playthroughId, parsed);
      broadcastMutation(mutation);
      res.json(mutation);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/titles/:id/progress/:playthroughId', (req, res, next) => {
    try {
      const titleId = String(req.params.id);
      const playthroughId = String(req.params.playthroughId);
      const mutation = repo.deleteProgress(titleId, playthroughId);
      broadcastMutation(mutation);
      res.json(mutation);
    } catch (err) {
      next(err);
    }
  });

  // Lists & List Entries routes
  app.put('/api/lists/:id', (req, res, next) => {
    try {
      const id = String(req.params.id);
      const parsed = putListRequestSchema.parse(req.body);
      const mutation = repo.putList(id, parsed);
      broadcastMutation(mutation);
      res.json(mutation);
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/lists/:id', (req, res, next) => {
    try {
      const id = String(req.params.id);
      const patch = patchListRequestSchema.parse(req.body);
      const mutation = repo.patchList(id, patch);
      broadcastMutation(mutation);
      res.json(mutation);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/lists/:id', (req, res, next) => {
    try {
      const id = String(req.params.id);
      const mutation = repo.deleteList(id);
      broadcastMutation(mutation);
      res.json(mutation);
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/lists/:id/entries/:entryId', (req, res, next) => {
    try {
      const listId = String(req.params.id);
      const entryId = String(req.params.entryId);
      const parsed = putListEntryRequestSchema.parse(req.body);
      const mutation = repo.putListEntry(listId, entryId, parsed);
      broadcastMutation(mutation);
      res.json(mutation);
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/lists/:id/entries/:entryId', (req, res, next) => {
    try {
      const listId = String(req.params.id);
      const entryId = String(req.params.entryId);
      const patch = patchListEntryRequestSchema.parse(req.body);
      const mutation = repo.patchListEntry(listId, entryId, patch);
      broadcastMutation(mutation);
      res.json(mutation);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/lists/:id/entries/:entryId', (req, res, next) => {
    try {
      const listId = String(req.params.id);
      const entryId = String(req.params.entryId);
      const mutation = repo.deleteListEntry(listId, entryId);
      broadcastMutation(mutation);
      res.json(mutation);
    } catch (err) {
      next(err);
    }
  });

  // Settings route
  app.patch('/api/settings', (req, res, next) => {
    try {
      const patch = patchSettingsRequestSchema.parse(req.body);
      const mutation = repo.patchSettings(patch);
      broadcastMutation(mutation);
      res.json(mutation);
    } catch (err) {
      next(err);
    }
  });

  // Export & Import routes
  app.get('/api/export', (_req, res) => {
    const exported = repo.exportData();
    const dateStr = exported.exportedAt.slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="zhenji-${dateStr}.json"`);
    res.send(JSON.stringify(exported, null, 2));
  });

  app.post('/api/import', (req, res, next) => {
    try {
      const parsed = importPayloadSchema.parse(req.body);
      const mutation = repo.importData(parsed);
      broadcastMutation(mutation);
      res.json(mutation);
    } catch (err) {
      next(err);
    }
  });

  // TMDB, Ratings & Link Import routes
  app.get('/api/tmdb/status', (_req, res) => {
    res.json({ configured: isTmdbConfigured() });
  });

  app.get('/api/tmdb/search', async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!isTmdbConfigured()) {
      res.status(503).json({
        error: '服务端未配置有效的 TMDB_READ_TOKEN 密钥，请在环境变量中配置后重试。',
      });
      return;
    }
    if (!query) {
      res.json({ results: [] });
      return;
    }
    try {
      const results = await searchTmdb(query);
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

  app.get('/api/tmdb/:mediaType/:id', async (req, res) => {
    const mediaType = String(req.params.mediaType || '');
    const sourceId = String(req.params.id || '');

    if (mediaType !== 'movie' && mediaType !== 'tv') {
      res.status(400).json({ error: '无效的媒体类型：仅支持 movie 或 tv' });
      return;
    }
    if (!/^\d+$/.test(sourceId)) {
      res.status(400).json({ error: '无效的 TMDB ID：必须为纯数字' });
      return;
    }
    if (!isTmdbConfigured()) {
      res.status(503).json({
        error: '服务端未配置有效的 TMDB_READ_TOKEN 密钥，无法获取 TMDB 详情。',
      });
      return;
    }

    try {
      const details = await fetchTmdbTitleDetails(mediaType, sourceId);
      res.json(details);
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : '获取 TMDB 详情失败',
      });
    }
  });

  app.get('/api/ratings', async (req, res) => {
    const imdbId = String(req.query.imdbId || '').trim();
    const title = String(req.query.title || '').trim();
    const yearStr = String(req.query.year || '').trim();
    const year = yearStr ? Number.parseInt(yearStr, 10) || null : null;
    const doubanId = String(req.query.doubanId || '').trim();

    const result = await fetchCombinedRatings({ imdbId, title, year, doubanId });
    res.json(result);
  });

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

  // Error handling middleware
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      const firstIssue = err.issues[0];
      res.status(400).json({
        error: firstIssue?.message || '请求数据格式不正确',
        issues: err.issues,
      });
      return;
    }
    if (err instanceof NotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof ConflictError) {
      res.status(409).json({ error: err.message });
      return;
    }
    console.error('Unhandled API error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : '服务器内部错误',
    });
  });

  return app;
}
