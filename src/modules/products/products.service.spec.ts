import { jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { Product } from './entities/product.entity';
import { CaffeineLevel } from './enums/caffeine-level.enum';
import { ConsumptionMoment } from './enums/consumption-moment.enum';
import { IngredientType } from './enums/ingredient-type.enum';
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
  const repository = {
    findAndCount:
      jest.fn<(options?: unknown) => Promise<[Partial<Product>[], number]>>(),
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
      repository.findAndCount.mockResolvedValue([[], 0]);
      repository.find.mockResolvedValue([]);

      await service.findCatalogue({ page: 3, limit: 10 });

      expect(repository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });

    it('charge les relations uniquement pour les produits de la page', async () => {
      repository.findAndCount.mockResolvedValue([
        [{ id: 'a' }, { id: 'b' }],
        2,
      ]);
      repository.find.mockResolvedValue([]);

      await service.findCatalogue({ page: 1, limit: 20 });

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: In(['a', 'b']) },
          relations: { ingredients: true },
        }),
      );
    });

    it('renvoie les champs du catalogue avec les noms des ingrédients', async () => {
      const product = buildProduct({
        ingredients: [
          { name: 'Thé noir Assam' },
          { name: 'Bergamote' },
        ] as Product['ingredients'],
      });
      repository.findAndCount.mockResolvedValue([[{ id: product.id }], 1]);
      repository.find.mockResolvedValue([product]);

      const result = await service.findCatalogue({ page: 1, limit: 20 });

      expect(result.data).toEqual([
        {
          id: 'product-1',
          name: 'Earl Grey',
          typeTea: 'noir',
          origin: 'Inde',
          ingredients: ['Thé noir Assam', 'Bergamote'],
          moment: ConsumptionMoment.MORNING,
          image: 'data:image/png;base64,AAAA',
        },
      ]);
      expect(result.data[0]).not.toHaveProperty('formats');
    });

    it('calcule les métadonnées de pagination à partir du total', async () => {
      repository.findAndCount.mockResolvedValue([[], 21]);
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
      repository.findAndCount.mockResolvedValue([[], 8]);
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
          },
          {
            id: 'f2',
            packaging: Packaging.BOX,
            quantity: 100,
            price: 990,
            stock: 0,
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
      repository.find.mockResolvedValue([]);

      await service.findSimilar('product-1');

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
      // `find` renvoie les produits dans un autre ordre que le score
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

      expect(repository.find).toHaveBeenCalledWith({
        where: { id: In(['b', 'c', 'a']) },
        relations: { ingredients: true },
      });
      expect(result.map((product) => product.id)).toEqual(['b', 'c', 'a']);
      expect(result[0]).toEqual({
        id: 'b',
        name: 'Thé b',
        typeTea: 'noir',
        origin: 'Inde',
        ingredients: ['Cannelle'],
        moment: ConsumptionMoment.MORNING,
        image: 'data:image/png;base64,AAAA',
      });
    });
  });
});
