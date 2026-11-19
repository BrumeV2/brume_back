import { Availability } from '../src/modules/products/availability/availability';
import { jest } from '@jest/globals';
import { AvailabilityService } from '../src/modules/products/availability/availability.service';
import { FormatAvailabilityDto } from '../src/modules/products/dto/availability.dto';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject, SchemaObject } from '@nestjs/swagger';
import { CatalogueFiltersDto } from '../src/modules/products/dto/catalogue-filters.dto';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { configureApp } from '../src/app.setup';
import { CreateGoogleAccountsAndSessions1793109589589 } from '../src/database/migrations/1793109589589-CreateGoogleAccountsAndSessions';
import { CreateCatalogue1793272229451 } from '../src/database/migrations/1793272229451-CreateCatalogue';
import { ReplaceAddressesWithProfiles1793280000000 } from '../src/database/migrations/1793280000000-ReplaceAddressesWithProfiles';
import { CreateProfileProducts1794926453490 } from '../src/database/migrations/1794926453490-CreateProfileProducts';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthRateLimit } from '../src/modules/auth/entities/auth-rate-limit.entity';
import { OAuthTransaction } from '../src/modules/auth/entities/oauth-transaction.entity';
import { Session } from '../src/modules/auth/entities/session.entity';
import { CataloguePageDto } from '../src/modules/products/dto/catalogue-page.dto';
import { CatalogueProductDto } from '../src/modules/products/dto/catalogue-product.dto';
import { ProductDetailDto } from '../src/modules/products/dto/product-detail.dto';
import { Box } from '../src/modules/products/entities/box.entity';
import { Ingredient } from '../src/modules/products/entities/ingredient.entity';
import { ProductFormat } from '../src/modules/products/entities/product-format.entity';
import { Product } from '../src/modules/products/entities/product.entity';
import { ProfileProduct } from '../src/modules/products/entities/profile-product.entity';
import { CaffeineLevel } from '../src/modules/products/enums/caffeine-level.enum';
import { ProfileProductType } from '../src/modules/products/enums/profile-product-type.enum';
import { ConsumptionMoment } from '../src/modules/products/enums/consumption-moment.enum';
import { IngredientType } from '../src/modules/products/enums/ingredient-type.enum';
import { Packaging } from '../src/modules/products/enums/packaging.enum';
import { ProductsModule } from '../src/modules/products/products.module';
import { Profile } from '../src/modules/users/entities/profile.entity';
import { User } from '../src/modules/users/entities/user.entity';

interface ValidationError {
  code: string;
  details: { field: string; constraints: string[] }[];
}

