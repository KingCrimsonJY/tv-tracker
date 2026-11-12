import type { Express } from 'express';
import { z } from 'zod';
import { sendApiError } from './http.ts';
import { ConflictError, NotFoundError } from './db/repository.ts';
import { refreshTmdbTitle } from './metadataService.ts';
import type { ProviderRoutesOptions } from './providerRoutes.ts';
import { fetchTmdbTitleDetails, isTmdbConfigured } from './providers/tmdb.ts';

const decisionSchema = z
  .object({ decision: z.enum(['keep', 'adopt']), version: z.number().int().nonnegative(), signature: z.string() })
  .strict();
const sourceSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('manual') }).strict(),
  z
    .object({ action: z.literal('relink'), sourceId: z.string().regex(/^\d+$/), mediaType: z.enum(['movie', 'tv']) })
    .strict(),
]);

export function registerMetadataRoutes(
  app: Express,
  { repo, broadcastMutation, nowFn = Date.now }: ProviderRoutesOptions,
): void {
  app.post('/api/titles/:id/refresh-metadata', async (req, res, next) => {
    try {
      const result = await refreshTmdbTitle(repo, String(req.params.id), { now: nowFn() });
      const mutation = Object.keys(result.upserts).length ? broadcastMutation(result) : result;
      res.json({ ...mutation, status: result.status });
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/titles/:id/structure', (req, res, next) => {
    try {
      res.json(repo.previewStructure(String(req.params.id)));
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/titles/:id/structure', (req, res, next) => {
    try {
      const input = decisionSchema.parse(req.body);
      res.json(
        broadcastMutation(repo.decideStructure(String(req.params.id), input.decision, input.version, input.signature)),
      );
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/titles/:id/source', async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const input = sourceSchema.parse(req.body);
      if (input.action === 'manual') {
        res.json(broadcastMutation(repo.convertToManual(id)));
        return;
      }
      const title = repo.getTitle(id);
      if (!title) throw new NotFoundError('TITLE_NOT_FOUND');
      if (title.mediaType !== 'other' && title.mediaType !== input.mediaType)
        throw new ConflictError('STRUCTURE_CONFLICT', 'STRUCTURE_CONFLICT');
      if (!isTmdbConfigured()) {
        sendApiError(res, 503, 'TMDB_NOT_CONFIGURED');
        return;
      }
      let data;
      try {
        data = await fetchTmdbTitleDetails(input.mediaType, input.sourceId);
      } catch {
        sendApiError(res, 502, 'TMDB_UNAVAILABLE');
        return;
      }
      const latest = repo.getTitle(id);
      if (!latest || latest.source !== title.source || latest.sourceId !== title.sourceId)
        throw new ConflictError('STRUCTURE_CONFLICT', 'STRUCTURE_CONFLICT');
      if (data.failedSeasons?.length) {
        sendApiError(res, 502, 'TMDB_UNAVAILABLE');
        return;
      }
      res.json(broadcastMutation(repo.refreshMetadata(id, data, nowFn(), true)));
    } catch (error) {
      next(error);
    }
  });
}
