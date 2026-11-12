import { suggestBangumiMatches } from './providers/bangumi.ts';
import { registerMetadataRoutes } from './metadataRoutes.ts';
import fs from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';
import { linkImportRequestSchema } from '../src/domain/schemas.ts';
import type { ServerErrorCode, StateMutationResult } from '../src/domain/types.ts';
import { route, sendApiError } from './http.ts';
import { ConflictError, NotFoundError, type TrackerRepository } from './db/repository.ts';
import { type LinkImportDependencies, resolveLinkMetadata } from './providers/linkImport.ts';
import {
  fetchCombinedRatings,
  fetchTmdbGenres,
  fetchTmdbTitleDetails,
  isTmdbConfigured,
  searchTmdb,
} from './providers/tmdb.ts';
import { getYtdlpVersion, YtdlpExecutionError, YtdlpNotInstalledError } from './providers/ytdlp.ts';
import { LinkImportError } from './providers/linkErrors.ts';
import { UnsafeUrlError } from './security/ssrf.ts';

function getPackageVersion(): string {
  try {
    const pkgPath = path.resolve(import.meta.dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { version?: string };
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

const APP_VERSION = getPackageVersion();

export interface ProviderRoutesOptions {
  repo: TrackerRepository;
  broadcastMutation: (mutation: StateMutationResult) => StateMutationResult;
  nowFn?: () => number;
  linkDeps?: LinkImportDependencies;
  scheduleEnrichment?: (id: string) => void;
}

/** Keep provider diagnostics on the server and answer with a stable code. */
function providerErrorCode(err: unknown, fallback: ServerErrorCode): ServerErrorCode {
  if (
    err instanceof LinkImportError ||
    err instanceof UnsafeUrlError ||
    err instanceof YtdlpNotInstalledError ||
    err instanceof YtdlpExecutionError
  ) {
    return err.code as ServerErrorCode;
  }
  return fallback;
}

export function registerProviderRoutes(app: Express, options: ProviderRoutesOptions): void {
  registerMetadataRoutes(app, options);
  const { repo, broadcastMutation, nowFn = () => Date.now(), linkDeps = {} } = options;

  app.get(
    '/api/system/info',
    route(async (_req, res) => {
      const ytdlpVersion = await getYtdlpVersion({ binaryPath: linkDeps.ytdlpPath, execFn: linkDeps.execFn });
      res.json({ appVersion: APP_VERSION, ytdlpInstalled: Boolean(ytdlpVersion), ytdlpVersion });
    }),
  );

  app.get(
    '/api/tmdb/genres',
    route(async (_req, res) => {
      res.json(await fetchTmdbGenres());
    }),
  );

  app.get(
    '/api/tmdb/search',
    route(async (req, res) => {
      const query = String(req.query.q || '').trim();
      const rawLang = String(req.query.lang || '').trim();
      const lang: 'zh-CN' | 'en-US' = rawLang === 'en' || rawLang === 'en-US' ? 'en-US' : 'zh-CN';
      if (!isTmdbConfigured()) {
        sendApiError(res, 503, 'TMDB_NOT_CONFIGURED');
        return;
      }
      if (!query) {
        res.json({ results: [] });
        return;
      }
      try {
        res.json({ results: await searchTmdb(query, lang) });
      } catch {
        sendApiError(res, 502, 'TMDB_UNAVAILABLE');
      }
    }),
  );

  app.get(
    '/api/tmdb/:mediaType/:id',
    route(async (req, res) => {
      const mediaType = String(req.params.mediaType || '');
      const sourceId = String(req.params.id || '');
      if (mediaType !== 'movie' && mediaType !== 'tv') {
        sendApiError(res, 400, 'TMDB_INVALID_MEDIA_TYPE');
        return;
      }
      if (!/^\d+$/.test(sourceId)) {
        sendApiError(res, 400, 'TMDB_INVALID_ID');
        return;
      }
      if (!isTmdbConfigured()) {
        sendApiError(res, 503, 'TMDB_NOT_CONFIGURED');
        return;
      }
      try {
        res.json(await fetchTmdbTitleDetails(mediaType, sourceId));
      } catch {
        sendApiError(res, 502, 'TMDB_UNAVAILABLE');
      }
    }),
  );

  app.get(
    '/api/ratings',
    route(async (req, res) => {
      res.json(await fetchCombinedRatings({ imdbId: String(req.query.imdbId || '').trim() }));
    }),
  );

  app.post(
    '/api/import/link',
    route(async (req, res) => {
      const parsed = linkImportRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        sendApiError(res, 400, 'INVALID_LINK_URL');
        return;
      }
      try {
        const data = await resolveLinkMetadata(parsed.data.url, { ...linkDeps, forceImport: parsed.data.force });
        res.json(await suggestBangumiMatches(data));
      } catch (err) {
        sendApiError(res, 400, providerErrorCode(err, 'LINK_PARSE_FAILED'));
      }
    }),
  );

  app.post('/api/titles/:id/refresh-link', async (req, res, next) => {
    let requestedSource: string | null = null;
    try {
      const id = String(req.params.id || '');
      const title = repo.getTitle(id);
      if (!title) {
        throw new NotFoundError(`Title not found: ${id}`, 'TITLE_NOT_FOUND');
      }
      if (title.source !== 'url' || !title.sourceId) {
        sendApiError(res, 400, 'REFRESH_LINK_ONLY_URL');
        return;
      }

      requestedSource = title.sourceId;
      const resolved = await resolveLinkMetadata(title.sourceId, {
        ...linkDeps,
        forceImport: true,
      });
      // A generic web page must never be used to refresh structured video metadata.
      if (resolved.fallbackUsed === 'og' || resolved.fallbackUsed === 'manual') {
        throw new LinkImportError('REFRESH_LINK_FAILED', 'Only basic page metadata was available.');
      }

      const current = repo.getTitle(id);
      if (current?.source !== 'url' || current.sourceId !== requestedSource) {
        throw new ConflictError('STRUCTURE_CONFLICT', 'STRUCTURE_CONFLICT');
      }
      const refreshResult = repo.appendPlaylistEpisodes(id, resolved.episodes, nowFn(), resolved);
      options.scheduleEnrichment?.(id);
      const broadcasted = broadcastMutation({
        version: refreshResult.version,
        upserts: refreshResult.upserts,
        deletes: refreshResult.deletes,
      });
      res.json({
        ...broadcasted,
        addedCount: refreshResult.addedCount,
        ...(resolved.warning ? { warning: resolved.warning } : {}),
      });
    } catch (err) {
      if (err instanceof NotFoundError || err instanceof ConflictError) {
        next(err);
        return;
      }
      const code = providerErrorCode(err, 'REFRESH_LINK_FAILED');
      if (code === 'LINK_UNAVAILABLE') {
        const id = String(req.params.id);
        const current = repo.getTitle(id);
        if (requestedSource && current?.source === 'url' && current.sourceId === requestedSource)
          broadcastMutation(repo.patchTitle(id, { sourceUnavailable: true, updatedAt: nowFn() }));
      }
      sendApiError(res, 400, code);
    }
  });
}
