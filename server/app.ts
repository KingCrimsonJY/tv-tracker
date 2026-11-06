import compression from 'compression';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { ZodError } from 'zod';
import {
  authPasswordRequestSchema,
  authSetupRequestSchema,
} from '../src/domain/schemas.ts';
import type { ServerErrorCode, StateMutationResult } from '../src/domain/types.ts';
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
import type { LinkImportDependencies } from './providers/linkImport.ts';

export interface CreateAppOptions {
  repo: TrackerRepository;
  nowFn?: () => number;
  envPasswordHash?: string;
  setupCode?: string;
  epoch?: string;
  trustProxy?: boolean;
  isProduction?: boolean;
  rateLimiter?: LoginRateLimiter;
  linkDeps?: LinkImportDependencies;
}

interface SseClient {
  res: Response;
  tokenHash: string;
  close: () => void;
}

export function sendApiError(
  res: Response,
  status: number,
  code: ServerErrorCode,
  message: string,
  extra?: Record<string, unknown>
): void {
  res.status(status).json({
    code,
    message,
    error: message,
    ...(extra || {}),
  });
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
        sendApiError(res, 403, 'PASSWORD_ALREADY_SET', 'Password has already been configured.');
        return;
      }
      const { password, setupCode: providedSetupCode } = authSetupRequestSchema.parse(req.body);
      if (!verifySetupCode(providedSetupCode, activeSetupCode)) {
        sendApiError(
          res,
          403,
          'SETUP_CODE_INVALID',
          'Invalid setup code. Check server logs or SETUP_CODE.'
        );
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
        sendApiError(
          res,
          429,
          'TOO_MANY_ATTEMPTS',
          'Too many failed login attempts. Try again in 15 minutes.'
        );
        return;
      }
      const activeHash = getActivePasswordHash();
      if (!activeHash) {
        sendApiError(res, 400, 'PASSWORD_NOT_SET', 'Password has not been configured yet.');
        return;
      }
      const { password } = authPasswordRequestSchema.parse(req.body);
      if (!verifyPassword(password, activeHash)) {
        rateLimiter.recordFailure(clientIp, now);
        sendApiError(res, 401, 'WRONG_PASSWORD', 'Incorrect password.');
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
      sendApiError(res, 401, 'UNAUTHENTICATED', 'Authentication required.');
      return;
    }
    const isMutating =
      req.method === 'POST' ||
      req.method === 'PUT' ||
      req.method === 'PATCH' ||
      req.method === 'DELETE';
    if (viaCookie && isMutating && !isSameOriginRequest(req)) {
      sendApiError(
        res,
        403,
        'CSRF_ORIGIN_MISMATCH',
        'Cross-origin request rejected (Origin check failed).'
      );
      return;
    }
    const tokenHash = hashSessionToken(token);
    const now = nowFn();
    if (!repo.verifyAndTouchSession(tokenHash, now, now + SESSION_TTL_MS)) {
      sendApiError(res, 401, 'SESSION_EXPIRED', 'Session has expired. Please sign in again.');
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
  registerProviderRoutes(app, {
    repo,
    broadcastMutation,
    nowFn,
    linkDeps: options.linkDeps,
  });

  app.use('/api', (_req: Request, res: Response) => {
    sendApiError(res, 404, 'ROUTE_NOT_FOUND', 'Requested API endpoint was not found.');
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      const firstIssue = err.issues[0];
      const field = firstIssue?.path.length ? firstIssue.path.join('.') : undefined;
      sendApiError(res, 400, 'VALIDATION_ERROR', firstIssue?.message || 'Invalid request payload', {
        ...(field ? { field } : {}),
        issues: err.issues,
      });
      return;
    }
    if (err instanceof NotFoundError) {
      sendApiError(res, 404, err.code, err.message);
      return;
    }
    if (err instanceof ConflictError) {
      sendApiError(res, 409, err.code, err.message);
      return;
    }
    if (
      typeof err === 'object' &&
      err !== null &&
      'type' in err &&
      (err as { type?: string }).type === 'entity.too.large'
    ) {
      sendApiError(res, 413, 'PAYLOAD_TOO_LARGE', 'Request payload is too large.');
      return;
    }
    console.error('Unhandled API error:', err);
    sendApiError(
      res,
      500,
      'INTERNAL_ERROR',
      err instanceof Error ? err.message : 'Internal server error.'
    );
  });

  return app;
}
