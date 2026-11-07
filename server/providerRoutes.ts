import { toTmdbSearchItem } from './providers/tmdbSearchItem.ts';
import { suggestBangumiMatches } from './providers/bangumi.ts';
import { registerMetadataRoutes } from './metadataRoutes.ts';
import fs from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';
import { linkImportRequestSchema } from '../src/domain/schemas.ts';
import type { ServerErrorCode, StateMutationResult } from '../src/domain/types.ts';
import { sendApiError } from './app.ts';
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

function classifyProviderError(
  err: unknown,
  fallbackCode: ServerErrorCode,
): {
  code: ServerErrorCode;
  message: string;
} {
  if (err instanceof LinkImportError) return { code: err.code, message: err.message };
  if (err instanceof UnsafeUrlError) {
    return { code: err.code as ServerErrorCode, message: err.message };
  }
  if (err instanceof YtdlpNotInstalledError) {
    return { code: err.code as ServerErrorCode, message: err.message };
  }
  if (err instanceof YtdlpExecutionError) {
    return { code: err.code as ServerErrorCode, message: err.message };
  }
  return {
    code: fallbackCode,
    message: err instanceof Error ? err.message : fallbackCode,
  };
}

export function registerProviderRoutes(app: Express, options: ProviderRoutesOptions): void {
  registerMetadataRoutes(app, options);
  const { repo, broadcastMutation, nowFn = () => Date.now(), linkDeps = {} } = options;

  app.get('/api/system/info', async (_req, res) => {
    const ytdlpVersion = await getYtdlpVersion({
      binaryPath: linkDeps.ytdlpPath,
      execFn: linkDeps.execFn,
    });
    res.json({
      appVersion: APP_VERSION,
      ytdlpInstalled: Boolean(ytdlpVersion),
      ytdlpVersion,
    });
  });

  app.get('/api/tmdb/status', (_req, res) => {
    res.json({ configured: isTmdbConfigured() });
  });

  app.get('/api/tmdb/genres', async (_req, res) => {
    const genres = await fetchTmdbGenres();
    res.json(genres);
  });

  app.get('/api/tmdb/search', async (req, res) => {
    const query = String(req.query.q || '').trim();
    const rawLang = String(req.query.lang || '').trim();
    const lang: 'zh-CN' | 'en-US' = rawLang === 'en' || rawLang === 'en-US' ? 'en-US' : 'zh-CN';

    if (!isTmdbConfigured()) {
      sendApiError(res, 503, 'TMDB_NOT_CONFIGURED', 'TMDB_READ_TOKEN is not configured.');
      return;
    }
    if (!query) {
      res.json({ results: [] });
      return;
    }
    try {
      const results = await searchTmdb(query, lang);
      res.json({ results: results.map((item) => toTmdbSearchItem(item, lang)) });
    } catch (error) {
      sendApiError(
        res,
        502,
        'TMDB_UNAVAILABLE',
        error instanceof Error ? error.message : 'TMDB search request failed.',
      );
    }
  });

  app.get('/api/tmdb/:mediaType/:id', async (req, res) => {
    const mediaType = String(req.params.mediaType || '');
    const sourceId = String(req.params.id || '');

    if (mediaType !== 'movie' && mediaType !== 'tv') {
      sendApiError(res, 400, 'TMDB_INVALID_MEDIA_TYPE', 'Invalid media type: must be movie or tv.');
      return;
    }
    if (!/^\d+$/.test(sourceId)) {
      sendApiError(res, 400, 'TMDB_INVALID_ID', 'Invalid TMDB ID: must be numeric.');
      return;
    }
    if (!isTmdbConfigured()) {
      sendApiError(res, 503, 'TMDB_NOT_CONFIGURED', 'TMDB_READ_TOKEN is not configured.');
      return;
    }

    try {
      const details = await fetchTmdbTitleDetails(mediaType, sourceId);
      res.json(details);
    } catch (error) {
      sendApiError(
        res,
        502,
        'TMDB_UNAVAILABLE',
        error instanceof Error ? error.message : 'Failed to fetch TMDB title details.',
      );
    }
  });

  app.get('/api/ratings', async (req, res) => {
    const imdbId = String(req.query.imdbId || '').trim();
    const result = await fetchCombinedRatings({ imdbId });
    res.json(result);
  });

  app.post('/api/import/link', async (req, res) => {
    const parsed = linkImportRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      sendApiError(res, 400, 'INVALID_LINK_URL', 'Please enter a valid http:// or https:// URL.');
      return;
    }
    try {
      const data = await resolveLinkMetadata(parsed.data.url, {
        ...linkDeps,
        forceImport: parsed.data.force,
      });
      res.json(await suggestBangumiMatches(data));
    } catch (err) {
      const classified = classifyProviderError(err, 'LINK_PARSE_FAILED');
      sendApiError(res, 400, classified.code, classified.message);
    }
  });

  app.post('/api/titles/:id/refresh-link', async (req, res, next) => {
    let requestedSource: string | null = null;
    try {
      const id = String(req.params.id || '');
      const title = repo.getTitle(id);
      if (!title) {
        throw new NotFoundError(`Title not found: ${id}`, 'TITLE_NOT_FOUND');
      }
      if (title.source !== 'url' || !title.sourceId) {
        sendApiError(res, 400, 'REFRESH_LINK_ONLY_URL', 'Only link-imported titles support playlist refresh.');
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
      const classified = classifyProviderError(err, 'REFRESH_LINK_FAILED');
      if (classified.code === 'LINK_UNAVAILABLE') {
        const id = String(req.params.id);
        const current = repo.getTitle(id);
        if (requestedSource && current?.source === 'url' && current.sourceId === requestedSource)
          broadcastMutation(repo.patchTitle(id, { sourceUnavailable: true, updatedAt: nowFn() }));
      }
      sendApiError(res, 400, classified.code, classified.message);
    }
  });
}
