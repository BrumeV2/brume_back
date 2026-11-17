import { Profile } from '../src/modules/users/entities/profile.entity';
import { ReplaceAddressesWithProfiles1793280000000 } from '../src/database/migrations/1793280000000-ReplaceAddressesWithProfiles';
import { jest } from '@jest/globals';
import {
  Controller,
  Get,
  INestApplication,
  Param,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { Response as TestResponse } from 'supertest';
import { DataSource } from 'typeorm';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject, SchemaObject } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { AppController } from '../src/app.controller';
import { configureApp } from '../src/app.setup';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AuthRateLimit } from '../src/modules/auth/entities/auth-rate-limit.entity';
import { OAuthTransaction } from '../src/modules/auth/entities/oauth-transaction.entity';
import { Session } from '../src/modules/auth/entities/session.entity';
import { GoogleIdentityProvider } from '../src/modules/auth/google.provider';
import { AccountStatus, User } from '../src/modules/users/entities/user.entity';
import { authenticationFailed } from '../src/modules/users/users.service';
import type { GoogleIdentity } from '../src/modules/users/users.service';
import { hashToken } from '../src/modules/auth/crypto.util';
import { CreateGoogleAccountsAndSessions1793109589589 } from '../src/database/migrations/1793109589589-CreateGoogleAccountsAndSessions';

// Test-only endpoint checks that authentication is mandatory by default.
@Controller('private')
class PrivateController {
  @Get(':id')
  get(@Param('id') id: string) {
    return { id };
  }
}

