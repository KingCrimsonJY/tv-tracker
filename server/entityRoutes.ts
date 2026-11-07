import { assertSupportedLinkType } from './providers/linkScope.ts';
import type { Express } from 'express';
import {
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
  titleAtomicActionRequestSchema,
} from '../src/domain/schemas.ts';
import type { ProgressDoc, StateMutationResult } from '../src/domain/types.ts';
import type { TrackerRepository } from './db/repository.ts';

export function registerEntityRoutes(
  app: Express,
  repo: TrackerRepository,
  broadcastMutation: (mutation: StateMutationResult) => StateMutationResult,
  scheduleEnrichment: (id: string) => void = () => {},
): void {
  app.put('/api/titles/:id', (req, res, next) => {
    try {
      const id = String(req.params.id);
      const parsed = putTitleRequestSchema.parse(req.body);
      const titleDoc = 'title' in parsed ? { ...parsed.title, id } : { ...parsed, id };
      if (titleDoc.source === 'url' && titleDoc.sourceId) assertSupportedLinkType(titleDoc.sourceId);
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
        seasons: parsed.seasons,
        progress: progressMap,
      });
      res.json(broadcastMutation(mutation));
      scheduleEnrichment(id);
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/titles/:id', (req, res, next) => {
    try {
      const id = String(req.params.id);
      const patch = patchTitleRequestSchema.parse(req.body);
      res.json(broadcastMutation(repo.patchTitle(id, patch)));
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/titles/:id/actions', (req, res, next) => {
    try {
      const id = String(req.params.id);
      const parsed = titleAtomicActionRequestSchema.parse(req.body);
      res.json(broadcastMutation(repo.applyTitleAtomicAction(id, parsed)));
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/titles/:id', (req, res, next) => {
    try {
      const id = String(req.params.id);
      res.json(broadcastMutation(repo.deleteTitle(id)));
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/titles/:id/seasons', (req, res, next) => {
    try {
      const id = String(req.params.id);
      const parsed = putSeasonsRequestSchema.parse(req.body);
      const seasons = Array.isArray(parsed) ? parsed : parsed.seasons;
      res.json(broadcastMutation(repo.replaceSeasons(id, seasons)));
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/titles/:id/progress/:playthroughId', (req, res, next) => {
    try {
      const titleId = String(req.params.id);
      const playthroughId = String(req.params.playthroughId);
      const parsed = putProgressRequestSchema.parse(req.body);
      res.json(
        broadcastMutation(
          repo.putProgress(titleId, playthroughId, {
            watched: parsed.watched,
            movieWatchedAt: parsed.movieWatchedAt,
          })
        )
      );
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/titles/:id/progress/:playthroughId', (req, res, next) => {
    try {
      const titleId = String(req.params.id);
      const playthroughId = String(req.params.playthroughId);
      const parsed = patchProgressRequestSchema.parse(req.body);
      res.json(broadcastMutation(repo.patchProgress(titleId, playthroughId, parsed)));
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/titles/:id/progress/:playthroughId', (req, res, next) => {
    try {
      const titleId = String(req.params.id);
      const playthroughId = String(req.params.playthroughId);
      res.json(broadcastMutation(repo.deleteProgress(titleId, playthroughId)));
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/lists/:id', (req, res, next) => {
    try {
      const id = String(req.params.id);
      const parsed = putListRequestSchema.parse(req.body);
      res.json(broadcastMutation(repo.putList(id, parsed)));
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/lists/:id', (req, res, next) => {
    try {
      const id = String(req.params.id);
      const patch = patchListRequestSchema.parse(req.body);
      res.json(broadcastMutation(repo.patchList(id, patch)));
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/lists/:id', (req, res, next) => {
    try {
      const id = String(req.params.id);
      res.json(broadcastMutation(repo.deleteList(id)));
    } catch (err) {
      next(err);
    }
  });

  app.put('/api/lists/:id/entries/:entryId', (req, res, next) => {
    try {
      const listId = String(req.params.id);
      const entryId = String(req.params.entryId);
      const parsed = putListEntryRequestSchema.parse(req.body);
      res.json(broadcastMutation(repo.putListEntry(listId, entryId, parsed)));
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/lists/:id/entries/:entryId', (req, res, next) => {
    try {
      const listId = String(req.params.id);
      const entryId = String(req.params.entryId);
      const patch = patchListEntryRequestSchema.parse(req.body);
      res.json(broadcastMutation(repo.patchListEntry(listId, entryId, patch)));
    } catch (err) {
      next(err);
    }
  });

  app.delete('/api/lists/:id/entries/:entryId', (req, res, next) => {
    try {
      const listId = String(req.params.id);
      const entryId = String(req.params.entryId);
      res.json(broadcastMutation(repo.deleteListEntry(listId, entryId)));
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/settings', (req, res, next) => {
    try {
      const patch = patchSettingsRequestSchema.parse(req.body);
      res.json(broadcastMutation(repo.patchSettings(patch)));
    } catch (err) {
      next(err);
    }
  });

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
      res.json(broadcastMutation(repo.importData(parsed)));
    } catch (err) {
      next(err);
    }
  });
}
