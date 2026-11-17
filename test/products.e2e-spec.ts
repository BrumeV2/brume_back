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
import { CreateAddresses1793261709905 } from '../src/database/migrations/1793261709905-CreateAddresses';
import { CreateCatalogue1793272229451 } from '../src/database/migrations/1793272229451-CreateCatalogue';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthRateLimit } from '../src/modules/auth/entities/auth-rate-limit.entity';
import { OAuthTransaction } from '../src/modules/auth/entities/oauth-transaction.entity';
import { Session } from '../src/modules/auth/entities/session.entity';
import { CataloguePageDto } from '../src/modules/products/dto/catalogue-page.dto';
import { Box } from '../src/modules/products/entities/box.entity';
import { Ingredient } from '../src/modules/products/entities/ingredient.entity';
import { ProductFormat } from '../src/modules/products/entities/product-format.entity';
import { Product } from '../src/modules/products/entities/product.entity';
import { CaffeineLevel } from '../src/modules/products/enums/caffeine-level.enum';
import { ConsumptionMoment } from '../src/modules/products/enums/consumption-moment.enum';
import { IngredientType } from '../src/modules/products/enums/ingredient-type.enum';
import { Packaging } from '../src/modules/products/enums/packaging.enum';
import { ProductsModule } from '../src/modules/products/products.module';
import { Address } from '../src/modules/users/entities/address.entity';
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
            Address,
            Product,
            ProductFormat,
            Ingredient,
            Box,
          ],
          migrations: [
            CreateGoogleAccountsAndSessions1793109589589,
            CreateAddresses1793261709905,
            CreateCatalogue1793272229451,
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
    const earlGrey = findProduct(await getCatalogue(), 'Earl Grey');

    expect(earlGrey.formats).toHaveLength(3);
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
        'price',
        'moment',
        'image',
        'formats',
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

  it('trie les formats du moins cher au plus cher et expose le prix « à partir de »', async () => {
    const earlGrey = findProduct(await getCatalogue(), 'Earl Grey');

    expect(earlGrey.price).toBe(590);
    expect(earlGrey.formats).toMatchObject([
      { packaging: Packaging.BAG, quantity: 50, price: 590, stock: 40 },
      { packaging: Packaging.BOX, quantity: 100, price: 990, stock: 0 },
      { packaging: Packaging.TIN, quantity: 150, price: 1390, stock: 5 },
    ]);
    earlGrey.formats.forEach((format) =>
      expect(typeof format.id).toBe('string'),
    );
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
  it('combine les six filtres, sans retirer les formats et ingrédients retournés', async () => {
    const ingredient = (await options()).ingredients.find(
      (item) => item.name === 'Bergamote',
    )!;
    const page = await getCatalogue(
      `?ingredients=${ingredient.id}&origin=Inde&typeTea=noir&howMuchCaffeine=high&moment=morning&minPrice=600&maxPrice=1100`,
    );
    expect(names(page)).toEqual(['Earl Grey']);
    expect(page.meta.total).toBe(1);
    expect(page.data[0].formats).toHaveLength(3);
    expect(page.data[0].ingredients).toHaveLength(2);
    expect(page.data[0].price).toBe(590);
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
        'TRUNCATE "box_products", "product_ingredients", "product_formats", "boxes", "products", "ingredients"',
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
});

async function seedCatalogue(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE "box_products", "product_ingredients", "product_formats", "boxes", "products", "ingredients"',
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
  await dataSource.getRepository(Product).save([
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
}
