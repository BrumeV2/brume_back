import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AccountStatus, Role, User } from './entities/user.entity';
import { UserResponseDto } from './dto/user-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<Partial<UsersService>>;

  const mockUser: User = {
    id: '11111111-1111-4111-8111-111111111111',
    googleSub: 'google-sub-123',
    email: 'test@example.com',
    role: Role.CUSTOMER,
    status: AccountStatus.ACTIVE,
    emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  const mockProfileResponse: UserResponseDto = {
    id: '22222222-2222-4222-8222-222222222222',
    userId: mockUser.id,
    email: mockUser.email,
    firstName: 'Camille',
    lastName: 'Martin',
    phone: '0612345678',
    address: '12 rue des Lilas',
    postalCode: '69003',
    city: 'Lyon',
    loyaltyPoints: 0,
    doNewsletter: false,
    role: Role.CUSTOMER,
    status: AccountStatus.ACTIVE,
    emailVerifiedAt: mockUser.emailVerifiedAt,
    createdAt: mockUser.createdAt,
    updatedAt: mockUser.updatedAt,
  };

  beforeEach(async () => {
    service = {
      getProfile: jest
        .fn<UsersService['getProfile']>()
        .mockResolvedValue(mockProfileResponse),
      updateProfile: jest
        .fn<UsersService['updateProfile']>()
        .mockResolvedValue(mockProfileResponse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: service }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe('me', () => {
    it('appelle getProfile avec l identifiant de l utilisateur connecte', async () => {
      const response = await controller.me(mockUser);
      expect(service.getProfile).toHaveBeenCalledWith(mockUser.id);
      expect(response).toEqual(mockProfileResponse);
    });
  });

  describe('updateMe', () => {
    it('appelle updateProfile avec le DTO et renvoie le profil mis a jour', async () => {
      const dto: UpdateProfileDto = { firstName: 'Camille' };
      const response = await controller.updateMe(mockUser, dto);
      expect(service.updateProfile).toHaveBeenCalledWith(mockUser.id, dto);
      expect(response).toEqual(mockProfileResponse);
    });
  });
});
