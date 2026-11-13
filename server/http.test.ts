import express from 'express';
import type { AddressInfo } from 'node:net';
import { expect, test } from 'vitest';
import { route, sendApiError } from './http.ts';

test('a rejected or throwing handler reaches the error middleware instead of crashing the process', async () => {
  const app = express();
  app.get(
    '/rejects',
    route(async () => {
      throw new Error('async failure');
    }),
  );
  app.get(
    '/throws',
    route(() => {
      throw new Error('sync failure');
    }),
  );
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    sendApiError(res, 500, 'INTERNAL_ERROR', { handled: true });
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
    for (const path of ['/rejects', '/throws']) {
      const res = await fetch(base + path);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ code: 'INTERNAL_ERROR', handled: true });
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
