import type { Request, RequestHandler, Response } from 'express';
import type { ServerErrorCode } from '../src/domain/types.ts';

/** Errors are stable codes that the client translates; the server never sends user-facing text. */
export function sendApiError(
  res: Response,
  status: number,
  code: ServerErrorCode,
  extra: Record<string, unknown> = {},
): void {
  res.status(status).json({ code, ...extra });
}

/**
 * Wrap a handler so that a thrown error or a rejected promise reaches the error middleware.
 * Express 4 ignores promises returned by handlers; an unhandled rejection would stop the process.
 */
export function route(handler: (req: Request, res: Response) => unknown): RequestHandler {
  return (req, res, next) => {
    try {
      Promise.resolve(handler(req, res)).catch(next);
    } catch (err) {
      next(err);
    }
  };
}
