import { jest } from '@jest/globals';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { DataSource, EntityManager } from 'typeorm';
import { AdminProductsService } from './admin-products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Ingredient } from './entities/ingredient.entity';
import { Product } from './entities/product.entity';
import { CaffeineLevel } from './enums/caffeine-level.enum';
import { ConsumptionMoment } from './enums/consumption-moment.enum';
import { IngredientType } from './enums/ingredient-type.enum';
import { Packaging } from './enums/packaging.enum';

const USER_ID = '00000000-0000-4000-8000-0000000000aa';
const BASE_ID = '00000000-0000-4000-8000-000000000001';
const FLAVOR_ID = '00000000-0000-4000-8000-000000000002';

const ingredient = (id: string, name: string, type: IngredientType) =>
  ({ id, name, type }) as Ingredient;

function dto(overrides: Partial<CreateProductDto> = {}): CreateProductDto {
  return {
    name: 'Assam Bergamote',
    description: null,
    origin: 'Inde',
    typeTea: 'noir',
    image: null,
    howMuchCaffeine: CaffeineLevel.HIGH,
    moment: ConsumptionMoment.MORNING,
    published: false,
    ingredientIds: [FLAVOR_ID, BASE_ID],
    formats: [
      {
        sku: 'ASSAM-TIN-150',
        packaging: Packaging.TIN,
        quantity: 150,
        price: 2490,
        stock: 4,
      },
      {
        sku: 'ASSAM-BAG-50',
        packaging: Packaging.BAG,
        quantity: 50,
        price: 590,
        stock: 0,
      },
    ],
    ...overrides,
  };
}

describe('AdminProductsService.create', () => {
  const manager = {
    findBy: jest.fn<(entity: unknown, where: unknown) => Promise<unknown[]>>(),
    find: jest.fn<(entity: unknown, options: unknown) => Promise<unknown[]>>(),
    create: jest.fn((_entity: unknown, data: object) => ({ ...data })),
    save: jest.fn<(entity: Product) => Promise<Product>>(),
  };
  const dataSource = {
    transaction: jest.fn((work: (manager: EntityManager) => Promise<unknown>) =>
      work(manager as unknown as EntityManager),
    ),
  };
  const service = new AdminProductsService(dataSource as unknown as DataSource);

  beforeEach(() => {
    jest.clearAllMocks();
    manager.findBy.mockResolvedValue([
      ingredient(FLAVOR_ID, 'Bergamote', IngredientType.ESSENTIAL_OIL),
      ingredient(BASE_ID, 'Thé noir Assam', IngredientType.BASE),
    ]);
    manager.find.mockResolvedValue([]);
    manager.save.mockImplementation((product) =>
      Promise.resolve({
        ...product,
        id: 'new-product',
        createdAt: new Date('2026-11-19T10:00:00Z'),
        updatedAt: new Date('2026-11-19T10:00:00Z'),
        formats: product.formats.map((format, index) => ({
          ...format,
          id: `format-${index}`,
        })),
      }),
    );
  });

  it('crée un brouillon complet dans une transaction et trace son auteur', async () => {
    const result = await service.create(dto(), USER_ID);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.save).toHaveBeenCalledTimes(1);
    const saved = manager.save.mock.calls[0][0];
    expect(saved).toMatchObject({
      name: 'Assam Bergamote',
      published: false,
      createdById: USER_ID,
    });
    expect(saved.formats).toHaveLength(2);
    expect(saved.ingredients).toHaveLength(2);

    expect(result).toMatchObject({
      id: 'new-product',
      published: false,
      createdById: USER_ID,
    });
    // base d'abord, formats du moins cher au plus cher
    expect(result.ingredients.map((item) => item.name)).toEqual([
      'Thé noir Assam',
      'Bergamote',
    ]);
    expect(result.formats.map((format) => format.sku)).toEqual([
      'ASSAM-BAG-50',
      'ASSAM-TIN-150',
    ]);
  });

  it('conserve l’état publié demandé', async () => {
    const result = await service.create(dto({ published: true }), USER_ID);
    expect(result.published).toBe(true);
  });

  it('refuse un ingrédient introuvable sans rien enregistrer', async () => {
    manager.findBy.mockResolvedValue([
      ingredient(BASE_ID, 'Thé noir Assam', IngredientType.BASE),
    ]);
    await expect(service.create(dto(), USER_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('refuse une référence déjà utilisée en désignant le format', async () => {
    manager.find.mockResolvedValue([{ id: 'other', sku: 'ASSAM-BAG-50' }]);
    const error: unknown = await service
      .create(dto(), USER_ID)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ field: 'formats.1.sku', constraints: ['unique'] }],
    });
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('convertit une violation concurrente de l’unicité en 409', async () => {
    const violation = new QueryFailedError('INSERT', [], {
      code: '23505',
      constraint: 'UQ_product_formats_sku',
    } as unknown as Error);
    manager.save.mockRejectedValue(violation);
    await expect(service.create(dto(), USER_ID)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('laisse remonter les autres erreurs de base', async () => {
    const failure = new QueryFailedError('INSERT', [], {
      code: '23503',
    } as unknown as Error);
    manager.save.mockRejectedValue(failure);
    await expect(service.create(dto(), USER_ID)).rejects.toBe(failure);
  });
});
