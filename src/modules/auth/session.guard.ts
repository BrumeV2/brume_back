import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { IS_PUBLIC } from '../../common/decorators/public.decorator';
import type { User } from '../users/entities/user.entity';
import { AuthConfig } from './auth.config';
import { readCookie } from './crypto.util';
import { SessionsService } from './sessions.service';

export interface AuthenticatedRequest extends Request {
  user: User;
  sessionId: string;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsService,
    private readonly config: AuthConfig,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      if (
        request.headers['x-csrf-protection'] !== '1' ||
        !this.config.allowedOrigins.includes(request.headers.origin ?? '')
      ) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Origine ou protection CSRF invalide.',
        });
      }
    }
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const session = await this.sessions.authenticate(
      readCookie(request.headers.cookie, 'brume_session'),
    );
    request.user = session.user;
    request.sessionId = session.id;
    return true;
  }
}
