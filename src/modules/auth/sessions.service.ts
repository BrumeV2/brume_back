import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { AccountStatus, User } from '../users/entities/user.entity';
import { authenticationFailed } from '../users/users.service';
import { AuthConfig } from './auth.config';
import { hashToken, isToken, randomToken } from './crypto.util';
import { Session } from './entities/session.entity';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
    private readonly config: AuthConfig,
  ) {}

  async create(user: User) {
    const token = randomToken();
    await this.sessions.insert({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + this.config.sessionTtl * 1000),
    });
    return token;
  }

  async authenticate(token: string | undefined) {
    if (!isToken(token)) throw authenticationFailed();
    const session = await this.sessions.findOne({
      where: {
        tokenHash: hashToken(token),
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: { user: true },
    });
    if (!session || session.user.status !== AccountStatus.ACTIVE)
      throw authenticationFailed();
    return session;
  }

  async revoke(token: string | undefined) {
    if (!isToken(token)) return;
    await this.sessions.update(
      { tokenHash: hashToken(token), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
