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
import { AddProductSearch1795564800000 } from '../src/database/migrations/1795564800000-AddProductSearch';
import { AddIngredientAliases1795651200000 } from '../src/database/migrations/1795651200000-AddIngredientAliases';
import { AddProductCreation1795737600000 } from '../src/database/migrations/1795737600000-AddProductCreation';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthRateLimit } from '../src/modules/auth/entities/auth-rate-limit.entity';
import { OAuthTransaction } from '../src/modules/auth/entities/oauth-transaction.entity';
import { Session } from '../src/modules/auth/entities/session.entity';
import { SessionsService } from '../src/modules/auth/sessions.service';
import { AdminProductDto } from '../src/modules/products/dto/admin-product.dto';
import { CataloguePageDto } from '../src/modules/products/dto/catalogue-page.dto';
import { Box } from '../src/modules/products/entities/box.entity';
import { Ingredient } from '../src/modules/products/entities/ingredient.entity';
import { ProductFormat } from '../src/modules/products/entities/product-format.entity';
import { Product } from '../src/modules/products/entities/product.entity';
import { ProfileProduct } from '../src/modules/products/entities/profile-product.entity';
import { IngredientType } from '../src/modules/products/enums/ingredient-type.enum';
import { ProductsModule } from '../src/modules/products/products.module';
import { Profile } from '../src/modules/users/entities/profile.entity';
import { User } from '../src/modules/users/entities/user.entity';

interface ErrorBody {
  code: string;
  details?: { field: string; constraints: string[] }[];
}

