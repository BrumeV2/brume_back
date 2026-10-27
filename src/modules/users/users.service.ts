import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { AccountStatus, User } from './entities/user.entity';

export interface GoogleIdentity {
  sub: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export const authenticationFailed = () =>
  new UnauthorizedException({
    code: 'UNAUTHENTICATED',
    message: 'Authentification impossible.',
  });

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async resolveGoogle(identity: GoogleIdentity): Promise<User> {
    // ON CONFLICT handles concurrent inserts and both identity constraints.
    // An email collision with another sub never links the two identities.
    await this.users
      .createQueryBuilder()
      .insert()
      .values({
        id: randomUUID(),
        googleSub: identity.sub,
        email: identity.email,
        firstName: identity.firstName,
        lastName: identity.lastName,
        emailVerifiedAt: new Date(),
      })
      .orIgnore()
      .execute();
    const user = await this.users.findOneBy({ googleSub: identity.sub });
    if (!user || user.status !== AccountStatus.ACTIVE)
      throw authenticationFailed();
    // Google email changes do not change the identity or silently merge accounts.
    return user;
  }
}
