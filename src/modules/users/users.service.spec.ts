import { jest } from '@jest/globals';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AccountStatus, Role, User } from './entities/user.entity';
import { Profile } from './entities/profile.entity';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepo: {
    findOne: jest.Mock<Repository<User>['findOne']>;
    createQueryBuilder: Repository<User>['createQueryBuilder'];
  };
  let profilesRepo: {
    findOneBy: jest.Mock<Repository<Profile>['findOneBy']>;
    save: jest.Mock<(profile: Profile) => Promise<Profile>>;
    create: jest.Mock<(attrs: Partial<Profile>) => Profile>;
    createQueryBuilder: Repository<Profile>['createQueryBuilder'];
  };

  const mockUser: User = {
    passwordHash: null,
    id: '11111111-1111-4111-8111-111111111111',
    googleSub: 'google-sub-123',
    email: 'test@example.com',
    role: Role.CUSTOMER,
    status: AccountStatus.ACTIVE,
    emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockProfile: Profile = {
    id: '22222222-2222-4222-8222-222222222222',
    userId: mockUser.id,
    user: mockUser,
    firstName: 'Camille',
    lastName: 'Martin',
    phone: '0612345678',
    address: '12 rue des Lilas',
    postalCode: '69003',
    city: 'Lyon',
    loyaltyPoints: 50,
    doNewsletter: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    usersRepo = {
      findOne: jest.fn<Repository<User>['findOne']>(),
      createQueryBuilder: jest.fn(() => ({
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
      })) as unknown as Repository<User>['createQueryBuilder'],
    };

    profilesRepo = {
      findOneBy: jest.fn<Repository<Profile>['findOneBy']>(),
      save: jest.fn<(profile: Profile) => Promise<Profile>>(),
      create: jest.fn((attrs: Partial<Profile>) => attrs as Profile),
      createQueryBuilder: jest.fn(() => ({
        insert: jest.fn().mockReturnThis(),
        values: jest.fn().mockReturnThis(),
        orIgnore: jest.fn().mockReturnThis(),
        execute: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
      })) as unknown as Repository<Profile>['createQueryBuilder'],
    };

    service = new UsersService(
      usersRepo as unknown as Repository<User>,
      profilesRepo as unknown as Repository<Profile>,
    );
  });

  describe('resolveGoogle', () => {
    it('initialise un profil avec prenom et nom lors de la premiere connexion Google', async () => {
      usersRepo.findOne.mockResolvedValueOnce({
        ...mockUser,
        profile: undefined,
      });
      profilesRepo.findOneBy.mockResolvedValueOnce(mockProfile);

      const user = await service.resolveGoogle({
        sub: 'google-sub-123',
        email: 'test@example.com',
        firstName: 'Camille',
        lastName: 'Martin',
      });

      expect(user.id).toBe(mockUser.id);
      expect(profilesRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('rejette si le compte est bloque', async () => {
      usersRepo.findOne.mockResolvedValueOnce({
        ...mockUser,
        status: AccountStatus.BLOCKED,
      });

      await expect(
        service.resolveGoogle({
          sub: 'google-sub-123',
          email: 'test@example.com',
          firstName: 'Camille',
          lastName: 'Martin',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('renvoie les informations combinees de User et Profile', async () => {
      usersRepo.findOne.mockResolvedValueOnce({
        ...mockUser,
        profile: mockProfile,
      });

      const result = await service.getProfile(mockUser.id);

      expect(result.id).toBe(mockProfile.id);
      expect(result.userId).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.firstName).toBe('Camille');
      expect(result.loyaltyPoints).toBe(50);
      expect(result.doNewsletter).toBe(false);
    });

    it('rejette si utilisateur inconnu ou bloque', async () => {
      usersRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getProfile('inconnu')).rejects.toThrow(
        UnauthorizedException,
      );

      usersRepo.findOne.mockResolvedValueOnce({
        ...mockUser,
        status: AccountStatus.BLOCKED,
      });
      await expect(service.getProfile(mockUser.id)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('updateProfile', () => {
    it('rejette un corps vide avec VALIDATION_ERROR (400)', async () => {
      await expect(service.updateProfile(mockUser.id, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('met a jour partiellement les champs autorises et persiste', async () => {
      usersRepo.findOne.mockResolvedValueOnce({
        ...mockUser,
        profile: { ...mockProfile },
      });

      profilesRepo.save.mockImplementationOnce((p) =>
        Promise.resolve({ ...p, updatedAt: new Date() }),
      );

      const dto: UpdateProfileDto = {
        firstName: 'NouveauPrenom',
        city: 'Marseille',
        doNewsletter: true,
      };

      const result = await service.updateProfile(mockUser.id, dto);

      expect(result.firstName).toBe('NouveauPrenom');
      expect(result.city).toBe('Marseille');
      expect(result.doNewsletter).toBe(true);
      expect(result.lastName).toBe('Martin');
      expect(result.loyaltyPoints).toBe(50);
      expect(profilesRepo.save).toHaveBeenCalled();
    });

    it('accepte null pour effacer le telephone ou l adresse', async () => {
      usersRepo.findOne.mockResolvedValueOnce({
        ...mockUser,
        profile: { ...mockProfile },
      });

      profilesRepo.save.mockImplementationOnce((p) =>
        Promise.resolve({ ...p }),
      );

      const dto: UpdateProfileDto = {
        phone: null,
        address: null,
      };

      const result = await service.updateProfile(mockUser.id, dto);

      expect(result.phone).toBeNull();
      expect(result.address).toBeNull();
    });

    it('ne permet pas d alterer loyaltyPoints', async () => {
      usersRepo.findOne.mockResolvedValueOnce({
        ...mockUser,
        profile: { ...mockProfile, loyaltyPoints: 50 },
      });

      profilesRepo.save.mockImplementationOnce((p) =>
        Promise.resolve({ ...p }),
      );

      // Injection d'une propriete interdite
      const dto = {
        firstName: 'Alex',
        loyaltyPoints: 99999,
      } as unknown as UpdateProfileDto;

      const result = await service.updateProfile(mockUser.id, dto);

      expect(result.loyaltyPoints).toBe(50);
    });
  });
});
