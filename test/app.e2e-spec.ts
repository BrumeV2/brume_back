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
          entities: [User, Session, OAuthTransaction, AuthRateLimit],
          migrations: [CreateGoogleAccountsAndSessions1793109589589],
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
      'TRUNCATE TABLE sessions, utilisateurs, oauth_transactions, auth_rate_limits CASCADE',
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
  it('documents the implemented auth routes and profile consistently with the shared contract', () => {
    const contract = parse(
      readFileSync('docs/contract/openapi.yaml', 'utf8'),
    ) as OpenAPIObject;
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setVersion('1.0.0')
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
        expected.parameters
          ?.map((parameter) => ('name' in parameter ? parameter.name : ''))
          .sort() ?? [],
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
});
