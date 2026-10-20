import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export type RequestLocals = { requestId?: string };
const methods = new Set([
  'GET',
  'HEAD',
  'POST',
  'PATCH',
  'DELETE',
  'PUT',
  'OPTIONS',
]);

export function requestContext(
  logger: Pick<Logger, 'log'> = new Logger('HTTP'),
) {
  return (
    req: Request,
    res: Response<unknown, RequestLocals>,
    next: NextFunction,
  ) => {
    const requestId = randomUUID();
    const started = performance.now();
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('Cache-Control', 'no-store');
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      const route: unknown = req.route;
      const template =
        route &&
        typeof route === 'object' &&
        'path' in route &&
        typeof route.path === 'string'
          ? route.path
          : 'unmatched';
      logger.log({
        event: 'http_request',
        requestId,
        method: methods.has(req.method) ? req.method : 'OTHER',
        route: template,
        status: res.writableFinished ? res.statusCode : 499,
        durationMs: Math.round(performance.now() - started),
      });
    };
    res.once('finish', finish);
    res.once('close', finish);
    next();
  };
}
