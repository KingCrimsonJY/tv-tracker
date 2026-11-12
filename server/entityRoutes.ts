import type { Express } from 'express';
import { toLocalDateString } from '../src/domain/airing.ts';
import {
  importPayloadSchema,
  patchListEntryRequestSchema,
  patchListRequestSchema,
  patchSettingsRequestSchema,
  patchTitleRequestSchema,
  putListEntryRequestSchema,
  putListRequestSchema,
  putSeasonsRequestSchema,
  putTitleRequestSchema,
  titleAtomicActionRequestSchema,
} from '../src/domain/schemas.ts';
import type { ProgressDoc, StateMutationResult } from '../src/domain/types.ts';
import type { TrackerRepository } from './db/repository.ts';
import { route, sendApiError } from './http.ts';
import { assertSupportedLinkType } from './providers/linkScope.ts';

/** Every write answers with the mutation it broadcast, so the sender and other devices apply the same change. */
export function registerEntityRoutes(
  app: Express,
  repo: TrackerRepository,
  broadcastMutation: (mutation: StateMutationResult) => StateMutationResult,
  scheduleEnrichment: (id: string) => void = () => {},
): void {
  const param = (req: { params: Record<string, string> }, name: string) => String(req.params[name]);

  app.get(
    '/api/titles/:id/details',
    route((req, res) => {
      const id = param(req, 'id');
      if (!repo.getTitle(id)) {
        sendApiError(res, 404, 'TITLE_NOT_FOUND');
        return;
      }
      res.setHeader('Cache-Control', 'private, no-cache');
      res.json({ seasons: repo.getSeasons(id) });
    }),
  );

  app.put(
    '/api/titles/:id',
    route((req, res) => {
      const id = param(req, 'id');
      const parsed = putTitleRequestSchema.parse(req.body);
      const title = 'title' in parsed ? { ...parsed.title, id } : { ...parsed, id };
      if (title.source === 'url' && title.sourceId) assertSupportedLinkType(title.sourceId);
      // v1 clients sent one progress document; current clients send a map keyed by playthrough.
      const progress =
        parsed.progress && 'watched' in parsed.progress && typeof parsed.progress.playthroughId === 'string'
          ? { [parsed.progress.playthroughId]: parsed.progress as ProgressDoc }
          : (parsed.progress as Record<string, ProgressDoc> | undefined);
      res.json(broadcastMutation(repo.putTitle(id, { title, seasons: parsed.seasons, progress })));
      scheduleEnrichment(id);
    }),
  );

  app.patch(
    '/api/titles/:id',
    route((req, res) => {
      res.json(broadcastMutation(repo.patchTitle(param(req, 'id'), patchTitleRequestSchema.parse(req.body))));
    }),
  );

  app.post(
    '/api/titles/:id/actions',
    route((req, res) => {
      const input = titleAtomicActionRequestSchema.parse(req.body);
      res.json(broadcastMutation(repo.applyTitleAtomicAction(param(req, 'id'), input)));
    }),
  );

  app.delete(
    '/api/titles/:id',
    route((req, res) => {
      res.json(broadcastMutation(repo.deleteTitle(param(req, 'id'))));
    }),
  );

  app.put(
    '/api/titles/:id/seasons',
    route((req, res) => {
      const parsed = putSeasonsRequestSchema.parse(req.body);
      const seasons = Array.isArray(parsed) ? parsed : parsed.seasons;
      res.json(broadcastMutation(repo.replaceSeasons(param(req, 'id'), seasons)));
    }),
  );

  app.put(
    '/api/lists/:id',
    route((req, res) => {
      res.json(broadcastMutation(repo.putList(param(req, 'id'), putListRequestSchema.parse(req.body))));
    }),
  );

  app.patch(
    '/api/lists/:id',
    route((req, res) => {
      res.json(broadcastMutation(repo.patchList(param(req, 'id'), patchListRequestSchema.parse(req.body))));
    }),
  );

  app.delete(
    '/api/lists/:id',
    route((req, res) => {
      res.json(broadcastMutation(repo.deleteList(param(req, 'id'))));
    }),
  );

  app.put(
    '/api/lists/:id/entries/:entryId',
    route((req, res) => {
      const entry = putListEntryRequestSchema.parse(req.body);
      res.json(broadcastMutation(repo.putListEntry(param(req, 'id'), param(req, 'entryId'), entry)));
    }),
  );

  app.patch(
    '/api/lists/:id/entries/:entryId',
    route((req, res) => {
      const patch = patchListEntryRequestSchema.parse(req.body);
      res.json(broadcastMutation(repo.patchListEntry(param(req, 'id'), param(req, 'entryId'), patch)));
    }),
  );

  app.delete(
    '/api/lists/:id/entries/:entryId',
    route((req, res) => {
      res.json(broadcastMutation(repo.deleteListEntry(param(req, 'id'), param(req, 'entryId'))));
    }),
  );

  app.patch(
    '/api/settings',
    route((req, res) => {
      res.json(broadcastMutation(repo.patchSettings(patchSettingsRequestSchema.parse(req.body))));
    }),
  );

  app.get(
    '/api/export',
    route((_req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="zhenji-${toLocalDateString()}.json"`);
      res.send(JSON.stringify(repo.exportData(), null, 2));
    }),
  );

  app.post(
    '/api/import',
    route((req, res) => {
      res.json(broadcastMutation(repo.importData(importPayloadSchema.parse(req.body))));
    }),
  );
}
