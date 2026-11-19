import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { CatalogueQueryDto } from './dto/catalogue-query.dto';
import { Product } from './entities/product.entity';
import { CaffeineLevel } from './enums/caffeine-level.enum';
import { CatalogueSort } from './enums/catalogue-sort.enum';
import { ConsumptionMoment } from './enums/consumption-moment.enum';
import { IngredientType } from './enums/ingredient-type.enum';
import { Packaging } from './enums/packaging.enum';
import { ProductsService } from './products.service';

interface IndicatorsRow {
  id: string;
  lowestPrice: number | null;
  averageRating: string | null;
  ratingCount: string;
}

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
    profileProducts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ProductsService', () => {
  let service: ProductsService;
  const builder = {
    select: jest.fn(),
    addSelect: jest.fn(),
    setParameter: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    addOrderBy: jest.fn(),
    offset: jest.fn(),
    limit: jest.fn(),
    getCount: jest.fn<() => Promise<number>>(),
    getRawMany: jest.fn<() => Promise<IndicatorsRow[]>>(),
  };
  const row = (id: string, overrides: Partial<IndicatorsRow> = {}) => ({
    id,
    lowestPrice: 590,
    averageRating: null,
    ratingCount: '0',
    ...overrides,
  });
  const query = (overrides: Partial<CatalogueQueryDto> = {}) => ({
    page: 1,
    limit: 20,
    sort: CatalogueSort.NAME_ASC,
    ...overrides,
  });
  const repository = {
    createQueryBuilder: jest.fn(),
    find: jest.fn<(options?: unknown) => Promise<Product[]>>(),
    findOne: jest.fn<(options?: unknown) => Promise<Product | null>>(),
    existsBy: jest.fn<(where?: unknown) => Promise<boolean>>(),
    query:
      jest.fn<
        (sql: string, parameters?: unknown[]) => Promise<{ id: string }[]>
      >(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    repository.createQueryBuilder.mockReturnValue(builder);
    for (const method of [
      'select',
      'addSelect',
      'setParameter',
      'where',
      'andWhere',
      'addOrderBy',
      'offset',
      'limit',
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
    it('pagine sur les produits avec offset/limit calculés depuis page et limit', async () => {
      builder.getCount.mockResolvedValue(0);
      builder.getRawMany.mockResolvedValue([]);

      await service.findCatalogue(query({ page: 3, limit: 10 }));

      expect(builder.offset).toHaveBeenCalledWith(20);
      expect(builder.limit).toHaveBeenCalledWith(10);
    });

    it('charge les relations uniquement pour les produits de la page', async () => {
      builder.getCount.mockResolvedValue(2);
      builder.getRawMany.mockResolvedValue([row('a'), row('b')]);
      repository.find.mockResolvedValue([]);

      await service.findCatalogue(query());

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: In(['a', 'b']) },
          relations: { ingredients: true, formats: true },
        }),
      );
    });

    it('renvoie les champs du catalogue avec les noms des ingrédients et les indicateurs', async () => {
      const product = buildProduct({
        ingredients: [
          { name: 'Thé noir Assam' },
          { name: 'Bergamote' },
        ] as Product['ingredients'],
      });
      builder.getCount.mockResolvedValue(1);
      builder.getRawMany.mockResolvedValue([
        row(product.id, {
          lowestPrice: 590,
          averageRating: '4.3333333333333333',
          ratingCount: '3',
        }),
      ]);
      repository.find.mockResolvedValue([product]);

      const result = await service.findCatalogue(query());

      expect(result.data).toEqual([
        {
          id: 'product-1',
          name: 'Earl Grey',
          typeTea: 'noir',
          origin: 'Inde',
          ingredients: ['Thé noir Assam', 'Bergamote'],
          moment: ConsumptionMoment.MORNING,
          image: 'data:image/png;base64,AAAA',
          availability: 'OUT_OF_STOCK',
          isOrderable: false,
          lowestPrice: 590,
          averageRating: 4.3,
          ratingCount: 3,
        },
      ]);
      expect(result.data[0]).not.toHaveProperty('formats');
    });

    it('expose des indicateurs nuls pour un produit sans format ni note', async () => {
      builder.getCount.mockResolvedValue(1);
      builder.getRawMany.mockResolvedValue([
        row('product-1', { lowestPrice: null, averageRating: null }),
      ]);
      repository.find.mockResolvedValue([buildProduct()]);

      const [product] = (await service.findCatalogue(query())).data;

      expect(product).toMatchObject({
        lowestPrice: null,
        averageRating: null,
        ratingCount: 0,
      });
    });

    it("conserve l'ordre du tri SQL, pas celui de find", async () => {
      builder.getCount.mockResolvedValue(3);
      builder.getRawMany.mockResolvedValue([row('c'), row('a'), row('b')]);
      repository.find.mockResolvedValue(
        ['a', 'b', 'c'].map((id) => buildProduct({ id })),
      );

      const result = await service.findCatalogue(
        query({ sort: CatalogueSort.PRICE_ASC }),
      );

      expect(result.data.map((product) => product.id)).toEqual(['c', 'a', 'b']);
    });

    it.each([
      [CatalogueSort.NAME_ASC, [['product.name', 'ASC', undefined]]],
      [CatalogueSort.NAME_DESC, [['product.name', 'DESC', undefined]]],
      [
        CatalogueSort.PRICE_ASC,
        [
          ['"lowestPrice"', 'ASC', 'NULLS LAST'],
          ['product.name', 'ASC', undefined],
        ],
      ],
      [
        CatalogueSort.PRICE_DESC,
        [
          ['"lowestPrice"', 'DESC', 'NULLS LAST'],
          ['product.name', 'ASC', undefined],
        ],
      ],
      [
        CatalogueSort.NEWEST,
        [
          ['product.createdAt', 'DESC', undefined],
          ['product.name', 'ASC', undefined],
        ],
      ],
      [
        CatalogueSort.RATING_DESC,
        [
          ['"averageRating"', 'DESC', 'NULLS LAST'],
          ['"ratingCount"', 'DESC', undefined],
          ['product.name', 'ASC', undefined],
        ],
      ],
    ])(
      'trie %s avec des clés secondaires stables, UUID en dernier',
      async (sort, keys) => {
        builder.getCount.mockResolvedValue(0);
        builder.getRawMany.mockResolvedValue([]);

        await service.findCatalogue(query({ sort }));

        expect(builder.addOrderBy.mock.calls).toEqual([
          ...keys,
          ['product.id', 'ASC'],
        ]);
      },
    );

    it('calcule les métadonnées de pagination à partir du total', async () => {
      builder.getCount.mockResolvedValue(21);
      builder.getRawMany.mockResolvedValue([]);

      const result = await service.findCatalogue(query({ page: 2, limit: 10 }));

      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      });
    });

    it('renvoie une page vide sans erreur au-delà de la dernière page', async () => {
      builder.getCount.mockResolvedValue(8);
      builder.getRawMany.mockResolvedValue([]);

      const result = await service.findCatalogue(query({ page: 5 }));

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        page: 5,
        limit: 20,
        total: 8,
        totalPages: 1,
      });
    });
  });

  describe('findOne', () => {
    it('charge le produit avec ses ingrédients et ses formats, sans les box', async () => {
      repository.findOne.mockResolvedValue(
        buildProduct({
          formats: [
            { packaging: Packaging.BAG, quantity: 50, price: 590, stock: 1 },
          ] as Product['formats'],
        }),
      );

      await service.findOne('product-1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        relations: { ingredients: true, formats: true },
      });
    });

    it('renvoie toutes les informations de la fiche produit', async () => {
      const product = buildProduct({
        ingredients: [
          {
            id: 'i2',
            name: 'Huile essentielle de bergamote',
            description: 'Bergamote de Calabre',
            type: IngredientType.ESSENTIAL_OIL,
            price: 200,
          },
          {
            id: 'i1',
            name: 'Thé noir Assam',
            description: null,
            type: IngredientType.BASE,
            price: 380,
          },
        ] as Product['ingredients'],
        formats: [
          {
            id: 'f2',
            packaging: Packaging.BOX,
            quantity: 100,
            price: 990,
            stock: 0,
          },
          {
            id: 'f1',
            packaging: Packaging.BAG,
            quantity: 50,
            price: 590,
            stock: 40,
          },
        ] as Product['formats'],
      });
      repository.findOne.mockResolvedValue(product);

      const result = await service.findOne('product-1');

      expect(result).toEqual({
        id: 'product-1',
        availability: 'IN_STOCK',
        isOrderable: true,
        name: 'Earl Grey',
        description: 'Thé noir à la bergamote',
        typeTea: 'noir',
        origin: 'Inde',
        howMuchCaffeine: CaffeineLevel.HIGH,
        moment: ConsumptionMoment.MORNING,
        image: 'data:image/png;base64,AAAA',
        ingredients: [
          {
            id: 'i1',
            name: 'Thé noir Assam',
            description: null,
            type: IngredientType.BASE,
          },
          {
            id: 'i2',
            name: 'Huile essentielle de bergamote',
            description: 'Bergamote de Calabre',
            type: IngredientType.ESSENTIAL_OIL,
          },
        ],
        formats: [
          {
            id: 'f1',
            packaging: Packaging.BAG,
            quantity: 50,
            price: 590,
            stock: 40,
            availability: 'IN_STOCK',
            isOrderable: true,
          },
          {
            id: 'f2',
            packaging: Packaging.BOX,
            quantity: 100,
            price: 990,
            stock: 0,
            availability: 'OUT_OF_STOCK',
            isOrderable: false,
          },
        ],
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      });
      expect(result).not.toHaveProperty('boxes');
    });

    it('lève une 404 si le produit est introuvable', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne('inconnu')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findSimilar', () => {
    it('lève une 404 si le produit est introuvable, sans calculer de score', async () => {
      repository.existsBy.mockResolvedValue(false);

      await expect(service.findSimilar('inconnu')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.query).not.toHaveBeenCalled();
    });

    it('calcule le score avec les poids, en excluant la base, et limite à 3', async () => {
      repository.existsBy.mockResolvedValue(true);
      repository.query.mockResolvedValue([]);

      expect(await service.findSimilar('product-1')).toEqual([]);

      expect(repository.query).toHaveBeenCalledWith(expect.any(String), [
        'product-1',
        3,
        IngredientType.BASE,
        2,
        3,
      ]);
    });

    it("renvoie les produits au format catalogue, dans l'ordre du score", async () => {
      repository.existsBy.mockResolvedValue(true);
      repository.query.mockResolvedValue([
        { id: 'b' },
        { id: 'c' },
        { id: 'a' },
      ]);
      // les indicateurs et `find` renvoient les produits dans un autre ordre que le score
      builder.getRawMany.mockResolvedValue([row('a'), row('c'), row('b')]);
      repository.find.mockResolvedValue(
        ['a', 'b', 'c'].map((id) =>
          buildProduct({
            id,
            name: `Thé ${id}`,
            ingredients: [{ name: 'Cannelle' }] as Product['ingredients'],
          }),
        ),
      );

      const result = await service.findSimilar('product-1');

      expect(builder.where).toHaveBeenCalledWith('product.id IN (:...ids)', {
        ids: ['b', 'c', 'a'],
      });
      expect(result.map((product) => product.id)).toEqual(['b', 'c', 'a']);
      expect(result[0]).toEqual({
        id: 'b',
        availability: 'OUT_OF_STOCK',
        isOrderable: false,
        name: 'Thé b',
        typeTea: 'noir',
        origin: 'Inde',
        ingredients: ['Cannelle'],
        moment: ConsumptionMoment.MORNING,
        image: 'data:image/png;base64,AAAA',
        lowestPrice: 590,
        averageRating: null,
        ratingCount: 0,
      });
    });
  });
});
