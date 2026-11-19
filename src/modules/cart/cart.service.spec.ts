import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Box } from '../products/entities/box.entity';
import { ProductFormat } from '../products/entities/product-format.entity';
import { Product } from '../products/entities/product.entity';
import { Packaging } from '../products/enums/packaging.enum';
import { CartCacheService } from './cart-cache.service';
import { CartService } from './cart.service';

describe('CartService', () => {
  let service: CartService;
  let cacheService: CartCacheService;
  let formatRepo: jest.Mocked<Partial<Repository<ProductFormat>>>;
  let boxRepo: jest.Mocked<Partial<Repository<Box>>>;

  const mockProduct: Partial<Product> = {
    id: 'prod-1',
    name: 'Earl Grey Impérial',
    typeTea: 'noir',
    image: 'base64-image-data',
  };

  const mockFormat: ProductFormat = {
    id: 'fmt-1',
    product: mockProduct as Product,
    packaging: Packaging.BAG,
    quantity: 100,
    price: 1290,
    stock: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBox: Box = {
    id: 'box-1',
    name: 'Coffret Découverte',
    description: 'Assortiment de 4 thés',
    price: 3490,
    products: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    cacheService = new CartCacheService();

    formatRepo = {
      findOne: jest
        .fn<(...args: unknown[]) => Promise<ProductFormat | null>>()
        .mockImplementation((options: unknown) => {
          const query = options as { where?: { id?: string } } | undefined;
          if (query?.where?.id === 'fmt-1') {
            return Promise.resolve(mockFormat);
          }
          return Promise.resolve(null);
        }),
      find: jest
        .fn<(...args: unknown[]) => Promise<ProductFormat[]>>()
        .mockResolvedValue([mockFormat]),
    };

    boxRepo = {
      findOne: jest
        .fn<(...args: unknown[]) => Promise<Box | null>>()
        .mockImplementation((options: unknown) => {
          const query = options as { where?: { id?: string } } | undefined;
          if (query?.where?.id === 'box-1') {
            return Promise.resolve(mockBox);
          }
          return Promise.resolve(null);
        }),
      find: jest
        .fn<(...args: unknown[]) => Promise<Box[]>>()
        .mockResolvedValue([mockBox]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: CartCacheService, useValue: cacheService },
        { provide: getRepositoryToken(ProductFormat), useValue: formatRepo },
        { provide: getRepositoryToken(Box), useValue: boxRepo },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  afterEach(() => {
    cacheService.onModuleDestroy();
  });

  describe('Isolation des paniers (US-021)', () => {
    it('ajoute la même référence à deux paniers isolés sans collision', async () => {
      const cart1 = await service.addItem('cart-session-1', {
        formatId: 'fmt-1',
        quantity: 2,
      });

      const cart2 = await service.addItem('cart-session-2', {
        formatId: 'fmt-1',
        quantity: 3,
      });

      expect(cart1.id).toBe('cart-session-1');
      expect(cart1.itemsCount).toBe(2);
      expect(cart1.items[0].quantity).toBe(2);
      expect(cart1.itemsTotalCents).toBe(2 * 1290);

      expect(cart2.id).toBe('cart-session-2');
      expect(cart2.itemsCount).toBe(3);
      expect(cart2.items[0].quantity).toBe(3);
      expect(cart2.itemsTotalCents).toBe(3 * 1290);

      // Vérifie que les données brutes en cache sont bien étanches
      const raw1 = cacheService.get('cart-session-1');
      const raw2 = cacheService.get('cart-session-2');
      expect(raw1?.items[0].quantity).toBe(2);
      expect(raw2?.items[0].quantity).toBe(3);
    });
  });

  describe('Validation serveur du prix et du stock (US-021)', () => {
    it('rejette en 400 une tentative d ajout avec prix unitaire falsifié', async () => {
      await expect(
        service.addItem('cart-1', {
          formatId: 'fmt-1',
          quantity: 1,
          unitPrice: 100, // prix officiel = 1290
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepte l ajout si le prix envoyé correspond exactement au prix en base', async () => {
      const res = await service.addItem('cart-1', {
        formatId: 'fmt-1',
        quantity: 1,
        unitPrice: 1290,
      });

      expect(res.items[0].unitPriceCents).toBe(1290);
    });

    it('rejette en 409 une demande de quantité supérieure au stock disponible', async () => {
      await expect(
        service.addItem('cart-1', {
          formatId: 'fmt-1',
          quantity: 15, // stock = 10
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejette en 409 si les ajouts cumulés dépassent le stock', async () => {
      await service.addItem('cart-1', {
        formatId: 'fmt-1',
        quantity: 7, // stock = 10
      });

      await expect(
        service.addItem('cart-1', {
          formatId: 'fmt-1',
          quantity: 4, // 7 + 4 = 11 > 10
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejette en 404 si la référence de format n existe pas', async () => {
      await expect(
        service.addItem('cart-1', {
          formatId: 'non-existent-id',
          quantity: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Support des coffrets Box', () => {
    it('ajoute une box au panier avec validation de prix', async () => {
      const res = await service.addItem('cart-1', {
        boxId: 'box-1',
        quantity: 1,
      });

      expect(res.itemsCount).toBe(1);
      expect(res.items[0].itemType).toBe('box');
      expect(res.items[0].unitPriceCents).toBe(3490);
      expect(res.items[0].productName).toBe('Coffret Découverte');
    });

    it('rejette en 400 un prix de box falsifié', async () => {
      await expect(
        service.addItem('cart-1', {
          boxId: 'box-1',
          quantity: 1,
          unitPrice: 500, // officiel = 3490
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejette en 404 une box inexistante', async () => {
      await expect(
        service.addItem('cart-1', {
          boxId: 'unknown-box',
          quantity: 1,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Support des Cartes Cadeaux (GiftCard)', () => {
    it('ajoute une carte cadeau personnalisée au panier', async () => {
      const res = await service.addItem('cart-1', {
        giftCard: {
          amount: 5000,
          from: 'Camille',
          to: 'Dominique',
          message: 'Bonne dégustation !',
        },
        quantity: 1,
      });

      expect(res.itemsCount).toBe(1);
      expect(res.items[0].itemType).toBe('gift_card');
      expect(res.items[0].unitPriceCents).toBe(5000);
      expect(res.items[0].giftCard?.from).toBe('Camille');
      expect(res.items[0].giftCard?.message).toBe('Bonne dégustation !');
    });

    it('rejette un prix falsifié sur la carte cadeau', async () => {
      await expect(
        service.addItem('cart-1', {
          giftCard: {
            amount: 5000,
          },
          quantity: 1,
          unitPrice: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Validation des types de cibles', () => {
    it('rejette si aucun type d article n est spécifié', async () => {
      await expect(
        service.addItem('cart-1', {
          quantity: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejette si plusieurs types d articles sont spécifiés simultanément', async () => {
      await expect(
        service.addItem('cart-1', {
          formatId: 'fmt-1',
          boxId: 'box-1',
          quantity: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Contenu du cache (uniquement les données de ligne de commande)', () => {
    it('ne stocke en cache que les identifiants, quantités et montants nécessaires', async () => {
      await service.addItem('cart-cache-check', {
        formatId: 'fmt-1',
        quantity: 2,
      });

      const cachedCart = cacheService.get('cart-cache-check');
      expect(cachedCart).toBeDefined();
      expect(cachedCart?.items).toHaveLength(1);

      const line = cachedCart?.items[0];
      expect(line?.formatId).toBe('fmt-1');
      expect(line?.quantity).toBe(2);
      expect(line?.unitPrice).toBe(1290);
      const rawLine = line as unknown as Record<string, unknown>;
      expect(rawLine.name).toBeUndefined();
      expect(rawLine.description).toBeUndefined();
      expect(rawLine.image).toBeUndefined();
    });
  });
});
