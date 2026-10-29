import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 503;
    const body =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const safe =
      typeof body === 'object' && body !== null
        ? (body as {
            code?: string;
            message?: string | string[];
            details?: unknown;
          })
        : undefined;
    const defaults: Record<number, [string, string]> = {
      400: ['VALIDATION_ERROR', 'Requête invalide.'],
      401: ['UNAUTHENTICATED', 'Authentification impossible.'],
      403: ['FORBIDDEN', 'Accès refusé.'],
      404: ['NOT_FOUND', 'Ressource introuvable.'],
      429: ['RATE_LIMITED', 'Trop de tentatives.'],
    };
    const [code, message] = defaults[status] ?? [
      'AUTH_UNAVAILABLE',
      'Service indisponible. Réessayez.',
    ];
    response.status(status).setHeader('Cache-Control', 'no-store');
    // Do not serialize/log database errors, provider errors, request bodies or query strings.
    response.json({
      statusCode: status,
      code: safe?.code ?? code,
      message:
        safe?.code && typeof safe.message === 'string' ? safe.message : message,
      ...(status === 400 &&
      safe?.code === 'VALIDATION_ERROR' &&
      Array.isArray(safe.details)
        ? { details: safe.details }
        : {}),
      path: request.originalUrl.split('?')[0],
      timestamp: new Date().toISOString(),
    });
  }
}
