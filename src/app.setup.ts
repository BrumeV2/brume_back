import { BadRequestException, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { AuthConfig } from './modules/auth/auth.config';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import type { Express } from 'express';

export function configureApp(app: INestApplication) {
  const auth = app.get(AuthConfig);
  const server = app.getHttpAdapter().getInstance() as Express;
  server.set('trust proxy', auth.trustProxyHops);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: auth.allowedOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-CSRF-Protection'],
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false },
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Certains champs sont invalides.',
          details: flattenValidationErrors(errors),
        }),
    }),
  );
}

// Erreurs imbriquées (tableaux d'objets) exposées avec leur chemin : formats.0.sku
export function flattenValidationErrors(
  errors: ValidationError[],
  parent?: string,
): { field: string; constraints: string[] }[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.keys(error.constraints ?? {});
    return [
      ...(own.length || !error.children?.length
        ? [{ field, constraints: own }]
        : []),
      ...flattenValidationErrors(error.children ?? [], field),
    ];
  });
}