// US-080 : création de produit en back-office (PostgreSQL + HTTP)
describe('Création de produit (PostgreSQL + HTTP)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let sessionCookie: string;
  let userId: string;
  let baseId: string;
  let flavorId: string;
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
            AddProductSearch1795564800000,
            AddIngredientAliases1795651200000,
            AddProductCreation1795737600000,
          ],
          migrationsRun: true,
          synchronize: false,
          retryAttempts: 0,
        }),
        AuthModule,
        ProductsModule,
      ],
    }).compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DataSource);

    await db.query(
      'TRUNCATE "profile_products", "box_products", "product_ingredients", "product_formats", "boxes", "products", "ingredients", "sessions", "profils", "utilisateurs" CASCADE',
    );
    const user = await db.getRepository(User).save(
      db.getRepository(User).create({
        googleSub: 'admin-products-e2e',
        email: 'catalogue@example.test',
        emailVerifiedAt: new Date(),
      }),
    );
    userId = user.id;
    sessionCookie = `brume_session=${await app.get(SessionsService).create(user)}`;

    const [base, flavor] = await db.getRepository(Ingredient).save([
      {
        name: 'Thé noir Assam',
        type: IngredientType.BASE,
        price: 300,
      },
      {
        name: 'Bergamote',
        type: IngredientType.ESSENTIAL_OIL,
        price: 200,
      },
    ]);
    baseId = base.id;
    flavorId = flavor.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  const payload = (overrides: Record<string, unknown> = {}) => ({
    name: 'Assam Bergamote',
    description: 'Thé noir corsé relevé de bergamote',
    origin: 'Inde',
    typeTea: 'noir',
    howMuchCaffeine: 'high',
    moment: 'morning',
    ingredientIds: [baseId, flavorId],
    formats: [
      {
        sku: 'ASB-BAG-100',
        packaging: 'bag',
        quantity: 100,
        price: 1290,
        stock: 12,
      },
      { sku: 'ASB-TIN-150', packaging: 'tin', quantity: 150, price: 2490 },
    ],
    ...overrides,
  });

  const post = (body: object, cookie: string | null = sessionCookie) => {
    const call = request(app.getHttpServer())
      .post('/api/admin/products')
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1');
    return (cookie ? call.set('Cookie', cookie) : call).send(body);
  };

  const counts = async () => ({
    products: await db.getRepository(Product).count(),
    formats: await db.getRepository(ProductFormat).count(),
    links: Number(
      (
        await db.query<{ n: string }[]>(
          'SELECT count(*) AS n FROM product_ingredients',
        )
      )[0].n,
    ),
  });

  const catalogueIds = async () =>
    (
      (await request(app.getHttpServer()).get('/api/products?limit=100'))
        .body as CataloguePageDto
    ).data.map((product) => product.id);

  it('crée un produit complet en brouillon, invisible sur les routes publiques', async () => {
    const response = await post(payload()).expect(201);
    const product = response.body as AdminProductDto;

    expect(product).toMatchObject({
      name: 'Assam Bergamote',
      published: false,
      createdById: userId,
    });
    expect(product.formats).toEqual([
      expect.objectContaining({ sku: 'ASB-BAG-100', price: 1290, stock: 12 }),
      expect.objectContaining({ sku: 'ASB-TIN-150', price: 2490, stock: 0 }),
    ]);
    expect(product.ingredients.map((item) => item.id)).toEqual([
      baseId,
      flavorId,
    ]);

    // Persistance : produit, formats et liens ingrédients, auteur et état de publication
    const stored = await db.getRepository(Product).findOneOrFail({
      where: { id: product.id },
      relations: { formats: true, ingredients: true },
    });
    expect(stored.published).toBe(false);
    expect(stored.createdById).toBe(userId);
    expect(stored.formats).toHaveLength(2);
    expect(stored.ingredients).toHaveLength(2);

    // Brouillon : ni fiche, ni catalogue, ni similaires, ni filtres
    await request(app.getHttpServer())
      .get(`/api/products/${product.id}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/products/${product.id}/similar`)
      .expect(404);
    expect(await catalogueIds()).not.toContain(product.id);
    const filters = await request(app.getHttpServer())
      .get('/api/products/filters')
      .expect(200);
    expect(filters.body).toMatchObject({ origin: [], typeTea: [] });

    // État publiable : la publication suffit à le rendre visible
    await db.getRepository(Product).update(product.id, { published: true });
    await request(app.getHttpServer())
      .get(`/api/products/${product.id}`)
      .expect(200);
    expect(await catalogueIds()).toContain(product.id);
  });

  it('crée directement un produit publié si demandé', async () => {
    const response = await post(
      payload({
        name: 'Assam Nature',
        ingredientIds: [baseId],
        published: true,
        formats: [
          {
            sku: 'ASN-BAG-50',
            packaging: 'bag',
            quantity: 50,
            price: 590,
            stock: 3,
          },
        ],
      }),
    ).expect(201);
    const product = response.body as AdminProductDto;
    expect(product.published).toBe(true);
    const detail = await request(app.getHttpServer())
      .get(`/api/products/${product.id}`)
      .expect(200);
    expect(detail.body).toMatchObject({
      name: 'Assam Nature',
      availability: 'LOW_STOCK',
    });
  });

  it('refuse une référence déjà utilisée sans créer de doublon', async () => {
    const before = await counts();
    const response = await post(
      payload({
        name: 'Copie',
        formats: [
          { sku: 'NEW-BAG-250', packaging: 'bag', quantity: 250, price: 2900 },
          // insensible à la casse : normalisée en ASB-BAG-100
          { sku: 'asb-bag-100', packaging: 'tin', quantity: 100, price: 1900 },
        ],
      }),
    ).expect(409);
    expect(response.body as ErrorBody).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ field: 'formats.1.sku', constraints: ['unique'] }],
    });
    expect(await counts()).toEqual(before);
  });

  it('ne crée qu’un produit quand deux créations concurrentes partagent une référence', async () => {
    const before = await counts();
    const body = (name: string) =>
      payload({
        name,
        formats: [
          { sku: 'RACE-BAG-100', packaging: 'bag', quantity: 100, price: 990 },
        ],
      });
    const statuses = (
      await Promise.all([post(body('Course A')), post(body('Course B'))])
    )
      .map((response) => response.status)
      .sort();
    expect(statuses).toEqual([201, 409]);
    const after = await counts();
    expect(after.products).toBe(before.products + 1);
    expect(after.formats).toBe(before.formats + 1);
    expect(after.links).toBe(before.links + 2);
  });

  it.each([
    [
      'ingrédient inconnu',
      { ingredientIds: ['00000000-0000-4000-8000-000000000999'] },
      'ingredientIds',
    ],
    ['sans format', { formats: [] }, 'formats'],
    ['sans ingrédient', { ingredientIds: [] }, 'ingredientIds'],
    [
      'format invalide',
      { formats: [{ sku: 'BAD-1', packaging: 'bag', quantity: 50, price: 0 }] },
      'formats.0.price',
    ],
    [
      'couple conditionnement + grammage répété',
      {
        formats: [
          { sku: 'DUP-1', packaging: 'bag', quantity: 50, price: 590 },
          { sku: 'DUP-2', packaging: 'bag', quantity: 50, price: 690 },
        ],
      },
      'formats',
    ],
    ['caféine inconnue', { howMuchCaffeine: 'extreme' }, 'howMuchCaffeine'],
    ['champ inconnu', { price: 1000 }, 'price'],
  ])(
    'refuse des données invalides sans produit partiel : %s',
    async (_label, overrides, field) => {
      const before = await counts();
      const response = await post(payload(overrides)).expect(400);
      const body = response.body as ErrorBody;
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.details!.map((detail) => detail.field)).toContain(field);
      expect(await counts()).toEqual(before);
    },
  );

  it('exige une session et la protection CSRF', async () => {
    const before = await counts();
    await post(payload({ formats: [] }), null).expect(401);
    await request(app.getHttpServer())
      .post('/api/admin/products')
      .set('Cookie', sessionCookie)
      .send(payload())
      .expect(403);
    expect(await counts()).toEqual(before);
  });
});
