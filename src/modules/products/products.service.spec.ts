import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { Product } from './entities/product.entity';
import { CaffeineLevel } from './enums/caffeine-level.enum';
import { ConsumptionMoment } from './enums/consumption-moment.enum';
import { Packaging } from './enums/packaging.enum';
import { ProductsService } from './products.service';

function buildProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    name: 'Earl Grey',
    description: 'Thé noir à la bergamote',
    origin: 'Inde',
    typeTea: 'noir',
    image: 'data:image/png;base64,AAAA',
    howMuchCaffeine: CaffeineLevel.HIGH,
    moment: ConsumptionMoment.MORNING,
    ingredients: [],
    formats: [],
    boxes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ProductsService', () => {
  let service: ProductsService;
  const builder = {
    select: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    addOrderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getManyAndCount: jest.fn<() => Promise<[Partial<Product>[], number]>>(),
  };
  const repository = {
    createQueryBuilder: jest.fn(),
    find: jest.fn<(options?: unknown) => Promise<Product[]>>(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    repository.createQueryBuilder.mockReturnValue(builder);
    for (const method of [
      'select',
      'andWhere',
      'orderBy',
      'addOrderBy',
      'skip',
      'take',
    ] as const)
      builder[method].mockReturnValue(builder);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: repository },
      ],
    }).compile();

    service = module.get(ProductsService);
  });

  describe('findCatalogue', () => {
    it('pagine sur les produits avec skip/take calculés depuis page et limit', async () => {
      builder.getManyAndCount.mockResolvedValue([[], 0]);
      repository.find.mockResolvedValue([]);

      await service.findCatalogue({ page: 3, limit: 10 });

      expect(builder.skip).toHaveBeenCalledWith(20);
      expect(builder.take).toHaveBeenCalledWith(10);
    });

    it('charge les relations uniquement pour les produits de la page', async () => {
      builder.getManyAndCount.mockResolvedValue([
        [{ id: 'a' }, { id: 'b' }],
        2,
      ]);
      repository.find.mockResolvedValue([]);

      await service.findCatalogue({ page: 1, limit: 20 });

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: In(['a', 'b']) },
          relations: { ingredients: true, formats: true },
        }),
      );
    });

    it('renvoie les champs du catalogue avec les noms des ingrédients', async () => {
      const product = buildProduct({
        ingredients: [
          { name: 'Thé noir Assam' },
          { name: 'Bergamote' },
        ] as Product['ingredients'],
        formats: [
          {
            id: 'f1',
            packaging: Packaging.BAG,
            quantity: 50,
            price: 590,
            stock: 40,
          },
        ] as Product['formats'],
      });
      builder.getManyAndCount.mockResolvedValue([[{ id: product.id }], 1]);
      repository.find.mockResolvedValue([product]);

      const result = await service.findCatalogue({ page: 1, limit: 20 });

      expect(result.data).toEqual([
        {
          id: 'product-1',
          name: 'Earl Grey',
          typeTea: 'noir',
          origin: 'Inde',
          ingredients: ['Thé noir Assam', 'Bergamote'],
          price: 590,
          moment: ConsumptionMoment.MORNING,
          image: 'data:image/png;base64,AAAA',
          formats: [
            {
              id: 'f1',
              packaging: Packaging.BAG,
              quantity: 50,
              price: 590,
              stock: 40,
            },
          ],
        },
      ]);
    });

    it('trie les formats par prix puis grammage et expose le prix le plus bas', async () => {
      const product = buildProduct({
        formats: [
          {
            id: 'tin',
            packaging: Packaging.TIN,
            quantity: 150,
            price: 1390,
            stock: 1,
          },
          {
            id: 'box',
            packaging: Packaging.BOX,
            quantity: 100,
            price: 890,
            stock: 1,
          },
          {
            id: 'bag-100',
            packaging: Packaging.BAG,
            quantity: 100,
            price: 890,
            stock: 1,
          },
          {
            id: 'bag-50',
            packaging: Packaging.BAG,
            quantity: 50,
            price: 590,
            stock: 1,
          },
        ] as Product['formats'],
      });
      builder.getManyAndCount.mockResolvedValue([[{ id: product.id }], 1]);
      repository.find.mockResolvedValue([product]);

      const result = await service.findCatalogue({ page: 1, limit: 20 });

      expect(result.data[0].price).toBe(590);
      expect(result.data[0].formats.map((format) => format.price)).toEqual([
        590, 890, 890, 1390,
      ]);
      expect(result.data[0].formats.map((format) => format.quantity)).toEqual([
        50, 100, 100, 150,
      ]);
    });

    it('calcule les métadonnées de pagination à partir du total', async () => {
      builder.getManyAndCount.mockResolvedValue([[], 21]);
      repository.find.mockResolvedValue([]);

      const result = await service.findCatalogue({ page: 2, limit: 10 });

      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      });
    });

    it('renvoie une page vide sans erreur au-delà de la dernière page', async () => {
      builder.getManyAndCount.mockResolvedValue([[], 8]);
      repository.find.mockResolvedValue([]);

      const result = await service.findCatalogue({ page: 5, limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        page: 5,
        limit: 20,
        total: 8,
        totalPages: 1,
      });
    });
  });
});
