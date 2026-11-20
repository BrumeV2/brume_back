import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { requestContext } from '../logging/request-logging';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);
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
      409: ['CONFLICT', 'Opération incompatible avec l’état actuel.'],
      429: ['RATE_LIMITED', 'Trop de tentatives.'],
    };
    const path = request.originalUrl.split('?')[0];
    const unavailableCode =
      path.startsWith('/api/auth/') || path.startsWith('/api/users/')
        ? 'AUTH_UNAVAILABLE'
        : path.startsWith('/api/admin/mails')
          ? 'MAIL_UNAVAILABLE'
          : 'SERVICE_UNAVAILABLE';
    const [code, message] = defaults[status] ?? [
      unavailableCode,
      'Service indisponible. Réessayez.',
    ];
    const context = requestContext(request, response);
    const driverCode = (
      exception as { driverError?: { code?: unknown } } | null
    )?.driverError?.code;
    const entry = JSON.stringify({
      event: 'HTTP_ERROR',
      ...context,
      status,
      code: safe?.code ?? code,
      ...(typeof driverCode === 'string' && /^[A-Z0-9]{5}$/.test(driverCode)
        ? { databaseCode: driverCode }
        : {}),
    });
    if (status >= 500) this.logger.error(entry);
    else this.logger.warn(entry);
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
      path,
      requestId: context.requestId,
      timestamp: new Date().toISOString(),
    });
  }
}
