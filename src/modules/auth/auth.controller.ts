import {
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthConfig } from './auth.config';
import { AuthService } from './auth.service';
import { AuthThrottleGuard } from './auth-throttle.guard';
import { readCookie } from './crypto.util';
import { SessionsService } from './sessions.service';
import { ApiErrorDto } from '../../common/dto/api-error.dto';

@ApiTags('auth')
@ApiResponse({
  status: 503,
  type: ApiErrorDto,
  description: 'AUTH_UNAVAILABLE',
})
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    private readonly config: AuthConfig,
  ) {}

  private cookie(path: string, maxAge?: number): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.secure,
      sameSite: 'lax',
      path,
      ...(maxAge === undefined ? {} : { maxAge }),
    };
  }

  @Get('google')
  @UseGuards(AuthThrottleGuard)
  @ApiResponse({ status: 429, type: ApiErrorDto, description: 'RATE_LIMITED' })
  @ApiResponse({
    status: 302,
    description: 'Redirection vers Google, cookie temporaire brume_oauth.',
    headers: {
      Location: { schema: { type: 'string', format: 'uri' } },
      'Set-Cookie': { schema: { type: 'string' } },
    },
  })
  async start(@Res() response: Response) {
    const { browser, location } = await this.auth.start();
    response.cookie(
      'brume_oauth',
      browser,
      this.cookie('/api/auth', this.config.transactionTtl * 1000),
    );
    response.redirect(location);
  }

  @Get('google/callback')
  @UseGuards(AuthThrottleGuard)
  @ApiQuery({
    name: 'state',
    required: false,
    schema: { type: 'string', maxLength: 128 },
  })
  @ApiQuery({
    name: 'code',
    required: false,
    schema: { type: 'string', maxLength: 4096 },
  })
  @ApiQuery({
    name: 'error',
    required: false,
    schema: { type: 'string', maxLength: 255 },
  })
  @ApiResponse({
    status: 401,
    type: ApiErrorDto,
    description: 'UNAUTHENTICATED',
  })
  @ApiResponse({ status: 429, type: ApiErrorDto, description: 'RATE_LIMITED' })
  @ApiResponse({
    status: 302,
    description: 'Session créée, redirection vers AUTH_SUCCESS_URL.',
    headers: {
      Location: { schema: { type: 'string', format: 'uri' } },
      'Set-Cookie': { schema: { type: 'string' } },
    },
  })
  async callback(
    @Req() request: Request,
    @Query() query: Record<string, unknown>,
    @Res() response: Response,
  ) {
    // Always discard the temporary cookie, including a denied or failed login.
    response.clearCookie('brume_oauth', this.cookie('/api/auth'));
    const token = await this.auth.finish(
      readCookie(request.headers.cookie, 'brume_oauth'),
      query,
    );
    response.cookie(
      'brume_session',
      token,
      this.cookie('/api', this.config.sessionTtl * 1000),
    );
    response.redirect(this.config.successUrl);
  }

  @Post('logout')
  @ApiCookieAuth('sessionCookie')
  @ApiHeader({
    name: 'Origin',
    required: true,
    schema: { type: 'string', format: 'uri' },
  })
  @ApiResponse({ status: 403, type: ApiErrorDto, description: 'FORBIDDEN' })
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  @ApiHeader({
    name: 'X-CSRF-Protection',
    required: true,
    schema: { type: 'string', enum: ['1'] },
  })
  @ApiNoContentResponse({
    description: 'Session courante révoquée, cookie effacé.',
  })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.sessions.revoke(
      readCookie(request.headers.cookie, 'brume_session'),
    );
    // Do not confirm logout or clear the cookie if persistence failed.
    response.clearCookie('brume_session', this.cookie('/api'));
  }
}
