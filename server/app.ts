import compression from 'compression';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { ZodError } from 'zod';
import {
  authPasswordRequestSchema,
  authSetupRequestSchema,
} from '../src/domain/schemas.ts';
import type { StateMutationResult } from '../src/domain/types.ts';
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
  verifySetupCode,
} from './auth.ts';
import { ConflictError, NotFoundError, type TrackerRepository } from './db/repository.ts';
import { registerEntityRoutes } from './entityRoutes.ts';
import { registerProviderRoutes } from './providerRoutes.ts';

export interface CreateAppOptions {
  repo: TrackerRepository;
  nowFn?: () => number;
  envPasswordHash?: string;
  setupCode?: string;
  epoch?: string;
  trustProxy?: boolean;
  isProduction?: boolean;
  rateLimiter?: LoginRateLimiter;
}

interface SseClient {
  res: Response;
  tokenHash: string;
  close: () => void;
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
    setupCode,
    epoch = crypto.randomUUID(),
    trustProxy = process.env.TRUST_PROXY === '1',
    isProduction = process.env.NODE_ENV === 'production',
    rateLimiter = new LoginRateLimiter(),
  } = options;

  const app = express();

  app.use(
    compression({
      filter: (req, res) => {
        if (req.path === '/api/events' || req.originalUrl.startsWith('/api/events')) {
          return false;
        }
        return compression.filter(req, res);
      },
    })
  );

  const json1mb = express.json({ limit: '1mb' });
  const json50mb = express.json({ limit: '50mb' });
  app.use((req, res, next) => {
    if (req.method === 'POST' && req.path === '/api/import') {
      json50mb(req, res, next);
      return;
    }
    json1mb(req, res, next);
  });

  const sseClients = new Set<SseClient>();

  function broadcastMutation(mutation: StateMutationResult): StateMutationResult {
    const stamped: StateMutationResult = { ...mutation, epoch };
    const payload = `data: ${JSON.stringify(stamped)}\n\n`;
    for (const client of sseClients) {
      try {
        client.res.write(payload);
      } catch {
        client.close();
      }
    }
    return stamped;
  }

  function closeSseClientsForSession(tokenHash: string): void {
    for (const client of [...sseClients]) {
      if (client.tokenHash === tokenHash) client.close();
    }
  }

  function closeAllSseClients(): void {
    for (const client of [...sseClients]) {
      client.close();
    }
  }

  function getActivePasswordHash(): string | null {
    const rawEnv = (
      envPasswordHash !== undefined ? envPasswordHash : process.env.APP_PASSWORD_HASH || ''
    )
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .trim();
    if (rawEnv && rawEnv.startsWith('scrypt:')) {
      return rawEnv;
    }
    return repo.getStoredPasswordHash();
  }

  const configuredSetupCode = (setupCode !== undefined ? setupCode : process.env.SETUP_CODE || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();
  const activeSetupCode = configuredSetupCode || crypto.randomBytes(9).toString('base64url');
  if (!getActivePasswordHash() && !configuredSetupCode) {
    console.log(`[Auth] First-run setup code: ${activeSetupCode}`);
  }

  function isSessionAuthenticated(req: Request): {
    authenticated: boolean;
    tokenHash: string | null;
    viaCookie: boolean;
  } {
    const { token, viaCookie } = extractAuthToken(req);
    if (!token) return { authenticated: false, tokenHash: null, viaCookie: false };
    const tokenHash = hashSessionToken(token);
    const now = nowFn();
    const valid = repo.verifyAndTouchSession(tokenHash, now, now + SESSION_TTL_MS);
    return { authenticated: valid, tokenHash: valid ? tokenHash : null, viaCookie };
  }

  app.get('/healthz', (_req, res) => {
    res.status(200).type('text/plain').send('ok');
  });

  app.get('/api/auth/status', (req, res) => {
    const activeHash = getActivePasswordHash();
    const needsSetup = !activeHash;
    const { authenticated } = isSessionAuthenticated(req);
    res.json({ needsSetup, authenticated });
  });

  app.post('/api/auth/setup', (req, res, next) => {
    try {
      if (getActivePasswordHash()) {
        res.status(403).json({ error: '密码已设置，无法重复初始化' });
        return;
      }
      const { password, setupCode: providedSetupCode } = authSetupRequestSchema.parse(req.body);
      if (!verifySetupCode(providedSetupCode, activeSetupCode)) {
        res.status(403).json({ error: '设置码不正确，请检查服务器日志或 SETUP_CODE 环境变量' });
        return;
      }
      const now = nowFn();
      repo.setStoredPasswordHash(hashPassword(password), now);
      const { token, tokenHash } = generateSessionToken();
      repo.createSession(tokenHash, now, now + SESSION_TTL_MS);
      setSessionCookie(res, token, isProduction);
      res.json({ ok: true, token });
    } catch (err) {
      next(err);
    }
  });

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

  app.post('/api/auth/logout', (_req, res) => {
    const tokenHash = res.locals.tokenHash as string | undefined;
    if (tokenHash) {
      repo.deleteSession(tokenHash);
      closeSseClientsForSession(tokenHash);
    }
    clearSessionCookie(res, isProduction);
    res.json({ ok: true });
  });

  app.post('/api/auth/logout-all', (_req, res) => {
    repo.deleteAllSessions();
    closeAllSseClients();
    clearSessionCookie(res, isProduction);
    res.json({ ok: true });
  });

  app.get('/api/state', (_req, res) => {
    res.json({ ...repo.getState(), epoch });
  });

  app.get('/api/events', (req, res) => {
    const tokenHash = (res.locals.tokenHash as string) || '';
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(': connected\n\n');

    let closed = false;
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        client.close();
      }
    }, 10_000);

    const client: SseClient = {
      res,
      tokenHash,
      close: () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        sseClients.delete(client);
        try {
          res.end();
        } catch {
          // ignore
        }
      },
    };
    sseClients.add(client);
    req.on('close', () => client.close());
  });

  registerEntityRoutes(app, repo, broadcastMutation);
  registerProviderRoutes(app);

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: '未找到请求的 API 路径' });
  });

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
    if (
      typeof err === 'object' &&
      err !== null &&
      'type' in err &&
      (err as { type?: string }).type === 'entity.too.large'
    ) {
      res.status(413).json({ error: '请求体过大' });
      return;
    }
    console.error('Unhandled API error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : '服务器内部错误',
    });
  });

  return app;
}
