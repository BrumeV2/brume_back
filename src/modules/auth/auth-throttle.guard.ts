import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { AuthConfig } from './auth.config';
import { hashToken } from './crypto.util';
import { AuthRateLimit } from './entities/auth-rate-limit.entity';

@Injectable()
export class AuthThrottleGuard implements CanActivate {
  constructor(
    @InjectRepository(AuthRateLimit)
    private readonly limits: Repository<AuthRateLimit>,
    private readonly config: AuthConfig,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const key = hashToken(
      `google:${request.ip ?? request.socket.remoteAddress ?? 'unknown'}`,
    );
    // No process-local map: this limit also works with multiple API instances.
    const rows: { attempts: number; retry_after: number }[] =
      await this.limits.query(
        `
      INSERT INTO auth_rate_limits (key_hash, attempts, expires_at)
      VALUES ($1, 1, now() + $2 * interval '1 second')
      ON CONFLICT (key_hash) DO UPDATE SET
        attempts = CASE WHEN auth_rate_limits.expires_at <= now() THEN 1 ELSE auth_rate_limits.attempts + 1 END,
        expires_at = CASE WHEN auth_rate_limits.expires_at <= now() THEN EXCLUDED.expires_at ELSE auth_rate_limits.expires_at END
      RETURNING attempts, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (expires_at - now()))))::int AS retry_after
    `,
        [key, this.config.rateWindow],
      );
    if (rows[0].attempts > this.config.rateLimit) {
      context
        .switchToHttp()
        .getResponse<Response>()
        .setHeader('Retry-After', rows[0].retry_after);
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          message: 'Trop de tentatives. Réessayez plus tard.',
        },
        429,
      );
    }
    return true;
  }
}