describe('Google accounts, sessions and profile (PostgreSQL + HTTP)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  const origin = 'http://localhost:5173';
  const alice: GoogleIdentity = {
    sub: 'google-alice',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: null,
  };
  const bob: GoogleIdentity = {
    sub: 'google-bob',
    email: 'bob@example.com',
    firstName: 'Bob',
    lastName: null,
  };
  const google = {
    authorizationUrl: jest.fn(
      (state: string, nonce: string, verifier: string) =>
        `https://accounts.google.test/?state=${state}&nonce=${nonce}&challenge=${hashToken(verifier)}`,
    ),
    exchange: jest.fn(
      (
        code: string,
        nonce: string,
        verifier: string,
      ): Promise<GoogleIdentity> => {
        expect(nonce).toHaveLength(43);
        expect(verifier).toHaveLength(43);
        if (code === 'outage')
          return Promise.reject(
            new ServiceUnavailableException({
              code: 'AUTH_UNAVAILABLE',
              message: 'Service de connexion indisponible.',
            }),
          );
        if (code === 'invalid') return Promise.reject(authenticationFailed());
        if (code === 'collision')
          return Promise.resolve({ ...alice, sub: 'other-google-identity' });
        return Promise.resolve(code === 'bob' ? bob : alice);
      },
    ),
  };

  function cookie(response: TestResponse, name: string) {
    const headers = response.headers['set-cookie'] as unknown as string[];
    return (
      headers?.find((value) => value.startsWith(`${name}=`))?.split(';')[0] ??
      ''
    );
  }
  async function start() {
    const response = await request(app.getHttpServer())
      .get('/api/auth/google')
      .expect(302);
    return {
      state: new URL(response.headers.location).searchParams.get('state')!,
      cookie: cookie(response, 'brume_oauth'),
    };
  }
  async function login(code = 'alice') {
    const transaction = await start();
    const response = await request(app.getHttpServer())
      .get('/api/auth/google/callback')
      .query({ state: transaction.state, code })
      .set('Cookie', transaction.cookie)
      .expect(302);
    return { cookie: cookie(response, 'brume_session'), response };
  }

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
          entities: [User, Session, OAuthTransaction, AuthRateLimit, Profile],
          migrations: [
            CreateGoogleAccountsAndSessions1793109589589,
            ReplaceAddressesWithProfiles1793280000000,
          ],
          migrationsRun: true,
          synchronize: false,
          retryAttempts: 0,
        }),
        AuthModule,
      ],
      controllers: [AppController, PrivateController],
    })
      .overrideProvider(GoogleIdentityProvider)
      .useValue(google)
      .compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DataSource);
  });
  beforeEach(async () => {
    if (!db) return;
    await db.query(
      'TRUNCATE TABLE profils, sessions, utilisateurs, oauth_transactions, auth_rate_limits CASCADE',
    );
    jest.clearAllMocks();
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (app) await app.close();
  });

  it('keeps health public and protects new routes by default', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200, { status: 'ok' });
    await request(app.getHttpServer()).get('/api/private/item').expect(401);
  });

  it('documents auth and profile routes consistently with the shared contract', () => {
    const contract = parse(
      readFileSync('docs/contract/openapi.yaml', 'utf8'),
    ) as OpenAPIObject;
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setVersion('1.1.0')
        .addCookieAuth(
          'brume_session',
          { type: 'apiKey', in: 'cookie' },
          'sessionCookie',
        )
        .build(),
    );
    for (const [path, method] of [
      ['/auth/google', 'get'],
      ['/auth/google/callback', 'get'],
      ['/auth/logout', 'post'],
      ['/users/me', 'get'],
      ['/users/me', 'patch'],
    ] as const) {
      const expected = contract.paths[path][method]!;
      const actual = document.paths[`/api${path}`][method]!;
      expect(Object.keys(actual.responses).sort()).toEqual(
        Object.keys(expected.responses).sort(),
      );
      expect(actual.security ?? []).toEqual(
        expected.security ?? contract.security,
      );
      expect(
        actual.parameters
          ?.map((parameter) => ('name' in parameter ? parameter.name : ''))
          .sort() ?? [],
      ).toEqual(
        [
          ...(contract.paths[path].parameters ?? []),
          ...(expected.parameters ?? []),
        ]
          .map((parameter) =>
            '$ref' in parameter
              ? contract.components!.parameters![
                  parameter.$ref.split('/').pop()!
                ]
              : parameter,
          )
          .map((parameter) => ('name' in parameter ? parameter.name : ''))
          .sort(),
      );
    }
    const expectedUser = contract.components!.schemas!.User as SchemaObject;
    const actualUser = document.components!.schemas!
      .UserResponseDto as SchemaObject;
    expect(actualUser.required?.sort()).toEqual(expectedUser.required?.sort());
    expect(Object.keys(actualUser.properties!).sort()).toEqual(
      Object.keys(expectedUser.properties!).sort(),
    );
    expect(Object.keys(document.components!.securitySchemes!)).toEqual(
      Object.keys(contract.components!.securitySchemes!),
    );
    expect(document.components!.securitySchemes!.sessionCookie).toMatchObject({
      type: 'apiKey',
      in: 'cookie',
      name: 'brume_session',
    });
  });

  it('creates a verified customer and initializes their profile', async () => {
    const { cookie: sessionCookie, response } = await login();
    expect(sessionCookie).toMatch(/^brume_session=[A-Za-z0-9_-]{43}$/);
    expect(response.headers.location).toBe('http://localhost:5173/compte');
    const user = await db
      .getRepository(User)
      .createQueryBuilder('u')
      .addSelect('u.googleSub')
      .leftJoinAndSelect('u.profile', 'profile')
      .where('u.email = :email', { email: alice.email })
      .getOneOrFail();
    expect(user.googleSub).toBe(alice.sub);
    expect(user.profile).toBeDefined();
    expect(user.profile?.firstName).toBe('Alice');
    expect(user.profile?.loyaltyPoints).toBe(0);
    expect(user.profile?.doNewsletter).toBe(false);
    expect(await db.getRepository(Session).count()).toBe(1);
    const me = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', sessionCookie)
      .expect(200);
    expect(me.body).toMatchObject({
      email: alice.email,
      firstName: 'Alice',
      lastName: null,
      phone: null,
      address: null,
      postalCode: null,
      city: null,
      loyaltyPoints: 0,
      doNewsletter: false,
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });
  });

  it('reuses the same client on subsequent logins', async () => {
    const first = await login();
    const second = await login();
    expect(await db.getRepository(User).count()).toBe(1);
    expect(await db.getRepository(Session).count()).toBe(2);
    expect(first.cookie).not.toBe(second.cookie);
  });

  it('handles concurrent first registrations without duplicate clients', async () => {
    const [first, second] = await Promise.all([start(), start()]);
    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .get('/api/auth/google/callback')
        .query({ state: first.state, code: 'alice' })
        .set('Cookie', first.cookie),
      request(app.getHttpServer())
        .get('/api/auth/google/callback')
        .query({ state: second.state, code: 'alice' })
        .set('Cookie', second.cookie),
    ]);
    expect([a.status, b.status]).toEqual([302, 302]);
    expect(await db.getRepository(User).count()).toBe(1);
    expect(await db.getRepository(Profile).count()).toBe(1);
  });

  it('consumes the same callback exactly once under concurrency', async () => {
    const transaction = await start();
    const [a, b] = await Promise.all([
      request(app.getHttpServer())
        .get('/api/auth/google/callback')
        .query({ state: transaction.state, code: 'alice' })
        .set('Cookie', transaction.cookie),
      request(app.getHttpServer())
        .get('/api/auth/google/callback')
        .query({ state: transaction.state, code: 'alice' })
        .set('Cookie', transaction.cookie),
    ]);
    expect([a.status, b.status].sort()).toEqual([302, 401]);
    expect(await db.getRepository(Session).count()).toBe(1);
  });

  it('does not link another Google identity based on the same email', async () => {
    await login('alice');
    const transaction = await start();
    await request(app.getHttpServer())
      .get('/api/auth/google/callback')
      .query({ state: transaction.state, code: 'collision' })
      .set('Cookie', transaction.cookie)
      .expect(401);
    expect(await db.getRepository(User).count()).toBe(1);
  });

  it('isolates profiles and ignores a client-supplied user ID', async () => {
    const a = await login('alice');
    const b = await login('bob');
    const aliceProfile = (
      await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Cookie', a.cookie)
        .expect(200)
    ).body as { id: string; userId: string; email: string };
    const bobProfile = (
      await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Cookie', b.cookie)
        .expect(200)
    ).body as { id: string; userId: string; email: string };
    expect(aliceProfile.userId).not.toBe(bobProfile.userId);
    expect(aliceProfile.email).toBe(alice.email);
    expect(bobProfile.email).toBe(bob.email);
  });

  it('rejects expired sessions and blocked accounts, including previously valid sessions', async () => {
    const { cookie: sessionCookie } = await login();
    await db
      .getRepository(Session)
      .createQueryBuilder()
      .update()
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .execute();
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', sessionCookie)
      .expect(401);
    const fresh = await login();
    await db
      .getRepository(User)
      .update({ email: alice.email }, { status: AccountStatus.BLOCKED });
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', fresh.cookie)
      .expect(401);
  });

  it('revokes the current device immediately and preserves other devices', async () => {
    const a = await login();
    const b = await login();
    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .set('Cookie', a.cookie)
      .expect(204);
    expect(cookie(response, 'brume_session')).toBe('brume_session=');
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', a.cookie)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', b.cookie)
      .expect(200);
  });

  it('requires both an allowed Origin and CSRF header to log out', async () => {
    const { cookie: sessionCookie } = await login();
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie)
      .set('Origin', 'https://attacker.example')
      .set('X-CSRF-Protection', '1')
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie)
      .set('Origin', origin)
      .expect(403);
  });

  function patchProfile(cookieStr: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Cookie', cookieStr)
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .send(body);
  }

  it('updates valid profile fields and retrieves updated values after reload (US-047)', async () => {
    const a = await login();
    const initial = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', a.cookie)
      .expect(200);

    expect(initial.body).toMatchObject({
      phone: null,
      address: null,
      doNewsletter: false,
    });

    const updatePayload = {
      firstName: 'Alice-Marie',
      lastName: 'Dupont',
      phone: '0612345678',
      address: '24 avenue des Vosges',
      postalCode: '67000',
      city: 'Strasbourg',
      doNewsletter: true,
    };

    const patched = await patchProfile(a.cookie, updatePayload).expect(200);
    expect(patched.body).toMatchObject(updatePayload);

    // Rechargement persistant
    const reloaded = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', a.cookie)
      .expect(200);

    expect(reloaded.body).toMatchObject(updatePayload);

    // Vérification directe en base PostgreSQL
    const aliceUser = await db
      .getRepository(User)
      .findOneByOrFail({ email: alice.email });
    const dbProfile = await db
      .getRepository(Profile)
      .findOneByOrFail({ userId: aliceUser.id });
    expect(dbProfile.firstName).toBe('Alice-Marie');
    expect(dbProfile.lastName).toBe('Dupont');
    expect(dbProfile.phone).toBe('0612345678');
    expect(dbProfile.address).toBe('24 avenue des Vosges');
    expect(dbProfile.postalCode).toBe('67000');
    expect(dbProfile.city).toBe('Strasbourg');
    expect(dbProfile.doNewsletter).toBe(true);
    expect(dbProfile.loyaltyPoints).toBe(0);
  });

  it('clears nullable fields with null without modifying other fields', async () => {
    const a = await login();
    await patchProfile(a.cookie, {
      firstName: 'Alice',
      lastName: 'Dupont',
      phone: '0612345678',
      address: '10 rue Principale',
      postalCode: '75001',
      city: 'Paris',
    }).expect(200);

    const patched = await patchProfile(a.cookie, {
      phone: null,
      address: null,
    }).expect(200);

    expect(patched.body).toMatchObject({
      phone: null,
      address: null,
      firstName: 'Alice',
      city: 'Paris',
    });
  });

  it('rejects empty bodies with 400 VALIDATION_ERROR', async () => {
    const a = await login();
    const res = await patchProfile(a.cookie, {}).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rejects forbidden and sensitive properties with 400 VALIDATION_ERROR', async () => {
    const a = await login();
    await login('bob');
    const bobUser = await db
      .getRepository(User)
      .findOneByOrFail({ email: bob.email });

    for (const forbidden of [
      { loyaltyPoints: 9999 },
      { userId: bobUser.id },
      { id: bobUser.id },
      { email: 'hacked@example.com' },
      { googleSub: 'forged-sub' },
      { role: 'ADMIN' },
      { status: 'BLOCKED' },
      { randomUnknownField: 'value' },
    ]) {
      const res = await patchProfile(a.cookie, forbidden).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    }

    // Aucune donnee modifiee
    const profileAfter = await db
      .getRepository(Profile)
      .findOneByOrFail({ userId: bobUser.id });
    expect(profileAfter.loyaltyPoints).toBe(0);
  });

  it('rejects invalid field formats with 400 VALIDATION_ERROR', async () => {
    const a = await login();
    for (const invalid of [
      { firstName: '   ' },
      { phone: '123' },
      { phone: '0012345678' },
      { postalCode: '6900' },
      { postalCode: 'abcde' },
      { doNewsletter: 'not-a-bool' },
    ]) {
      const res = await patchProfile(a.cookie, invalid).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    }
  });

  it('requires authentication and CSRF headers to update profile', async () => {
    await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .send({ firstName: 'Anon' })
      .expect(401);

    await request(app.getHttpServer())
      .patch('/api/users/me')
      .send({ firstName: 'Anon' })
      .expect(403);

    const a = await login();
    // Sans X-CSRF-Protection
    await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Cookie', a.cookie)
      .set('Origin', origin)
      .send({ firstName: 'NoCsrf' })
      .expect(403);

    // Avec mauvais Origin
    await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Cookie', a.cookie)
      .set('Origin', 'https://attacker.example')
      .set('X-CSRF-Protection', '1')
      .send({ firstName: 'BadOrigin' })
      .expect(403);
  });
});
