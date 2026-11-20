import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export function requestContext(request: Request, response: Response) {
  let requestId = response.getHeader('X-Request-ID');
  if (typeof requestId !== 'string') {
    requestId = randomUUID();
    response.setHeader('X-Request-ID', requestId);
  }
  const route = (request.route as { path?: unknown } | undefined)?.path;
  // Route templates only: never log query strings, arbitrary URLs, headers or bodies.
  return {
    requestId,
    method: request.method,
    route: typeof route === 'string' ? route : 'unmatched',
  };
}
const logger = new Logger('HttpRequest');
export function logRequest(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const started = Date.now();
  requestContext(request, response);
  response.once('finish', () =>
    logger.log(
      JSON.stringify({
        event: 'HTTP_REQUEST',
        ...requestContext(request, response),
        status: response.statusCode,
        durationMs: Date.now() - started,
      }),
    ),
  );
  next();
}
