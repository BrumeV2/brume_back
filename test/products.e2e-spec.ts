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
    await seedCatalogue(app.get(DataSource));
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
