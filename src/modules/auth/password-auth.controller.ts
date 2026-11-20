import {
  Body,
  Controller,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiTags,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthConfig } from './auth.config';
import { AuthThrottleGuard } from './auth-throttle.guard';
import {
  EmailDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  TokenDto,
} from './dto/password-auth.dto';
import { PasswordAuthService } from './password-auth.service';
import { AccessTokenResponseDto } from './dto/access-token-response.dto';
import { ApiErrorDto } from '../../common/dto/api-error.dto';
const accepted = {
  message: 'Si la demande est applicable, un email vous sera envoyé.',
};
@ApiTags('auth')
@ApiHeader({ name: 'Origin', required: true })
@ApiHeader({ name: 'X-CSRF-Protection', required: true })
@Public()
@UseGuards(AuthThrottleGuard)
@Controller('auth')
export class PasswordAuthController {
  constructor(
    private readonly auth: PasswordAuthService,
    private readonly config: AuthConfig,
  ) {}
  @Post('register')
  @HttpCode(202)
  async register(@Body() dto: RegisterDto) {
    await this.auth.register(dto);
    return accepted;
  }
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: AccessTokenResponseDto })
  @ApiResponse({
    status: 401,
    type: ApiErrorDto,
    description: 'INVALID_CREDENTIALS',
  })
  @ApiResponse({
    status: 403,
    type: ApiErrorDto,
    description: 'EMAIL_NOT_CONFIRMED, ACCOUNT_BLOCKED ou CSRF_INVALID',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = await this.auth.login(dto.email, dto.password);
    response.cookie('brume_session', token, {
      httpOnly: true,
      secure: this.config.secure,
      sameSite: 'lax',
      path: '/api',
      maxAge: this.config.sessionTtl * 1000,
    });
    return {
      accessToken: token,
      tokenType: 'Bearer' as const,
      expiresIn: this.config.sessionTtl,
    };
  }
  @Post('forgot-password')
  @HttpCode(202)
  async forgotPassword(@Body() dto: EmailDto) {
    await this.auth.forgotPassword(dto.email);
    return accepted;
  }
  @Post('resend-confirmation')
  @HttpCode(202)
  async resendConfirmation(@Body() dto: EmailDto) {
    await this.auth.resendConfirmation(dto.email);
    return accepted;
  }
  @Post('reset-password')
  @HttpCode(204)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto);
  }
  @Post('confirm-email')
  @HttpCode(204)
  async confirmEmail(@Body() dto: TokenDto) {
    await this.auth.confirmEmail(dto.token);
  }
}
