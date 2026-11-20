import { MailModule } from '../mail/mail.module';
import { AccountToken } from './entities/account-token.entity';
import { PasswordAuthController } from './password-auth.controller';
import { PasswordAuthService } from './password-auth.service';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthConfig } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthThrottleGuard } from './auth-throttle.guard';
import { AuthRateLimit } from './entities/auth-rate-limit.entity';
import { OAuthTransaction } from './entities/oauth-transaction.entity';
import { Session } from './entities/session.entity';
import { GoogleIdentityProvider, GoogleOidcProvider } from './google.provider';
import { SessionGuard } from './session.guard';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Session,
      OAuthTransaction,
      AuthRateLimit,
      AccountToken,
    ]),
    UsersModule,
    MailModule,
  ],
  controllers: [AuthController, PasswordAuthController],
  providers: [
    AuthConfig,
    PasswordAuthService,
    AuthService,
    SessionsService,
    AuthThrottleGuard,
    { provide: GoogleIdentityProvider, useClass: GoogleOidcProvider },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [AuthConfig, SessionsService],
})
export class AuthModule {}
