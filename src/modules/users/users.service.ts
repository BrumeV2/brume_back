import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { AccountStatus, User } from './entities/user.entity';
import { Profile } from './entities/profile.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserResponseDto } from './dto/user-response.dto';

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

export function publicUser(
  user: User,
  profile?: Profile | null,
): UserResponseDto {
  const p = profile ?? user.profile;
  return {
    id: p?.id ?? user.id,
    userId: user.id,
    email: user.email,
    firstName: p?.firstName ?? null,
    lastName: p?.lastName ?? null,
    phone: p?.phone ?? null,
    address: p?.address ?? null,
    postalCode: p?.postalCode ?? null,
    city: p?.city ?? null,
    loyaltyPoints: p?.loyaltyPoints ?? 0,
    doNewsletter: p?.doNewsletter ?? false,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: p?.createdAt ?? user.createdAt,
    updatedAt: p?.updatedAt ?? user.updatedAt,
  };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Profile) private readonly profiles: Repository<Profile>,
  ) {}

  async resolveGoogle(identity: GoogleIdentity): Promise<User> {
    await this.users
      .createQueryBuilder()
      .insert()
      .values({
        id: randomUUID(),
        googleSub: identity.sub,
        email: identity.email,
        emailVerifiedAt: new Date(),
      })
      .orIgnore()
      .execute();

    const user = await this.users.findOne({
      where: { googleSub: identity.sub },
      relations: { profile: true },
    });

    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw authenticationFailed();
    }

    if (!user.profile) {
      await this.profiles
        .createQueryBuilder()
        .insert()
        .values({
          id: randomUUID(),
          userId: user.id,
          firstName: identity.firstName,
          lastName: identity.lastName,
          loyaltyPoints: 0,
          doNewsletter: false,
        })
        .orIgnore()
        .execute();

      const refreshedProfile = await this.profiles.findOneBy({
        userId: user.id,
      });
      if (refreshedProfile) {
        user.profile = refreshedProfile;
      }
    }

    return user;
  }

  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { profile: true },
    });

    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw authenticationFailed();
    }

    let profile = user.profile;
    if (!profile) {
      profile = await this.profiles.save(
        this.profiles.create({
          id: randomUUID(),
          userId: user.id,
          firstName: null,
          lastName: null,
          loyaltyPoints: 0,
          doNewsletter: false,
        }),
      );
      user.profile = profile;
    }

    return publicUser(user, profile);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const patch = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );

    if (!Object.keys(patch).length) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Renseigner au moins un champ.',
      });
    }

    const user = await this.users.findOne({
      where: { id: userId },
      relations: { profile: true },
    });

    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw authenticationFailed();
    }

    let profile = user.profile;
    if (!profile) {
      profile = this.profiles.create({
        id: randomUUID(),
        userId: user.id,
        loyaltyPoints: 0,
        doNewsletter: false,
      });
    }

    if ('firstName' in patch) {
      profile.firstName = patch.firstName as string;
    }
    if ('lastName' in patch) {
      profile.lastName = patch.lastName as string;
    }
    if ('phone' in patch) {
      profile.phone = patch.phone as string | null;
    }
    if ('address' in patch) {
      profile.address = patch.address as string | null;
    }
    if ('postalCode' in patch) {
      profile.postalCode = patch.postalCode as string | null;
    }
    if ('city' in patch) {
      profile.city = patch.city as string | null;
    }
    if ('doNewsletter' in patch) {
      profile.doNewsletter = Boolean(patch.doNewsletter);
    }

    const updatedProfile = await this.profiles.save(profile);
    return publicUser(user, updatedProfile);
  }
}
