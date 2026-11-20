import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager, MoreThan } from 'typeorm';
import { MailService } from '../mail/mail.service';
import { AccountStatus, User } from '../users/entities/user.entity';
import { Profile } from '../users/entities/profile.entity';
import { hashToken, randomToken } from './crypto.util';
import { AccountToken } from './entities/account-token.entity';
import { Session } from './entities/session.entity';
import { hashPassword, verifyPassword } from './password.util';
import { SessionsService } from './sessions.service';
import { RegisterDto, ResetPasswordDto } from './dto/password-auth.dto';
const invalidToken = () =>
  new BadRequestException({
    code: 'INVALID_TOKEN',
    message: 'Lien invalide ou expiré.',
  });

@Injectable()
export class PasswordAuthService {
  private readonly logger = new Logger(PasswordAuthService.name);
  constructor(
    private readonly db: DataSource,
    private readonly emails: MailService,
    private readonly sessions: SessionsService,
  ) {}
  async register(dto: RegisterDto) {
    const passwordHash = await hashPassword(dto.password);
    await this.db.transaction(async (manager) => {
      const result = await manager
        .getRepository(User)
        .createQueryBuilder()
        .insert()
        .values({ email: dto.email, passwordHash, emailVerifiedAt: null })
        .orIgnore()
        .returning('id')
        .execute();
      const id = (result.raw as { id: string }[])[0]?.id;
      if (!id) return; // Same generic response for an existing address; never replace its password.
      await manager.getRepository(Profile).insert({ userId: id });
      await this.issue(manager, id, 'confirm');
    });
  }
  async login(email: string, password: string) {
    const token = await this.db.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .createQueryBuilder('u')
        .addSelect('u.passwordHash')
        .where('lower(u.email) = :email', { email })
        .setLock('pessimistic_write')
        .getOne();
      const valid = await verifyPassword(password, user?.passwordHash);
      if (!valid || !user)
        throw new UnauthorizedException({
          code: 'INVALID_CREDENTIALS',
          message: 'Email ou mot de passe incorrect.',
        });
      if (user.status !== AccountStatus.ACTIVE)
        throw new ForbiddenException({
          code: 'ACCOUNT_BLOCKED',
          message: 'Ce compte est bloqué.',
        });
      if (!user.emailVerifiedAt)
        throw new ForbiddenException({
          code: 'EMAIL_NOT_CONFIRMED',
          message: 'Confirmez votre adresse email avant de vous connecter.',
        });
      return this.sessions.create(user, manager);
    });
    this.logger.log(JSON.stringify({ event: 'AUTH_LOGIN_SUCCEEDED' }));
    return token;
  }
  async forgotPassword(email: string) {
    await this.db.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .createQueryBuilder('u')
        .addSelect('u.passwordHash')
        .where('lower(u.email) = :email', { email })
        .setLock('pessimistic_write')
        .getOne();
      // Google-only accounts must not acquire a password through this route.
      if (
        !user?.passwordHash ||
        !user.emailVerifiedAt ||
        user.status !== AccountStatus.ACTIVE
      )
        return;
      await this.issue(manager, user.id, 'reset');
    });
  }
  async resendConfirmation(email: string) {
    await this.db.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .createQueryBuilder('u')
        .where('lower(u.email) = :email', { email })
        .setLock('pessimistic_write')
        .getOne();
      if (!user || user.emailVerifiedAt || user.status !== AccountStatus.ACTIVE)
        return;
      await this.issue(manager, user.id, 'confirm');
    });
  }
  async confirmEmail(token: string) {
    await this.consume(token, 'confirm', async (manager, user) => {
      await manager
        .getRepository(User)
        .update(user.id, { emailVerifiedAt: new Date() });
    });
  }
  async resetPassword(dto: ResetPasswordDto) {
    const passwordHash = await hashPassword(dto.password);
    await this.consume(dto.token, 'reset', async (manager, user) => {
      await manager.getRepository(User).update(user.id, { passwordHash });
      await manager
        .getRepository(Session)
        .update({ userId: user.id }, { revokedAt: new Date() });
    });
  }
  private async issue(
    manager: EntityManager,
    userId: string,
    purpose: 'confirm' | 'reset',
  ) {
    const token = randomToken();
    const expiresAt = new Date(
      Date.now() + (purpose === 'confirm' ? 24 * 3600 : 30 * 60) * 1000,
    );
    await manager.getRepository(AccountToken).delete({ userId, purpose });
    await manager
      .getRepository(AccountToken)
      .insert({ userId, purpose, tokenHash: hashToken(token), expiresAt });
    await this.emails.enqueueAccount(
      manager,
      purpose === 'confirm' ? 'account.confirm' : 'account.reset',
      userId,
      token,
      expiresAt,
    );
  }
  private async consume(
    token: string,
    purpose: 'confirm' | 'reset',
    action: (manager: EntityManager, user: User) => Promise<void>,
  ) {
    await this.db.transaction(async (manager) => {
      const tokens = manager.getRepository(AccountToken);
      const record = await tokens.findOneBy({
        tokenHash: hashToken(token),
        purpose,
        expiresAt: MoreThan(new Date()),
      });
      if (!record) throw invalidToken();
      const user = await manager.getRepository(User).findOne({
        where: { id: record.userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user || user.status !== AccountStatus.ACTIVE) throw invalidToken();
      const result = await tokens.delete({
        id: record.id,
        tokenHash: hashToken(token),
        expiresAt: MoreThan(new Date()),
      });
      if (!result.affected) throw invalidToken();
      await action(manager, user);
    });
  }
}
