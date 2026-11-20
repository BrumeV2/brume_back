/* eslint-disable @typescript-eslint/unbound-method */
import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { AuthConfig } from '../auth/auth.config';
import { SessionsService } from '../auth/sessions.service';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartResponseDto } from './dto/cart-response.dto';
import { MergeCartDto } from './dto/merge-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

describe('CartController', () => {
  let controller: CartController;
  let cartService: jest.Mocked<Partial<CartService>>;
  let sessionsService: jest.Mocked<Partial<SessionsService>>;

  const mockCartResponse: CartResponseDto = {
    id: '11111111-2222-3333-4444-555555555555',
    items: [],
    itemsCount: 0,
    itemsTotalCents: 0,
    ageRestricted: false,
    warnings: [],
    updatedAt: new Date().toISOString(),
  };

  const mockAuthConfig: Partial<AuthConfig> = {
    secure: false,
  };

  beforeEach(async () => {
    cartService = {
      addItem: jest.fn<any>().mockResolvedValue(mockCartResponse),
      getCart: jest.fn<any>().mockResolvedValue(mockCartResponse),
      merge: jest.fn<any>().mockResolvedValue(mockCartResponse),
      updateItem: jest.fn<any>().mockResolvedValue(mockCartResponse),
      removeItem: jest.fn<any>().mockResolvedValue(mockCartResponse),
    };

    sessionsService = {
      authenticate: jest
        .fn<any>()
        .mockRejectedValue(new Error('Unauthenticated')),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [
        { provide: CartService, useValue: cartService },
        { provide: AuthConfig, useValue: mockAuthConfig },
        { provide: SessionsService, useValue: sessionsService },
      ],
    }).compile();

    controller = module.get<CartController>(CartController);
  });

  const createMockReqRes = (cookie?: string, headerCartId?: string) => {
    const req = {
      headers: {
        ...(cookie ? { cookie: `brume_cart=${cookie}` } : {}),
        ...(headerCartId ? { 'x-cart-id': headerCartId } : {}),
      },
    } as unknown as Request;

    const res = {
      setHeader: jest.fn(),
      cookie: jest.fn(),
    } as unknown as Response;

    return { req, res };
  };

  it('utilise l identifiant de panier du cookie brume_cart s il est présent', async () => {
    const { req, res } = createMockReqRes('existing-cart-cookie');
    const dto: AddCartItemDto = { formatId: 'fmt-1', quantity: 2 };

    await controller.addItem(dto, req, res);

    expect(cartService.addItem).toHaveBeenCalledWith(
      'existing-cart-cookie',
      dto,
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Cart-Id',
      'existing-cart-cookie',
    );
    // Pas besoin de réécrire le cookie s'il existe déjà
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('utilise le header X-Cart-Id si le cookie est absent et positionne le cookie', async () => {
    const { req, res } = createMockReqRes(undefined, 'cart-from-header');
    const dto: AddCartItemDto = { formatId: 'fmt-1', quantity: 1 };

    await controller.addItem(dto, req, res);

    expect(cartService.addItem).toHaveBeenCalledWith('cart-from-header', dto);
    expect(res.setHeader).toHaveBeenCalledWith('X-Cart-Id', 'cart-from-header');
    expect(res.cookie).toHaveBeenCalledWith(
      'brume_cart',
      'cart-from-header',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
  });

  it('génère un nouvel identifiant de panier si aucun n est fourni', async () => {
    const { req, res } = createMockReqRes();

    await controller.getCart(req, res);

    expect(cartService.getCart).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'brume_cart',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('associe le panier au compte client si une session Google active est fournie', async () => {
    (sessionsService.authenticate as jest.Mock).mockResolvedValueOnce({
      user: { id: 'user-google-123' },
    });

    const req = {
      headers: {
        cookie: 'brume_session=valid-google-session-token',
      },
    } as unknown as Request;

    const res = {
      setHeader: jest.fn(),
      cookie: jest.fn(),
    } as unknown as Response;

    const dto: AddCartItemDto = { formatId: 'fmt-1', quantity: 1 };
    await controller.addItem(dto, req, res);

    expect(cartService.addItem).toHaveBeenCalledWith(
      'user:user-google-123',
      dto,
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Cart-Id',
      'user:user-google-123',
    );
  });

  it('fusionne le panier visiteur via POST /cart/merge', async () => {
    const { req, res } = createMockReqRes('cart-session-123');
    const mergeDto: MergeCartDto = {
      items: [{ formatId: 'fmt-1', quantity: 3 }],
    };

    await controller.merge(mergeDto, req, res);

    expect(cartService.merge).toHaveBeenCalledWith(
      'cart-session-123',
      mergeDto.items,
    );
  });

  it('modifie la quantité d une ligne de panier via PATCH /cart/items/:itemId', async () => {
    const { req, res } = createMockReqRes('cart-session-123');
    const updateDto: UpdateCartItemDto = { quantity: 4 };

    await controller.updateItem(
      '11111111-2222-3333-4444-555555555555',
      updateDto,
      req,
      res,
    );

    expect(cartService.updateItem).toHaveBeenCalledWith(
      'cart-session-123',
      '11111111-2222-3333-4444-555555555555',
      updateDto,
    );
  });

  it('supprime une ligne de panier via DELETE /cart/items/:itemId', async () => {
    const { req, res } = createMockReqRes('cart-session-123');

    await controller.removeItem(
      '11111111-2222-3333-4444-555555555555',
      req,
      res,
    );

    expect(cartService.removeItem).toHaveBeenCalledWith(
      'cart-session-123',
      '11111111-2222-3333-4444-555555555555',
    );
  });
});
