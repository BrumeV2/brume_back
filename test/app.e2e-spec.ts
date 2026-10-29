import { Address } from '../src/modules/users/entities/address.entity';
import { CreateAddresses1793261709905 } from '../src/database/migrations/1793261709905-CreateAddresses';
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
import { SessionsService } from '../src/modules/auth/sessions.service';
import { AccountStatus, User } from '../src/modules/users/entities/user.entity';
import { authenticationFailed } from '../src/modules/users/users.service';
import type { GoogleIdentity } from '../src/modules/users/users.service';
import { hashToken, randomToken } from '../src/modules/auth/crypto.util';
import { CreateGoogleAccountsAndSessions1793109589589 } from '../src/database/migrations/1793109589589-CreateGoogleAccountsAndSessions';

// Test-only endpoint checks that authentication is mandatory by default.
@Controller('private')
class PrivateController {
  @Get(':id')
  get(@Param('id') id: string) {
    return { id };
  }
}

describe('Google accounts and sessions (PostgreSQL + HTTP)', () => {
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
          entities: [User, Session, OAuthTransaction, AuthRateLimit, Address],
          migrations: [
            CreateGoogleAccountsAndSessions1793109589589,
            CreateAddresses1793261709905,
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
      'TRUNCATE TABLE adresses, sessions, utilisateurs, oauth_transactions, auth_rate_limits CASCADE',
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
    await request(app.getHttpServer()).get('/api/private/any-id').expect(401);
    await request(app.getHttpServer()).get('/api/users/me').expect(401);
  });
  it('documents auth, profile and address routes consistently with the shared contract', () => {
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
      ['/users/me/addresses', 'get'],
      ['/users/me/addresses', 'post'],
      ['/users/me/addresses/{id}', 'patch'],
      ['/users/me/addresses/{id}', 'delete'],
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
    const expectedAddress = contract.components!.schemas!
      .Address as SchemaObject;
    const actualAddress = document.components!.schemas!
      .AddressResponseDto as SchemaObject;
    expect(actualAddress.required?.sort()).toEqual(
      expectedAddress.required?.sort(),
    );
    expect(Object.keys(actualAddress.properties!).sort()).toEqual(
      Object.keys(expectedAddress.properties!).sort(),
    );
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
  it('creates a verified customer and stores only a session fingerprint', async () => {
    const { cookie: sessionCookie, response } = await login();
    expect(response.headers.location).toBe(`${origin}/compte`);
    const rawCookies = response.headers['set-cookie'] as unknown as string[];
    expect(
      rawCookies.find((value) => value.startsWith('brume_session=')),
    ).toMatch(/Path=\/api;.*HttpOnly;.*SameSite=Lax/);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    const me = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', sessionCookie)
      .expect(200);
    expect(me.body).toMatchObject({
      email: alice.email,
      firstName: 'Alice',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });
    expect((me.body as User).emailVerifiedAt).toBeTruthy();
    for (const key of [
      'googleSub',
      'token',
      'tokenHash',
      'password',
      'passwordHash',
    ])
      expect(me.body).not.toHaveProperty(key);
    const session = await db
      .getRepository(Session)
      .createQueryBuilder('session')
      .addSelect('session.tokenHash')
      .getOneOrFail();
    expect(session.tokenHash).toBe(hashToken(sessionCookie.split('=')[1]));
    expect(JSON.stringify(me.body)).not.toContain(sessionCookie.split('=')[1]);
    expect(await db.getRepository(OAuthTransaction).count()).toBe(0);
  });
  it('reuses the same client on subsequent logins', async () => {
    await login();
    await login();
    expect(await db.getRepository(User).count()).toBe(1);
    expect(await db.getRepository(Session).count()).toBe(2);
  });
  it('handles concurrent first registrations without duplicate clients', async () => {
    const transactions = await Promise.all([
      start(),
      start(),
      start(),
      start(),
    ]);
    await Promise.all(
      transactions.map((transaction) =>
        request(app.getHttpServer())
          .get('/api/auth/google/callback')
          .query({ state: transaction.state, code: 'alice' })
          .set('Cookie', transaction.cookie)
          .expect(302),
      ),
    );
    expect(await db.getRepository(User).count()).toBe(1);
    expect(await db.getRepository(Session).count()).toBe(4);
  });
  it('consumes the same callback exactly once under concurrency', async () => {
    const transaction = await start();
    const responses = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer())
          .get('/api/auth/google/callback')
          .query({ state: transaction.state, code: 'alice' })
          .set('Cookie', transaction.cookie),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      302, 401,
    ]);
    expect(google.exchange).toHaveBeenCalledTimes(1);
    expect(await db.getRepository(Session).count()).toBe(1);
  });
  it('does not link another Google identity based on the same email', async () => {
    await login();
    const transaction = await start();
    const response = await request(app.getHttpServer())
      .get('/api/auth/google/callback')
      .query({ state: transaction.state, code: 'collision' })
      .set('Cookie', transaction.cookie)
      .expect(401);
    expect(response.body).toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Authentification impossible.',
    });
    expect(JSON.stringify(response.body)).not.toContain(alice.email);
    expect(await db.getRepository(User).count()).toBe(1);
  });
  it('isolates profiles and ignores a client-supplied user ID', async () => {
    const a = await login();
    const b = await login('bob');
    const profileA = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', a.cookie)
      .expect(200);
    const profileB = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', b.cookie)
      .expect(200);
    expect((profileA.body as User).id).not.toBe((profileB.body as User).id);
    const forged = await request(app.getHttpServer())
      .get('/api/users/me')
      .query({ userId: (profileB.body as User).id })
      .set('Cookie', a.cookie)
      .set('X-User-Id', (profileB.body as User).id)
      .expect(200);
    expect((forged.body as User).email).toBe(alice.email);
    await request(app.getHttpServer())
      .get(`/api/users/${(profileB.body as User).id}`)
      .set('Cookie', a.cookie)
      .expect(404);
  });
  it('rejects the wrong browser, missing state, expired transactions and malformed callbacks', async () => {
    const transaction = await start();
    await request(app.getHttpServer())
      .get('/api/auth/google/callback')
      .query({ state: transaction.state, code: 'alice' })
      .set('Cookie', `brume_oauth=${randomToken()}`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/google/callback')
      .query({ code: 'alice' })
      .set('Cookie', transaction.cookie)
      .expect(401);
    await db
      .getRepository(OAuthTransaction)
      .createQueryBuilder()
      .update()
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .execute();
    await request(app.getHttpServer())
      .get('/api/auth/google/callback')
      .query({ state: transaction.state, code: 'alice' })
      .set('Cookie', transaction.cookie)
      .expect(401);
    const another = await start();
    await request(app.getHttpServer())
      .get('/api/auth/google/callback')
      .query({ state: another.state, code: ['alice', 'bob'] })
      .set('Cookie', another.cookie)
      .expect(401);
    expect(google.exchange).not.toHaveBeenCalled();
    expect(await db.getRepository(User).count()).toBe(0);
  });
  it.each(['invalid', 'outage'])(
    'handles provider %s without creating a client or exposing the code',
    async (code) => {
      const transaction = await start();
      const response = await request(app.getHttpServer())
        .get('/api/auth/google/callback')
        .query({ state: transaction.state, code })
        .set('Cookie', transaction.cookie)
        .expect(code === 'outage' ? 503 : 401);
      expect((response.body as { path: string }).path).toBe(
        '/api/auth/google/callback',
      );
      expect(JSON.stringify(response.body)).not.toContain(transaction.state);
      expect(cookie(response, 'brume_session')).toBe('');
      expect(await db.getRepository(User).count()).toBe(0);
    },
  );
  it('consumes a denied Google authorization without authenticating', async () => {
    const transaction = await start();
    await request(app.getHttpServer())
      .get('/api/auth/google/callback')
      .query({ state: transaction.state, error: 'access_denied' })
      .set('Cookie', transaction.cookie)
      .expect(401);
    expect(google.exchange).not.toHaveBeenCalled();
    expect(await db.getRepository(OAuthTransaction).count()).toBe(0);
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
    const transaction = await start();
    await request(app.getHttpServer())
      .get('/api/auth/google/callback')
      .query({ state: transaction.state, code: 'alice' })
      .set('Cookie', transaction.cookie)
      .expect(401);
    expect(await db.getRepository(Session).count()).toBe(2);
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
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .set('Cookie', a.cookie)
      .expect(204);
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
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', sessionCookie)
      .expect(200);
  });
  it('does not confirm logout or clear its cookie if persistence fails', async () => {
    const { cookie: sessionCookie } = await login();
    jest
      .spyOn(app.get(SessionsService), 'revoke')
      .mockRejectedValueOnce(new Error('database-secret-should-not-leak'));
    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie)
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .expect(503);
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('database-secret');
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', sessionCookie)
      .expect(200);
  });
  it('does not issue a session on persistence failure and allows retry without a duplicate account', async () => {
    const transaction = await start();
    jest
      .spyOn(app.get(SessionsService), 'create')
      .mockRejectedValueOnce(new Error('private-storage-error'));
    const response = await request(app.getHttpServer())
      .get('/api/auth/google/callback')
      .query({ state: transaction.state, code: 'alice' })
      .set('Cookie', transaction.cookie)
      .expect(503);
    expect(cookie(response, 'brume_session')).toBe('');
    expect(JSON.stringify(response.body)).not.toContain(
      'private-storage-error',
    );
    expect(await db.getRepository(Session).count()).toBe(0);
    await login();
    expect(await db.getRepository(User).count()).toBe(1);
    expect(await db.getRepository(Session).count()).toBe(1);
  });
  it('rejects forged and ambiguous session cookies and accepts an anonymous logout', async () => {
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', `brume_session=${randomToken()}`)
      .expect(401);
    const { cookie: sessionCookie } = await login();
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', `${sessionCookie}; brume_session=${randomToken()}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .expect(204);
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', sessionCookie)
      .expect(200);
  });
  it('limits repeated attempts without trusting a forged X-Forwarded-For', async () => {
    for (let index = 0; index < 20; index++)
      await request(app.getHttpServer())
        .get('/api/auth/google/callback')
        .set('X-Forwarded-For', `192.0.2.${index}`)
        .expect(401);
    const response = await request(app.getHttpServer())
      .get('/api/auth/google')
      .expect(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect((response.body as { code: string }).code).toBe('RATE_LIMITED');
    expect(google.exchange).not.toHaveBeenCalled();
  });
  it('allows credentialed CORS only for the configured frontend', async () => {
    const allowed = await request(app.getHttpServer())
      .options('/api/auth/logout')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'x-csrf-protection')
      .expect(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(origin);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const denied = await request(app.getHttpServer())
      .options('/api/auth/logout')
      .set('Origin', 'https://attacker.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
  const addressInput = {
    firstName: 'Camille',
    lastName: 'Martin',
    line1: '12 rue des Lilas',
    postalCode: '69003',
    city: 'Lyon',
    country: 'FR',
    phone: '0612345678',
  };
  function write(
    method: 'post' | 'patch' | 'delete',
    path: string,
    sessionCookie: string,
  ) {
    return request(app.getHttpServer())
      [method](path)
      .set('Cookie', sessionCookie)
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1');
  }
  it('creates, lists, partially updates and deletes a private address', async () => {
    const a = await login();
    await request(app.getHttpServer())
      .get('/api/users/me/addresses')
      .set('Cookie', a.cookie)
      .expect(200, []);
    const created = await write('post', '/api/users/me/addresses', a.cookie)
      .send({
        ...addressInput,
        firstName: ' Camille ',
        label: 'Maison',
        line2: 'Appartement 2',
      })
      .expect(201);
    const address = created.body as Address;
    expect(address).toMatchObject({
      firstName: 'Camille',
      isDefault: false,
      label: 'Maison',
    });
    expect(address).not.toHaveProperty('userId');
    expect(address).not.toHaveProperty('user');
    const patched = await write(
      'patch',
      `/api/users/me/addresses/${address.id}`,
      a.cookie,
    )
      .send({ city: 'Villeurbanne', label: null, line2: null })
      .expect(200);
    expect(patched.body).toMatchObject({
      id: address.id,
      city: 'Villeurbanne',
      firstName: 'Camille',
      label: null,
      line2: null,
    });
    const listed = await request(app.getHttpServer())
      .get('/api/users/me/addresses')
      .set('Cookie', a.cookie)
      .expect(200);
    expect(listed.body).toHaveLength(1);
    await write(
      'delete',
      `/api/users/me/addresses/${address.id}`,
      a.cookie,
    ).expect(204);
    await write(
      'delete',
      `/api/users/me/addresses/${address.id}`,
      a.cookie,
    ).expect(404);
    await request(app.getHttpServer())
      .get('/api/users/me/addresses')
      .set('Cookie', a.cookie)
      .expect(200, []);
  });
  it('prevents another client from listing, updating or deleting an address', async () => {
    const a = await login();
    const b = await login('bob');
    const created = await write('post', '/api/users/me/addresses', a.cookie)
      .send(addressInput)
      .expect(201);
    const id = (created.body as Address).id;
    await request(app.getHttpServer())
      .get('/api/users/me/addresses')
      .set('Cookie', b.cookie)
      .expect(200, []);
    await write('patch', `/api/users/me/addresses/${id}`, b.cookie)
      .send({ city: 'Paris' })
      .expect(404);
    await write('delete', `/api/users/me/addresses/${id}`, b.cookie).expect(
      404,
    );
    expect((await db.getRepository(Address).findOneByOrFail({ id })).city).toBe(
      'Lyon',
    );
    await write('post', '/api/users/me/addresses', b.cookie)
      .send({
        ...addressInput,
        userId: (
          await db.getRepository(User).findOneByOrFail({ email: alice.email })
        ).id,
      })
      .expect(400);
  });
  it('rejects missing fields and invalid values with field errors and no submitted values', async () => {
    const a = await login();
    const response = await write('post', '/api/users/me/addresses', a.cookie)
      .send({ firstName: 'private-value' })
      .expect(400);
    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    const details = (response.body as { details: { field: string }[] }).details;
    expect(details.some((detail) => detail.field === 'line1')).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain('private-value');
    for (const input of [
      { ...addressInput, firstName: '   ' },
      { ...addressInput, phone: 'invalid' },
      { ...addressInput, postalCode: 'abcde' },
      { ...addressInput, isDefault: 'true' },
      { ...addressInput, line1: 'a'.repeat(201) },
    ]) {
      await write('post', '/api/users/me/addresses', a.cookie)
        .send(input)
        .expect(400);
    }
    expect(await db.getRepository(Address).count()).toBe(0);
  });
  it.each([
    ['FR', '20000'],
    ['FR', '97100'],
    ['FR', '00000'],
    ['BE', '10000'],
  ])('rejects the unsupported zone %s %s', async (country, postalCode) => {
    const a = await login();
    const response = await write('post', '/api/users/me/addresses', a.cookie)
      .send({ ...addressInput, country, postalCode })
      .expect(422);
    expect(response.body).toMatchObject({ code: 'SHIPPING_ZONE_NOT_SERVED' });
    expect(await db.getRepository(Address).count()).toBe(0);
  });
  it('rejects empty patches, invalid IDs, null required fields and unknown properties', async () => {
    const a = await login();
    const created = await write('post', '/api/users/me/addresses', a.cookie)
      .send(addressInput)
      .expect(201);
    const id = (created.body as Address).id;
    for (const patch of [
      {},
      { city: null },
      { isDefault: null },
      { userId: 'forged' },
      { firstName: 3 },
    ]) {
      await write('patch', `/api/users/me/addresses/${id}`, a.cookie)
        .send(patch)
        .expect(400);
    }
    await write('patch', `/api/users/me/addresses/${id}`, a.cookie)
      .send({ postalCode: '20000' })
      .expect(422);
    await write('patch', '/api/users/me/addresses/not-a-uuid', a.cookie)
      .send({ city: 'Paris' })
      .expect(400);
    await write(
      'delete',
      '/api/users/me/addresses/not-a-uuid',
      a.cookie,
    ).expect(400);
    expect((await db.getRepository(Address).findOneByOrFail({ id })).city).toBe(
      'Lyon',
    );
  });
  it('maintains at most one default address under concurrent creates and updates', async () => {
    const a = await login();
    const b = await login('bob');
    await write('post', '/api/users/me/addresses', b.cookie)
      .send({ ...addressInput, isDefault: true })
      .expect(201);
    const responses = await Promise.all(
      [1, 2, 3].map((n) =>
        write('post', '/api/users/me/addresses', a.cookie)
          .send({ ...addressInput, label: `Address ${n}`, isDefault: true })
          .expect(201),
      ),
    );
    const user = await db
      .getRepository(User)
      .findOneByOrFail({ email: alice.email });
    expect(
      await db
        .getRepository(Address)
        .countBy({ userId: user.id, isDefault: true }),
    ).toBe(1);
    await Promise.all(
      responses.map((response) =>
        write(
          'patch',
          `/api/users/me/addresses/${(response.body as Address).id}`,
          a.cookie,
        )
          .send({ isDefault: true })
          .expect(200),
      ),
    );
    expect(
      await db
        .getRepository(Address)
        .countBy({ userId: user.id, isDefault: true }),
    ).toBe(1);
    expect(await db.getRepository(Address).countBy({ isDefault: true })).toBe(
      2,
    );
    const defaultAddress = await db
      .getRepository(Address)
      .findOneByOrFail({ userId: user.id, isDefault: true });
    await write(
      'delete',
      `/api/users/me/addresses/${defaultAddress.id}`,
      a.cookie,
    ).expect(204);
    expect(
      await db
        .getRepository(Address)
        .countBy({ userId: user.id, isDefault: true }),
    ).toBe(0);
  });
  it('enforces the default-address uniqueness constraint in PostgreSQL', async () => {
    const a = await login();
    await write('post', '/api/users/me/addresses', a.cookie)
      .send({ ...addressInput, isDefault: true })
      .expect(201);
    const user = await db
      .getRepository(User)
      .findOneByOrFail({ email: alice.email });
    await expect(
      db
        .getRepository(Address)
        .insert({ ...addressInput, userId: user.id, isDefault: true }),
    ).rejects.toMatchObject({ driverError: { code: '23505' } });
  });
  it('requires authentication and CSRF protection for addresses', async () => {
    await request(app.getHttpServer())
      .get('/api/users/me/addresses')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/users/me/addresses')
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .send(addressInput)
      .expect(401);
    const a = await login();
    await request(app.getHttpServer())
      .post('/api/users/me/addresses')
      .set('Cookie', a.cookie)
      .set('Origin', origin)
      .send(addressInput)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/users/me/addresses')
      .set('Cookie', a.cookie)
      .set('Origin', 'https://attacker.example')
      .set('X-CSRF-Protection', '1')
      .send(addressInput)
      .expect(403);
    expect(await db.getRepository(Address).count()).toBe(0);
  });
});