describe('Catalogue produits (PostgreSQL + HTTP)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  const origin = 'http://localhost:5173';

  beforeAll(async () => {
    const database = process.env.TEST_DB_NAME;
    if (!database || !database.endsWith('_test'))
      throw new Error(
        'Configurer TEST_DB_NAME avec une base jetable dont le nom finit par _test. Voir docs/AUTH.md.',
      );
    const fixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          skipProcessEnv: true,
          load: [
            () => ({
              CORS_ORIGIN: origin,
              AUTH_SUCCESS_URL: `${origin}/compte`,
              AUTH_COOKIE_SECURE: 'false',
              AUTH_RATE_LIMIT: '20',
              NODE_ENV: 'test',
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.TEST_DB_HOST ?? '127.0.0.1',
          port: Number(process.env.TEST_DB_PORT ?? 5432),
          username: process.env.TEST_DB_USER ?? 'brume',
          password: process.env.TEST_DB_PASSWORD ?? 'change-me',
          database,
          entities: [
            User,
            Session,
            OAuthTransaction,
            AuthRateLimit,
            Profile,
            Product,
            ProductFormat,
            Ingredient,
            Box,
            ProfileProduct,
          ],
          migrations: [
            CreateGoogleAccountsAndSessions1793109589589,
            CreateCatalogue1793272229451,
            ReplaceAddressesWithProfiles1793280000000,
            CreateProfileProducts1794926453490,
          ],
          migrationsRun: true,
          synchronize: false,
          retryAttempts: 0,
        }),
        // AuthModule installe la garde globale : vérifie que le catalogue reste public
        AuthModule,
        ProductsModule,
      ],
    }).compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DataSource);
    await seedCatalogue(db);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  const getCatalogue = async (query = ''): Promise<CataloguePageDto> => {
    const response = await request(app.getHttpServer())
      .get(`/api/products${query}`)
      .expect(200);
    return response.body as CataloguePageDto;
  };

  const getValidationError = async (
    query: string,
  ): Promise<ValidationError> => {
    const response = await request(app.getHttpServer())
      .get(`/api/products${query}`)
      .expect(400);
    return response.body as ValidationError;
  };

  const findProduct = (page: CataloguePageDto, name: string) =>
    page.data.find((product) => product.name === name)!;

  it('est accessible sans être connecté', async () => {
    await request(app.getHttpServer()).get('/api/products').expect(200);
  });

  it('renvoie la première page avec la pagination par défaut', async () => {
    const page = await getCatalogue();

    expect(page.meta).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 });
    expect(page.data.map((product) => product.name)).toEqual([
      'Chaï',
      'Earl Grey',
      'Sencha',
    ]);
  });

  it('renvoie un seul élément par produit, quel que soit son nombre de formats', async () => {
    const page = await getCatalogue();

    // Earl Grey a 3 formats mais n'apparaît qu'une fois
    expect(
      page.data.filter((product) => product.name === 'Earl Grey'),
    ).toHaveLength(1);
  });

  it('renvoie exactement les champs du catalogue', async () => {
    const earlGrey = findProduct(await getCatalogue(), 'Earl Grey');

    expect(Object.keys(earlGrey).sort()).toEqual(
      [
        'id',
        'name',
        'typeTea',
        'origin',
        'ingredients',
        'moment',
        'image',
        'availability',
        'isOrderable',
        'lowestPrice',
        'averageRating',
        'ratingCount',
      ].sort(),
    );
    expect(typeof earlGrey.id).toBe('string');
    expect(earlGrey).toMatchObject({
      name: 'Earl Grey',
      typeTea: 'noir',
      origin: 'Inde',
      moment: ConsumptionMoment.MORNING,
      image: 'data:image/png;base64,AAAA',
    });
    expect([...earlGrey.ingredients].sort()).toEqual(['Bergamote', 'Thé noir']);
  });

  it('pagine les produits sans doublon ni oubli', async () => {
    const firstPage = await getCatalogue('?page=1&limit=2');
    const secondPage = await getCatalogue('?page=2&limit=2');

    expect(firstPage.data.map((product) => product.name)).toEqual([
      'Chaï',
      'Earl Grey',
    ]);
    expect(secondPage.data.map((product) => product.name)).toEqual(['Sencha']);
    expect(firstPage.meta).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it('renvoie une page vide au-delà de la dernière page', async () => {
    const page = await getCatalogue('?page=10&limit=2');

    expect(page.data).toEqual([]);
    expect(page.meta.total).toBe(3);
  });

  it.each([
    ['page=0', 'page', 'min'],
    ['page=abc', 'page', 'isInt'],
    ['limit=0', 'limit', 'min'],
    ['limit=101', 'limit', 'max'],
    ['limit=1.5', 'limit', 'isInt'],
    ['foo=bar', 'foo', 'whitelistValidation'],
  ])(
    'refuse le paramètre invalide %s (400)',
    async (query, field, constraint) => {
      const error = await getValidationError(`?${query}`);

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toContainEqual({
        field,
        constraints: expect.arrayContaining([constraint]) as string[],
      });
    },
  );
  async function options(): Promise<CatalogueFiltersDto> {
    const response = await request(app.getHttpServer())
      .get('/api/products/filters')
      .expect(200);
    return response.body as CatalogueFiltersDto;
  }
  const names = (page: CataloguePageDto) =>
    page.data.map((product) => product.name);

  it('expose seulement les choix liés au catalogue et les bornes des formats', async () => {
    await db
      .getRepository(Ingredient)
      .save({ name: 'Sans produit', type: IngredientType.BASE, price: 100 });
    const values = await options();
    expect(values.origin).toEqual(['Inde', 'Japon']);
    expect(values.typeTea).toEqual(['noir', 'vert']);
    expect(values.howMuchCaffeine).toEqual(['medium', 'high']);
    expect(values.moment).toEqual(['morning', 'noon']);
    expect(values.price).toEqual({ min: 590, max: 1390 });
    expect(
      values.ingredients.map((ingredient) => ingredient.name).sort(),
    ).toEqual(['Bergamote', 'Cannelle', 'Sencha', 'Thé noir']);
    expect(
      values.ingredients.every((ingredient) =>
        /^[a-f0-9-]{36}$/.test(ingredient.id),
      ),
    ).toBe(true);
  });
  it('combine deux filtres puis permet de retirer une restriction', async () => {
    expect(names(await getCatalogue('?origin=Inde&maxPrice=600'))).toEqual([
      'Earl Grey',
    ]);
    expect(names(await getCatalogue('?origin=Inde'))).toEqual([
      'Chaï',
      'Earl Grey',
    ]);
  });
  it('combine les six filtres, sans retirer les ingrédients retournés', async () => {
    const ingredient = (await options()).ingredients.find(
      (item) => item.name === 'Bergamote',
    )!;
    const page = await getCatalogue(
      `?ingredients=${ingredient.id}&origin=Inde&typeTea=noir&howMuchCaffeine=high&moment=morning&minPrice=600&maxPrice=1100`,
    );
    expect(names(page)).toEqual(['Earl Grey']);
    expect(page.meta.total).toBe(1);
    expect(page.data[0].ingredients).toHaveLength(2);
  });
  it('applique un OU dans chaque filtre et un ET entre filtres', async () => {
    expect(
      names(
        await getCatalogue(
          '?origin=Inde&origin=Japon&howMuchCaffeine=medium&howMuchCaffeine=high&moment=noon',
        ),
      ),
    ).toEqual(['Sencha']);
    expect(names(await getCatalogue('?typeTea=noir&typeTea=vert'))).toEqual([
      'Chaï',
      'Earl Grey',
      'Sencha',
    ]);
    expect(
      names(await getCatalogue('?moment=morning&moment=noon')),
    ).toHaveLength(3);
  });
  it('filtre les ingrédients par UUID sans dupliquer un produit correspondant deux fois', async () => {
    const ingredients = (await options()).ingredients;
    const ids = ['Thé noir', 'Bergamote'].map(
      (name) => ingredients.find((item) => item.name === name)!.id,
    );
    const page = await getCatalogue(
      `?ingredients=${ids[0]}&ingredients=${ids[1]}`,
    );
    expect(names(page)).toEqual(['Chaï', 'Earl Grey']);
    expect(page.meta.total).toBe(2);
    expect(
      names(await getCatalogue(`?ingredients=${ids[1].toUpperCase()}`)),
    ).toEqual(['Earl Grey']);
  });
  it('conserve le total filtré et un tri stable entre les pages', async () => {
    const first = await getCatalogue('?origin=Inde&page=1&limit=1');
    const second = await getCatalogue('?origin=Inde&page=2&limit=1');
    expect(names(first)).toEqual(['Chaï']);
    expect(names(second)).toEqual(['Earl Grey']);
    expect(first.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
    const beyond = await getCatalogue('?origin=Inde&page=3&limit=1');
    expect(beyond.data).toEqual([]);
    expect(beyond.meta.total).toBe(2);
  });
  it('retourne une combinaison vide avec un total à zéro', async () => {
    const page = await getCatalogue('?origin=Japon&typeTea=noir');
    expect(page.data).toEqual([]);
    expect(page.meta).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
  });
  it('exige qu’un même format respecte les deux bornes inclusives du prix', async () => {
    expect(names(await getCatalogue('?minPrice=990&maxPrice=990'))).toEqual([
      'Earl Grey',
    ]);
    expect(names(await getCatalogue('?minPrice=590&maxPrice=590'))).toEqual([
      'Earl Grey',
    ]);
    expect(names(await getCatalogue('?minPrice=700&maxPrice=900'))).toEqual([]);
    expect(
      names(await getCatalogue('?minPrice=0&maxPrice=2147483647')),
    ).toHaveLength(3);
    expect(names(await getCatalogue('?minPrice=1000'))).toEqual([
      'Chaï',
      'Earl Grey',
    ]);
    expect(names(await getCatalogue('?maxPrice=0'))).toEqual([]);
  });
  it('déduplique et nettoie les sélections répétées', async () => {
    expect(names(await getCatalogue('?origin=%20Inde%20&origin=Inde'))).toEqual(
      ['Chaï', 'Earl Grey'],
    );
  });
  it('ne dépend pas de la sélection active pour les choix de filtres', async () => {
    const before = await options();
    await getCatalogue('?origin=Japon&moment=noon');
    expect(await options()).toEqual(before);
  });
  it.each([
    ['howMuchCaffeine=invalid', 'howMuchCaffeine', 'isEnum'],
    ['howMuchCaffeine=HIGH', 'howMuchCaffeine', 'isEnum'],
    ['moment=night', 'moment', 'isEnum'],
    ['ingredients=bergamote', 'ingredients', 'isUuid'],
    ['origin=', 'origin', 'isNotEmpty'],
    ['origin=Atlantide', 'origin', 'isAllowed'],
    ['typeTea=inconnu', 'typeTea', 'isAllowed'],
    ['minPrice=-1', 'minPrice', 'isInt'],
    ['minPrice=', 'minPrice', 'isInt'],
    ['minPrice=1.5', 'minPrice', 'isInt'],
    ['minPrice=1e3', 'minPrice', 'isInt'],
    ['minPrice=true', 'minPrice', 'isInt'],
    ['minPrice=10&minPrice=20', 'minPrice', 'isInt'],
    ['maxPrice=2147483648', 'maxPrice', 'max'],
    ['minPrice=1000&maxPrice=500', 'maxPrice', 'priceRange'],
  ])('refuse le filtre invalide %s', async (query, field, constraint) => {
    const error = await getValidationError(`?${query}`);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(
      error.details.some(
        (detail) =>
          detail.field === field && detail.constraints.includes(constraint),
      ),
    ).toBe(true);
  });
  it('refuse un UUID inexistant ou un ingrédient sans produit', async () => {
    const orphan = await db.getRepository(Ingredient).save({
      name: 'Sans produit pour validation',
      type: IngredientType.BASE,
      price: 100,
    });
    for (const id of [randomUUID(), orphan.id]) {
      const error = await getValidationError(`?ingredients=${id}`);
      expect(error.details).toContainEqual({
        field: 'ingredients',
        constraints: ['isAllowed'],
      });
    }
  });
  it('refuse une liste trop longue ou un mélange de valeurs autorisées et interdites', async () => {
    const query = Array.from(
      { length: 21 },
      (_, index) => `origin=Origin${index}`,
    ).join('&');
    expect(
      (await getValidationError(`?${query}`)).details.some((detail) =>
        detail.constraints.includes('arrayMaxSize'),
      ),
    ).toBe(true);
    expect(
      (await getValidationError('?origin=Inde&origin=Atlantide')).code,
    ).toBe('VALIDATION_ERROR');
  });
  it('ne traite pas une valeur malveillante comme du SQL', async () => {
    await getValidationError(
      `?origin=${encodeURIComponent("Inde' OR 1=1 --")}`,
    );
    expect((await getCatalogue()).meta.total).toBe(3);
  });
  it('accepte les enums valides même si aucun produit ne correspond', async () => {
    expect(
      names(await getCatalogue('?howMuchCaffeine=none&moment=evening')),
    ).toEqual([]);
  });
  it('documente les paramètres et les choix dans Swagger et le contrat partagé', () => {
    const contract = parse(
      readFileSync('docs/contract/openapi.yaml', 'utf8'),
    ) as OpenAPIObject;
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const expected = contract.paths['/products'].get!;
    const actual = document.paths['/api/products'].get!;
    const expectedNames = expected
      .parameters!.map((parameter) =>
        '$ref' in parameter
          ? parameter.$ref.split('/').pop()!.toLowerCase()
          : parameter.name,
      )
      .sort();
    expect(
      actual
        .parameters!.map((parameter) =>
          'name' in parameter ? parameter.name : '',
        )
        .sort(),
    ).toEqual(expectedNames);
    expect(Object.keys(actual.responses).sort()).toEqual(
      Object.keys(expected.responses).sort(),
    );
    for (const name of ['minPrice', 'maxPrice', 'page', 'limit']) {
      const parameter = actual.parameters!.find(
        (item) => 'name' in item && item.name === name,
      )!;
      expect(
        'schema' in parameter ? parameter.schema : undefined,
      ).toMatchObject({ type: 'integer' });
    }
    const expectedPage = contract.components!.schemas!
      .CatalogueProduct as SchemaObject;
    const actualPage = document.components!.schemas!
      .CatalogueProductDto as SchemaObject;
    expect(actualPage.required?.sort()).toEqual(expectedPage.required?.sort());
    expect(Object.keys(actualPage.properties!).sort()).toEqual(
      Object.keys(expectedPage.properties!).sort(),
    );

    expect(
      document.paths['/api/products/filters'].get!.responses['200'],
    ).toBeDefined();
    const schema = document.components!.schemas!
      .CatalogueFiltersDto as SchemaObject;
    expect(Object.keys(schema.properties!).sort()).toEqual(
      Object.keys(
        (contract.components!.schemas!.CatalogueFilters as SchemaObject)
          .properties!,
      ).sort(),
    );
  });
  it('retourne des choix vides et des prix nuls pour un catalogue vide', async () => {
    try {
      await db.query(
        'TRUNCATE "profile_products", "box_products", "product_ingredients", "product_formats", "boxes", "products", "ingredients"',
      );
      expect(await options()).toEqual({
        ingredients: [],
        origin: [],
        typeTea: [],
        howMuchCaffeine: [],
        moment: [],
        price: { min: null, max: null },
      });
      expect((await getCatalogue()).data).toEqual([]);
    } finally {
      await seedCatalogue(db);
    }
  });

  describe('US-004 availability', () => {
    let product: Product;
    beforeEach(async () => {
      await seedCatalogue(db);
      product = await db.getRepository(Product).findOneOrFail({
        where: { name: 'Earl Grey' },
        relations: { formats: true },
      });
    });
    afterEach(() => jest.restoreAllMocks());
    const url = (formatId: string) =>
      `/api/products/${product.id}/formats/${formatId}/availability`;

    it('exposes independent states for three formats of the same product', async () => {
      const detail = await request(app.getHttpServer())
        .get(`/api/products/${product.id}`)
        .expect(200);
      const formats = (detail.body as ProductDetailDto).formats;
      expect(
        formats.map((format) => [
          format.stock,
          format.availability,
          format.isOrderable,
        ]),
      ).toEqual([
        [40, 'IN_STOCK', true],
        [0, 'OUT_OF_STOCK', false],
        [5, 'LOW_STOCK', true],
      ]);
      expect(detail.body).toMatchObject({
        availability: 'IN_STOCK',
        isOrderable: true,
      });
      expect(findProduct(await getCatalogue(), 'Earl Grey')).toMatchObject({
        availability: 'IN_STOCK',
        isOrderable: true,
      });
    });
    it('checks a requested quantity without reserving stock', async () => {
      const format = product.formats.find((item) => item.stock === 5)!;
      for (const [quantity, isOrderable] of [
        [1, true],
        [5, true],
        [6, false],
      ] as const) {
        const response = await request(app.getHttpServer())
          .get(url(format.id))
          .query({ quantity })
          .expect(200);
        expect(response.body).toMatchObject({
          productId: product.id,
          formatId: format.id,
          quantity,
          availability: 'LOW_STOCK',
          isOrderable,
        });
      }
      expect(
        (
          await db
            .getRepository(ProductFormat)
            .findOneByOrFail({ id: format.id })
        ).stock,
      ).toBe(5);
    });
    it('refuses a simulated basket write when stock runs out after consultation', async () => {
      const format = product.formats.find((item) => item.stock === 5)!;
      await request(app.getHttpServer())
        .get(url(format.id))
        .expect(200)
        .expect((response) =>
          expect((response.body as FormatAvailabilityDto).isOrderable).toBe(
            true,
          ),
        );
      await db
        .getRepository(ProductFormat)
        .update({ id: format.id }, { stock: 0 });
      // Consumer-side control for the future basket: no production basket route exists yet.
      await expect(
        app.get(AvailabilityService).assertOrderable(product.id, format.id, 1),
      ).rejects.toMatchObject({ response: { code: 'OUT_OF_STOCK' } });
      const response = await request(app.getHttpServer())
        .get(url(format.id))
        .expect(200);
      expect(response.body).toMatchObject({
        availability: 'OUT_OF_STOCK',
        isOrderable: false,
      });
    });
    it('aggregates a fully unavailable product and a product without formats', async () => {
      await db
        .getRepository(ProductFormat)
        .createQueryBuilder()
        .update()
        .set({ stock: 0 })
        .where('"productId" = :id', { id: product.id })
        .execute();
      expect(findProduct(await getCatalogue(), 'Earl Grey')).toMatchObject({
        availability: 'OUT_OF_STOCK',
        isOrderable: false,
      });
      await db
        .getRepository(ProductFormat)
        .delete({ product: { id: product.id } });
      const response = await request(app.getHttpServer())
        .get(`/api/products/${product.id}`)
        .expect(200);
      expect(response.body).toMatchObject({
        availability: 'OUT_OF_STOCK',
        isOrderable: false,
        formats: [],
      });
    });
    it('represents corrupt stock as unknown and refuses ordering', async () => {
      await db
        .getRepository(ProductFormat)
        .createQueryBuilder()
        .update()
        .set({ stock: -1 })
        .where('"productId" = :id', { id: product.id })
        .execute();
      const detail = await request(app.getHttpServer())
        .get(`/api/products/${product.id}`)
        .expect(200);
      expect(detail.body).toMatchObject({
        availability: 'UNKNOWN',
        isOrderable: false,
      });
      expect(
        (detail.body as ProductDetailDto).formats.every(
          (item) =>
            item.stock === null &&
            item.availability === Availability.UNKNOWN &&
            !item.isOrderable,
        ),
      ).toBe(true);
      await request(app.getHttpServer())
        .get(url(product.formats[0].id))
        .expect(503)
        .expect((response) =>
          expect((response.body as ValidationError).code).toBe(
            'STOCK_UNAVAILABLE',
          ),
        );
    });
    it('returns sanitized 503 when stock cannot be queried', async () => {
      jest
        .spyOn(db.getRepository(ProductFormat), 'findOne')
        .mockRejectedValueOnce(new Error('private SQL credentials'));
      const response = await request(app.getHttpServer())
        .get(url(product.formats[0].id))
        .expect(503);
      expect(response.body).toMatchObject({ code: 'STOCK_UNAVAILABLE' });
      expect(JSON.stringify(response.body)).not.toContain('private SQL');
    });
    it('returns stock-specific 503 when the catalogue or detail cannot be read', async () => {
      jest
        .spyOn(db.getRepository(Product), 'findOne')
        .mockRejectedValueOnce(new Error('private SQL'));
      await request(app.getHttpServer())
        .get(`/api/products/${product.id}`)
        .expect(503)
        .expect((response) =>
          expect((response.body as ValidationError).code).toBe(
            'STOCK_UNAVAILABLE',
          ),
        );
      jest
        .spyOn(db.getRepository(Product), 'find')
        .mockRejectedValueOnce(new Error('private SQL'));
      await request(app.getHttpServer())
        .get('/api/products')
        .expect(503)
        .expect((response) =>
          expect((response.body as ValidationError).code).toBe(
            'STOCK_UNAVAILABLE',
          ),
        );
    });
    it('reads stock changes inside the caller transaction', async () => {
      const format = product.formats.find((item) => item.stock === 5)!;
      await db.transaction(async (manager) => {
        await manager
          .getRepository(ProductFormat)
          .update({ id: format.id }, { stock: 2 });
        const service = app.get(AvailabilityService);
        expect(
          (await service.assertOrderable(product.id, format.id, 2, manager))
            .stock,
        ).toBe(2);
        await expect(
          service.assertOrderable(product.id, format.id, 3, manager),
        ).rejects.toMatchObject({ response: { code: 'OUT_OF_STOCK' } });
      });
    });
    it('accepts 99 units when the current stock is sufficient', async () => {
      const format = product.formats[0];
      await db
        .getRepository(ProductFormat)
        .update({ id: format.id }, { stock: 99 });
      const response = await request(app.getHttpServer())
        .get(url(format.id))
        .query({ quantity: 99 })
        .expect(200);
      expect(response.body).toMatchObject({ quantity: 99, isOrderable: true });
    });
    it('rejects formats from another product and missing references', async () => {
      const other = await db.getRepository(Product).findOneOrFail({
        where: { name: 'Sencha' },
        relations: { formats: true },
      });
      await request(app.getHttpServer())
        .get(url(other.formats[0].id))
        .expect(404);
      await request(app.getHttpServer()).get(url(randomUUID())).expect(404);
      await request(app.getHttpServer())
        .get(
          `/api/products/${randomUUID()}/formats/${product.formats[0].id}/availability`,
        )
        .expect(404);
      await request(app.getHttpServer()).get(url('invalid')).expect(400);
    });
    it.each(['0', '-1', '1.5', '100', '', '1e2', 'true'])(
      'rejects invalid quantity %s',
      async (quantity) => {
        await request(app.getHttpServer())
          .get(url(product.formats[0].id))
          .query({ quantity })
          .expect(400);
      },
    );
    it('rejects duplicate quantities and unknown query parameters', async () => {
      await request(app.getHttpServer())
        .get(url(product.formats[0].id))
        .query({ quantity: ['1', '2'] })
        .expect(400);
      await request(app.getHttpServer())
        .get(url(product.formats[0].id))
        .query({ stock: 100 })
        .expect(400);
    });
    it('documents the new public check in Swagger and OpenAPI', () => {
      const contract = parse(
        readFileSync('docs/contract/openapi.yaml', 'utf8'),
      ) as OpenAPIObject;
      const doc = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().build(),
      );
      const path = '/products/{id}/formats/{formatId}/availability';
      expect(
        Object.keys(doc.paths[`/api${path}`].get!.responses).sort(),
      ).toEqual(Object.keys(contract.paths[path].get!.responses).sort());
      const schema = doc.components!.schemas!
        .FormatAvailabilityDto as SchemaObject;
      expect(schema.required?.sort()).toEqual(
        (
          contract.components!.schemas!.FormatAvailability as SchemaObject
        ).required?.sort(),
      );
    });
  });
  describe('GET /api/products/:id', () => {
    const getEarlGreyId = async () =>
      findProduct(await getCatalogue(), 'Earl Grey').id;

    it('est accessible sans être connecté et renvoie toute la fiche', async () => {
      const id = await getEarlGreyId();

      const response = await request(app.getHttpServer())
        .get(`/api/products/${id}`)
        .expect(200);
      const detail = response.body as ProductDetailDto;

      expect(Object.keys(detail).sort()).toEqual(
        [
          'id',
          'name',
          'description',
          'typeTea',
          'origin',
          'howMuchCaffeine',
          'moment',
          'image',
          'availability',
          'isOrderable',
          'ingredients',
          'formats',
          'createdAt',
          'updatedAt',
        ].sort(),
      );
      expect(detail).toMatchObject({
        id,
        name: 'Earl Grey',
        description: 'Thé noir à la bergamote',
        typeTea: 'noir',
        origin: 'Inde',
        howMuchCaffeine: CaffeineLevel.HIGH,
        moment: ConsumptionMoment.MORNING,
        image: 'data:image/png;base64,AAAA',
      });
    });

    it('renvoie les ingrédients complets, la base en premier', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/products/${await getEarlGreyId()}`)
        .expect(200);
      const detail = response.body as ProductDetailDto;

      expect(detail.ingredients).toMatchObject([
        { name: 'Thé noir', type: IngredientType.BASE },
        { name: 'Bergamote', type: IngredientType.ESSENTIAL_OIL },
      ]);
      detail.ingredients.forEach((ingredient) => {
        expect(Object.keys(ingredient).sort()).toEqual(
          ['id', 'name', 'description', 'type'].sort(),
        );
        expect(typeof ingredient.id).toBe('string');
      });
    });

    it('renvoie les formats triés du moins cher au plus cher', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/products/${await getEarlGreyId()}`)
        .expect(200);
      const detail = response.body as ProductDetailDto;

      expect(detail.formats).toMatchObject([
        { packaging: Packaging.BAG, quantity: 50, price: 590, stock: 40 },
        { packaging: Packaging.BOX, quantity: 100, price: 990, stock: 0 },
        { packaging: Packaging.TIN, quantity: 150, price: 1390, stock: 5 },
      ]);
    });

    it('ne renvoie pas les box dans lesquelles le produit apparaît', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/products/${await getEarlGreyId()}`)
        .expect(200);

      expect(response.body).not.toHaveProperty('boxes');
    });

    it('renvoie 404 pour un produit inexistant', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products/2b1f6c1e-8a4d-4c3e-9f0a-1d2e3f4a5b6c')
        .expect(404);

      expect((response.body as ValidationError).code).toBe('NOT_FOUND');
    });

    it('renvoie 400 pour un identifiant qui n’est pas un UUID', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products/pas-un-uuid')
        .expect(400);

      expect((response.body as ValidationError).code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/products?sort= (US-017)', () => {
    beforeAll(async () => {
      await seedSortedCatalogue(app.get(DataSource));
    });

    const sorted = async (sort: string, extra = '') =>
      names(await getCatalogue(`?sort=${sort}${extra}`));

    // Parcourt toutes les pages de 2 éléments
    const allPages = async (sort: string) => {
      const pages: string[] = [];
      for (let page = 1; page <= 4; page++)
        pages.push(...(await sorted(sort, `&limit=2&page=${page}`)));
      return pages;
    };

    it('trie par nom croissant par défaut', async () => {
      expect(names(await getCatalogue())).toEqual(await sorted('name_asc'));
      expect(await sorted('name_asc')).toEqual([
        'Alpha',
        'Bravo',
        'Charlie',
        'Delta',
        'Echo',
        'Foxtrot',
        'Golf',
      ]);
    });

    it('trie par nom décroissant', async () => {
      expect(await sorted('name_desc')).toEqual([
        'Golf',
        'Foxtrot',
        'Echo',
        'Delta',
        'Charlie',
        'Bravo',
        'Alpha',
      ]);
    });

    it('trie par prix croissant sur plusieurs pages avec des prix égaux, sans doublon ni oubli', async () => {
      // Alpha, Bravo, Charlie et Echo sont tous à 500 : départagés par le nom.
      // Foxtrot n'a aucun format : toujours en dernier.
      const expected = [
        'Delta',
        'Alpha',
        'Bravo',
        'Charlie',
        'Echo',
        'Golf',
        'Foxtrot',
      ];
      expect(await sorted('price_asc')).toEqual(expected);
      expect(await allPages('price_asc')).toEqual(expected);
      const second = await getCatalogue('?sort=price_asc&limit=2&page=2');
      expect(second.meta).toEqual({
        page: 2,
        limit: 2,
        total: 7,
        totalPages: 4,
      });
    });

    it('trie par prix décroissant, produits sans prix toujours en dernier', async () => {
      const expected = [
        'Golf',
        'Alpha',
        'Bravo',
        'Charlie',
        'Echo',
        'Delta',
        'Foxtrot',
      ];
      expect(await sorted('price_desc')).toEqual(expected);
      expect(await allPages('price_desc')).toEqual(expected);
    });

    it('trie par note avec des produits sans avis en dernier', async () => {
      // Delta 5 (1 note) ; Foxtrot 4,5 (4 notes) avant Alpha et Charlie 4,5 (2 notes) ;
      // Echo 3 (l'avis sans note est ignoré) ; Bravo et Golf sans note, départagés par le nom.
      const expected = [
        'Delta',
        'Foxtrot',
        'Alpha',
        'Charlie',
        'Echo',
        'Bravo',
        'Golf',
      ];
      expect(await sorted('rating_desc')).toEqual(expected);
      expect(await allPages('rating_desc')).toEqual(expected);
    });

    it('trie par nouveauté, du plus récent au plus ancien', async () => {
      // Charlie et Delta ont la même date : départagés par le nom
      expect(await sorted('newest')).toEqual([
        'Golf',
        'Charlie',
        'Delta',
        'Foxtrot',
        'Echo',
        'Bravo',
        'Alpha',
      ]);
    });

    it('applique le tri après les filtres', async () => {
      expect(await sorted('rating_desc', '&maxPrice=500')).toEqual([
        'Delta',
        'Alpha',
        'Charlie',
        'Echo',
        'Bravo',
      ]);
    });

    it('expose les indicateurs utilisés par les tris', async () => {
      const page = await getCatalogue();
      expect(findProduct(page, 'Alpha')).toMatchObject({
        lowestPrice: 500,
        averageRating: 4.5,
        ratingCount: 2,
      });
      expect(findProduct(page, 'Echo')).toMatchObject({
        averageRating: 3,
        ratingCount: 1,
      });
      expect(findProduct(page, 'Foxtrot')).toMatchObject({
        lowestPrice: null,
        averageRating: 4.5,
        ratingCount: 4,
      });
      // Golf n'a qu'un favori : pas compté comme avis
      expect(findProduct(page, 'Golf')).toMatchObject({
        lowestPrice: 800,
        averageRating: null,
        ratingCount: 0,
      });
    });

    it.each(['price', 'PRICE_ASC', 'price_asc&sort=name_asc', ''])(
      'refuse le tri invalide « %s » (400)',
      async (value) => {
        const error = await getValidationError(`?sort=${value}`);

        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.details).toContainEqual({
          field: 'sort',
          constraints: expect.arrayContaining(['isEnum']) as string[],
        });
      },
    );
  });

  describe('GET /api/products/:id/similar', () => {
    let ids: Record<string, string>;

    beforeAll(async () => {
      ids = await seedSimilarProducts(app.get(DataSource));
    });

    const getSimilar = async (name: string) => {
      const response = await request(app.getHttpServer())
        .get(`/api/products/${ids[name]}/similar`)
        .expect(200);
      return response.body as CatalogueProductDto[];
    };

    it('renvoie les 3 produits les plus proches, du plus au moins similaire', async () => {
      const similar = await getSimilar('Assam Chaï');

      // Rooibos Chaï : 2 épices communes (6) ; Ceylan Cannelle : 1 épice + même type (5) ;
      // Darjeeling Nature et Assam Nature : même type (2), départagés par le moment.
      // Assam Nature partage la base Assam, qui ne compte pas.
      expect(similar.map((product) => product.name)).toEqual([
        'Rooibos Chaï',
        'Ceylan Cannelle',
        'Darjeeling Nature',
      ]);
    });

    it('ne suggère ni le produit lui-même ni un produit entièrement en rupture', async () => {
      const names = (await getSimilar('Assam Chaï')).map(
        (product) => product.name,
      );

      expect(names).not.toContain('Assam Chaï');
      // Maté Chaï aurait le meilleur score mais tous ses formats sont à 0
      expect(names).not.toContain('Maté Chaï');
    });

    it('renvoie les produits au format du catalogue', async () => {
      const [first] = await getSimilar('Assam Chaï');

      expect(Object.keys(first).sort()).toEqual(
        [
          'id',
          'name',
          'typeTea',
          'origin',
          'ingredients',
          'moment',
          'image',
          'availability',
          'isOrderable',
          'lowestPrice',
          'averageRating',
          'ratingCount',
        ].sort(),
      );
    });

    it('est accessible sans être connecté', async () => {
      await request(app.getHttpServer())
        .get(`/api/products/${ids['Verveine Nature']}/similar`)
        .expect(200);
    });

    it('renvoie 404 pour un produit inexistant', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products/2b1f6c1e-8a4d-4c3e-9f0a-1d2e3f4a5b6c/similar')
        .expect(404);

      expect((response.body as ValidationError).code).toBe('NOT_FOUND');
    });

    it('renvoie 400 pour un identifiant qui n’est pas un UUID', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/products/pas-un-uuid/similar')
        .expect(400);

      expect((response.body as ValidationError).code).toBe('VALIDATION_ERROR');
    });
  });
});

// Jeu de données dédié à la similarité ; renvoie les ids par nom de produit
async function seedSimilarProducts(
  dataSource: DataSource,
): Promise<Record<string, string>> {
  await dataSource.query(
    'TRUNCATE "profile_products", "box_products", "product_ingredients", "product_formats", "boxes", "products", "ingredients"',
  );

  const ingredient = Object.fromEntries(
    (
      await dataSource.getRepository(Ingredient).save([
        { name: 'Assam', type: IngredientType.BASE, price: 300 },
        { name: 'Darjeeling', type: IngredientType.BASE, price: 500 },
        { name: 'Ceylan', type: IngredientType.BASE, price: 350 },
        { name: 'Rooibos', type: IngredientType.BASE, price: 250 },
        { name: 'Maté', type: IngredientType.BASE, price: 250 },
        { name: 'Verveine', type: IngredientType.BASE, price: 300 },
        { name: 'Cannelle', type: IngredientType.DRIED_INGREDIENT, price: 100 },
        {
          name: 'Gingembre',
          type: IngredientType.DRIED_INGREDIENT,
          price: 110,
        },
      ])
    ).map((saved) => [saved.name, saved]),
  );

  const format = (
    packaging: Packaging,
    quantity: number,
    price: number,
    stock: number,
  ) =>
    dataSource
      .getRepository(ProductFormat)
      .create({ packaging, quantity, price, stock });

  const product = (
    name: string,
    typeTea: string,
    moment: ConsumptionMoment,
    ingredients: string[],
    stocks: [number, number] = [10, 10],
  ) => ({
    name,
    typeTea,
    moment,
    howMuchCaffeine: CaffeineLevel.HIGH,
    ingredients: ingredients.map((key) => ingredient[key]),
    formats: [
      format(Packaging.BAG, 50, 550, stocks[0]),
      format(Packaging.BOX, 100, 920, stocks[1]),
    ],
  });

  const saved = await dataSource.getRepository(Product).save([
    product('Assam Chaï', 'noir', ConsumptionMoment.MORNING, [
      'Assam',
      'Cannelle',
      'Gingembre',
    ]),
    // Un format en rupture sur deux : reste suggérable
    product(
      'Rooibos Chaï',
      'rooibos',
      ConsumptionMoment.EVENING,
      ['Rooibos', 'Cannelle', 'Gingembre'],
      [0, 12],
    ),
    product(
      'Maté Chaï',
      'maté',
      ConsumptionMoment.MORNING,
      ['Maté', 'Cannelle', 'Gingembre'],
      [0, 0],
    ),
    product('Ceylan Cannelle', 'noir', ConsumptionMoment.SNACK, [
      'Ceylan',
      'Cannelle',
    ]),
    product('Darjeeling Nature', 'noir', ConsumptionMoment.MORNING, [
      'Darjeeling',
    ]),
    product('Assam Nature', 'noir', ConsumptionMoment.SNACK, ['Assam']),
    product('Verveine Nature', 'infusion', ConsumptionMoment.EVENING, [
      'Verveine',
    ]),
  ]);

  return Object.fromEntries(saved.map((p) => [p.name, p.id]));
}

// Jeu de données dédié aux tris : prix égaux, produit sans format, produits sans avis
async function seedSortedCatalogue(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE "profile_products", "box_products", "product_ingredients", "product_formats", "boxes", "products", "ingredients"',
  );
  await dataSource.query(
    `DELETE FROM "utilisateurs" WHERE email LIKE '%@sort.test'`,
  );

  const profiles = await Promise.all(
    [1, 2, 3, 4].map(async (index) => {
      const user = await dataSource.getRepository(User).save({
        googleSub: `sort-${index}`,
        email: `client${index}@sort.test`,
        emailVerifiedAt: new Date(),
      });
      return dataSource.getRepository(Profile).save({ userId: user.id });
    }),
  );

  const [base] = await dataSource
    .getRepository(Ingredient)
    .save([{ name: 'Thé noir', type: IngredientType.BASE, price: 300 }]);

  // [nom, prix des formats, notes, jours depuis l'ajout]
  const rows: [string, number[], number[], number][] = [
    ['Echo', [500, 900], [3], 5],
    ['Alpha', [700, 500], [5, 4], 9],
    ['Golf', [800], [], 0],
    ['Charlie', [500], [4, 5], 2],
    ['Bravo', [500], [], 7],
    ['Foxtrot', [], [4, 5, 5, 4], 3],
    ['Delta', [300], [5], 2],
  ];
  const products = await dataSource.getRepository(Product).save(
    rows.map(([name, prices]) => ({
      name,
      typeTea: 'noir',
      howMuchCaffeine: CaffeineLevel.HIGH,
      moment: ConsumptionMoment.MORNING,
      ingredients: [base],
      formats: prices.map((price, index) =>
        dataSource.getRepository(ProductFormat).create({
          packaging: Packaging.BAG,
          quantity: 50 * (index + 1),
          price,
          stock: 10,
        }),
      ),
    })),
  );

  const links: Partial<ProfileProduct>[] = [];
  for (const [index, [, , notes, days]] of rows.entries()) {
    const product = products[index];
    await dataSource.query(
      // date de référence fixe : deux produits au même nombre de jours ont exactement la même date
      `UPDATE products SET created_at = TIMESTAMPTZ '2026-11-01T12:00:00Z' - make_interval(days => $2) WHERE id = $1`,
      [product.id, days],
    );
    notes.forEach((note, i) =>
      links.push({
        profile: profiles[i],
        product,
        type: ProfileProductType.REVIEW,
        note,
      }),
    );
  }
  const byName = new Map(products.map((p) => [p.name, p]));
  // Avis sans note sur Echo : ignoré par la moyenne et le compte
  links.push({
    profile: profiles[3],
    product: byName.get('Echo'),
    type: ProfileProductType.REVIEW,
    review: 'Pas encore d’avis tranché.',
  });
  // Favori sur Golf : ne compte pas comme un avis
  links.push({
    profile: profiles[0],
    product: byName.get('Golf'),
    type: ProfileProductType.FAVORITE,
  });
  await dataSource.getRepository(ProfileProduct).save(links);
}

async function seedCatalogue(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE "profile_products", "box_products", "product_ingredients", "product_formats", "boxes", "products", "ingredients"',
  );

  const [theNoir, bergamote, sencha, cannelle] = await dataSource
    .getRepository(Ingredient)
    .save([
      { name: 'Thé noir', type: IngredientType.BASE, price: 300 },
      { name: 'Bergamote', type: IngredientType.ESSENTIAL_OIL, price: 200 },
      { name: 'Sencha', type: IngredientType.BASE, price: 400 },
      { name: 'Cannelle', type: IngredientType.DRIED_INGREDIENT, price: 100 },
    ]);

  const format = (
    packaging: Packaging,
    quantity: number,
    price: number,
    stock: number,
  ) =>
    dataSource
      .getRepository(ProductFormat)
      .create({ packaging, quantity, price, stock });

  // Insérés volontairement dans le désordre (noms et formats) pour vérifier les tris
  const [, earlGrey] = await dataSource.getRepository(Product).save([
    {
      name: 'Sencha',
      origin: 'Japon',
      typeTea: 'vert',
      howMuchCaffeine: CaffeineLevel.MEDIUM,
      moment: ConsumptionMoment.NOON,
      ingredients: [sencha],
      formats: [format(Packaging.BAG, 50, 650, 10)],
    },
    {
      name: 'Earl Grey',
      description: 'Thé noir à la bergamote',
      origin: 'Inde',
      typeTea: 'noir',
      image: 'data:image/png;base64,AAAA',
      howMuchCaffeine: CaffeineLevel.HIGH,
      moment: ConsumptionMoment.MORNING,
      ingredients: [theNoir, bergamote],
      formats: [
        format(Packaging.TIN, 150, 1390, 5),
        format(Packaging.BAG, 50, 590, 40),
        format(Packaging.BOX, 100, 990, 0),
      ],
    },
    {
      name: 'Chaï',
      origin: 'Inde',
      typeTea: 'noir',
      howMuchCaffeine: CaffeineLevel.HIGH,
      moment: ConsumptionMoment.MORNING,
      ingredients: [theNoir, cannelle],
      formats: [
        format(Packaging.BOX, 100, 1050, 30),
        format(Packaging.BAG, 50, 620, 50),
      ],
    },
  ]);

  // Box contenant l'Earl Grey : ne doit pas apparaître dans la fiche produit
  await dataSource
    .getRepository(Box)
    .save({ name: 'Box Découverte', price: 1990, products: [earlGrey] });
}
