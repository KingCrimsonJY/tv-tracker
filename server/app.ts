import { clientSnapshot, clientMutation } from './clientState.ts';
import { LinkImportError } from './providers/linkErrors.ts';
import { createPlaylistEnricher } from './playlistEnrichment.ts';
import { resolveWithYtdlp } from './providers/ytdlp.ts';
import compression from 'compression';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { ZodError } from 'zod';
import { authPasswordRequestSchema, authSetupRequestSchema } from '../src/domain/schemas.ts';
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
import { SafetyBackupError } from './db/types.ts';
import { registerEntityRoutes } from './entityRoutes.ts';
import { sendApiError } from './http.ts';
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
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    // Posters come from third-party hosts (TMDB, Bilibili, YouTube); never tell them which page asked.
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.use(
    compression({
      filter: (req, res) => {
        if (req.path === '/api/events' || req.originalUrl.startsWith('/api/events')) {
          return false;
        }
        return compression.filter(req, res);
      },
    }),
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
    mutation = clientMutation(mutation);
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
    const rawEnv = (envPasswordHash !== undefined ? envPasswordHash : process.env.APP_PASSWORD_HASH || '')
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .trim();
    if (rawEnv && rawEnv.startsWith('scrypt:')) {
      return rawEnv;
    }
    return repo.getStoredPasswordHash();
  }

  if (repo.endSessionsOfReplacedPassword(getActivePasswordHash())) {
    console.log('[Auth] The password changed since the last start; every device has been signed out.');
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
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      needsSetup,
      authenticated,
      ...(authenticated && req.query.state === '1' ? { state: { ...clientSnapshot(repo.getState()), epoch } } : {}),
    });
  });

  app.post('/api/auth/setup', (req, res, next) => {
    try {
      if (getActivePasswordHash()) {
        sendApiError(res, 403, 'PASSWORD_ALREADY_SET');
        return;
      }
      // A setup code can be short when it is chosen by hand (SETUP_CODE); guessing is limited like passwords.
      const now = nowFn();
      const clientIp = getClientIp(req, trustProxy);
      if (rateLimiter.isBlocked(clientIp, now)) {
        sendApiError(res, 429, 'TOO_MANY_ATTEMPTS');
        return;
      }
      const { password, setupCode: providedSetupCode } = authSetupRequestSchema.parse(req.body);
      if (!verifySetupCode(providedSetupCode, activeSetupCode)) {
        rateLimiter.recordFailure(clientIp, now);
        sendApiError(res, 403, 'SETUP_CODE_INVALID');
        return;
      }
      rateLimiter.clear(clientIp);
      repo.setStoredPasswordHash(hashPassword(password), now);
      repo.endSessionsOfReplacedPassword(getActivePasswordHash());
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
        sendApiError(res, 429, 'TOO_MANY_ATTEMPTS');
        return;
      }
      const activeHash = getActivePasswordHash();
      if (!activeHash) {
        sendApiError(res, 400, 'PASSWORD_NOT_SET');
        return;
      }
      const { password } = authPasswordRequestSchema.parse(req.body);
      if (!verifyPassword(password, activeHash)) {
        rateLimiter.recordFailure(clientIp, now);
        sendApiError(res, 401, 'WRONG_PASSWORD');
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
      sendApiError(res, 401, 'UNAUTHENTICATED');
      return;
    }
    const isMutating =
      req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE';
    if (viaCookie && isMutating && !isSameOriginRequest(req, trustProxy)) {
      sendApiError(res, 403, 'CSRF_ORIGIN_MISMATCH');
      return;
    }
    const tokenHash = hashSessionToken(token);
    const now = nowFn();
    if (!repo.verifyAndTouchSession(tokenHash, now, now + SESSION_TTL_MS)) {
      sendApiError(res, 401, 'SESSION_EXPIRED');
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
    res.json({ ...clientSnapshot(repo.getState()), epoch });
  });

  app.get('/api/events', (req, res) => {
    const tokenHash = (res.locals.tokenHash as string) || '';
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(
      'data: ' +
        JSON.stringify({ checkpoint: true, version: repo.getVersion(), epoch, upserts: {}, deletes: {} }) +
        '\n\n',
    );

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

  const enricher = createPlaylistEnricher({
    repo,
    broadcast: broadcastMutation,
    loadVideo: (url) =>
      resolveWithYtdlp(url, {
        binaryPath: options.linkDeps?.ytdlpPath,
        execFn: options.linkDeps?.execFn,
        lookupFn: options.linkDeps?.lookupFn,
      }),
  });
  app.locals.stopBackgroundTasks = () => enricher.stop();
  for (const title of Object.values(repo.getState().titles)) if (title.source === 'url') enricher.schedule(title.id);
  registerEntityRoutes(app, repo, broadcastMutation, enricher.schedule);
  registerProviderRoutes(app, {
    repo,
    broadcastMutation,
    nowFn,
    linkDeps: options.linkDeps,
    scheduleEnrichment: enricher.schedule,
  });

  app.use('/api', (_req: Request, res: Response) => {
    sendApiError(res, 404, 'ROUTE_NOT_FOUND');
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      const firstIssue = err.issues[0];
      const field = firstIssue?.path.length ? firstIssue.path.join('.') : undefined;
      sendApiError(res, 400, 'VALIDATION_ERROR', {
        ...(field ? { field } : {}),
        issues: err.issues.map((issue) => ({ code: issue.code, path: issue.path })),
      });
      return;
    }
    if (err instanceof LinkImportError) {
      sendApiError(res, 400, err.code);
      return;
    }
    if (err instanceof NotFoundError) {
      sendApiError(res, 404, err.code);
      return;
    }
    if (err instanceof ConflictError) {
      sendApiError(res, 409, err.code);
      return;
    }
    if (err instanceof SafetyBackupError) {
      sendApiError(res, 500, err.code);
      return;
    }
    // Request-body failures (malformed JSON, bad or truncated gzip, unsupported charset) are client errors.
    // body-parser and zlib mark them with a 4xx status; some carry the raw body, which can hold a
    // password, so answer 400/413 and never log them.
    const clientStatus =
      typeof err === 'object' && err !== null && 'status' in err ? (err as { status?: unknown }).status : undefined;
    if (clientStatus === 413) {
      sendApiError(res, 413, 'PAYLOAD_TOO_LARGE');
      return;
    }
    if (typeof clientStatus === 'number' && clientStatus >= 400 && clientStatus < 500) {
      sendApiError(res, 400, 'VALIDATION_ERROR');
      return;
    }
    // Log the stack only: enumerable properties of unknown errors may include request data.
    console.error('Unhandled API error:', err instanceof Error ? (err.stack ?? err.message) : typeof err);
    sendApiError(res, 500, 'INTERNAL_ERROR');
  });

  return app;
}
