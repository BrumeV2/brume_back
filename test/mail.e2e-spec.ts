import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AddGenericEmailKind1795120000000 } from '../src/database/migrations/1795120000000-AddGenericEmailKind';
import { jest } from '@jest/globals';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { configureApp } from '../src/app.setup';
import { MailConfig } from '../src/config/mail.config';
import { CreateGoogleAccountsAndSessions1793109589589 } from '../src/database/migrations/1793109589589-CreateGoogleAccountsAndSessions';
import { ReplaceAddressesWithProfiles1793280000000 } from '../src/database/migrations/1793280000000-ReplaceAddressesWithProfiles';
import { CreateEmailNotificationsAndPasswordAccounts1795100000000 } from '../src/database/migrations/1795100000000-CreateEmailNotificationsAndPasswordAccounts';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AccountToken } from '../src/modules/auth/entities/account-token.entity';
import { AuthRateLimit } from '../src/modules/auth/entities/auth-rate-limit.entity';
import { OAuthTransaction } from '../src/modules/auth/entities/oauth-transaction.entity';
import { Session } from '../src/modules/auth/entities/session.entity';
import {
  Mail,
  MailStatus as Status,
} from '../src/modules/mail/entities/mail.entity';
import { MailjetTransport } from '../src/modules/mail/mailjet.transport';
import { MailService } from '../src/modules/mail/mail.service';
import { MailWorker } from '../src/modules/mail/mail.worker';
import { decryptPayload } from '../src/modules/mail/payload-cipher';
import { EmailPayload } from '../src/modules/mail/templates';
import { Profile } from '../src/modules/users/entities/profile.entity';
import {
  AccountStatus,
  Role,
  User,
} from '../src/modules/users/entities/user.entity';

// No real Mailjet calls: the HTTP boundary is always mocked, PostgreSQL is real.
describe('T-008 — comptes et emails transactionnels (PostgreSQL + HTTP)', () => {
  let app: INestApplication<App>;
  let db: DataSource;
  let emails: MailService;
  let worker: MailWorker;
  let config: MailConfig;
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  const origin = 'http://localhost:5173';
  const email = 'client@example.com';
  const password = 'Un long mot de passe Brume1!';
  const post = (path: string, body: object) =>
    request(app.getHttpServer())
      .post(`/api/auth/${path}`)
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .send(body);
  const success = () =>
    new Response(
      JSON.stringify({
        Messages: [{ Status: 'success', To: [{ MessageUUID: randomUUID() }] }],
      }),
      { status: 200 },
    );
  function newWorker() {
    return new MailWorker(
      db,
      { ...config, enabled: true } as MailConfig,
      app.get(MailjetTransport),
    );
  }
  async function lastPayload(kind: string) {
    const item = await db
      .getRepository(Mail)
      .createQueryBuilder('n')
      .addSelect('n.payload')
      .where('n.kind = :kind', { kind })
      .orderBy('n.created_at', 'DESC')
      .getOneOrFail();
    return decryptPayload(item.payload!, config.encryptionKey) as EmailPayload;
  }
  async function registerConfirmed() {
    await post('register', { email, password }).expect(202);
    const { token } = await lastPayload('account.confirm');
    await post('confirm-email', { token }).expect(204);
    return token!;
  }
  async function order() {
    const id = randomUUID();
    await db.transaction(async (manager) => {
      // Business fixture: the repository does not yet implement orders/payments.
      await manager.query(
        'INSERT INTO _email_test_orders (id, paid) VALUES ($1, true)',
        [id],
      );
      await emails.enqueueOrderConfirmation(manager, { id, email });
    });
    return db
      .getRepository(Mail)
      .findOneByOrFail({ eventKey: `order.confirmed:${id}` });
  }
  beforeAll(async () => {
    const database = process.env.TEST_DB_NAME;
    if (!database?.endsWith('_test'))
      throw new Error('TEST_DB_NAME doit finir par _test (base jetable).');
    const fixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          skipProcessEnv: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              CORS_ORIGIN: origin,
              AUTH_SUCCESS_URL: `${origin}/compte`,
              AUTH_RATE_LIMIT: '1000',
              EMAIL_ENABLED: 'false',
              EMAIL_ENCRYPTION_KEY: 'ab'.repeat(32),
              MAILJET_API_KEY: 'fake-public',
              MAILJET_API_SECRET: 'fake-private',
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
            Profile,
            Session,
            AccountToken,
            AuthRateLimit,
            OAuthTransaction,
            Mail,
          ],
          migrations: [
            AddGenericEmailKind1795120000000,
            CreateGoogleAccountsAndSessions1793109589589,
            ReplaceAddressesWithProfiles1793280000000,
            CreateEmailNotificationsAndPasswordAccounts1795100000000,
          ],
          migrationsRun: true,
          synchronize: false,
          retryAttempts: 0,
        }),
        AuthModule,
      ],
    }).compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DataSource);
    emails = app.get(MailService);
    config = app.get(MailConfig);
    await db.query(
      'CREATE TABLE IF NOT EXISTS _email_test_orders (id uuid PRIMARY KEY, paid boolean NOT NULL)',
    );
  });
  beforeEach(async () => {
    await db.query(
      'TRUNCATE utilisateurs, email_notifications, auth_rate_limits, _email_test_orders CASCADE',
    );
    fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(success()));
    worker = newWorker();
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (db) await db.query('DROP TABLE IF EXISTS _email_test_orders');
    if (app) await app.close();
  });

  it('renvoie un access token utilisable en Bearer et le révoque au logout', async () => {
    await registerConfirmed();
    const response = await post('login', { email, password }).expect(200);
    const body = response.body as {
      accessToken: string;
      tokenType: string;
      expiresIn: number;
    };
    expect(body.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.tokenType).toBe('Bearer');
    expect(body.expiresIn).toBe(86400);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie'][0]).toContain(body.accessToken);
    const bearer = `Bearer ${body.accessToken}`;
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', bearer)
      .expect(200);
    await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', bearer)
      .send({ firstName: 'Camille' })
      .expect(200);
    const denied = await request(app.getHttpServer())
      .get('/api/admin/mails')
      .set('Authorization', bearer)
      .expect(403);
    expect(denied.body).toMatchObject({
      code: 'ADMIN_REQUIRED',
      requestId: denied.headers['x-request-id'],
    });
    await db.getRepository(User).update({ email }, { role: Role.ADMIN });
    await request(app.getHttpServer())
      .post('/api/admin/mails')
      .set('Authorization', bearer)
      .send({
        to: 'demo@example.com',
        eventKey: 'bearer:mail-1',
        subject: 'Bonjour',
        content: 'Message de test.',
      })
      .expect(202);
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', bearer)
      .expect(204);
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', bearer)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', response.headers['set-cookie'])
      .expect(401);
  });
  it('refuse un Bearer invalide même si un cookie valide est présent', async () => {
    await registerConfirmed();
    const login = await post('login', { email, password }).expect(200);
    for (const authorization of [
      'Basic abc',
      'Bearer invalid',
      `Bearer ${'x'.repeat(43)}`,
    ]) {
      await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Cookie', login.headers['set-cookie'])
        .set('Authorization', authorization)
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/admin/mails')
        .set('Authorization', authorization)
        .send({})
        .expect(401);
    }
  });
  it('refuse les access tokens expirés et conserve un code de session générique', async () => {
    await registerConfirmed();
    const login = await post('login', { email, password }).expect(200);
    const { accessToken } = login.body as { accessToken: string };
    await db.query("UPDATE sessions SET expires_at=now()-interval '1 minute'");
    const rejected = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
    expect(rejected.body).toMatchObject({ code: 'UNAUTHENTICATED' });
  });
  it('distingue les erreurs de login sans divulguer les comptes pour de mauvais identifiants', async () => {
    const unknown = await post('login', { email, password }).expect(401);
    expect(unknown.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await post('register', { email, password }).expect(202);
    const incorrect = await post('login', {
      email,
      password: 'incorrect',
    }).expect(401);
    expect(incorrect.body).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: (unknown.body as { message: string }).message,
    });
    const pending = await post('login', { email, password }).expect(403);
    expect(pending.body).toMatchObject({ code: 'EMAIL_NOT_CONFIRMED' });
    const { token } = await lastPayload('account.confirm');
    await post('confirm-email', { token }).expect(204);
    await db
      .getRepository(User)
      .update({ email }, { status: AccountStatus.BLOCKED });
    const blocked = await post('login', { email, password }).expect(403);
    expect(blocked.body).toMatchObject({ code: 'ACCOUNT_BLOCKED' });
  });
  it('autorise le header Authorization dans CORS et expose l’identifiant de requête', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/users/me')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);
    expect(response.headers['access-control-allow-headers']).toContain(
      'Authorization',
    );
    expect(response.headers['access-control-expose-headers']).toContain(
      'X-Request-ID',
    );
  });
  it('expose la mise en file générique dans Swagger et répond 202 sans envoi synchrone', async () => {
    await registerConfirmed();
    await db.getRepository(User).update({ email }, { role: Role.ADMIN });
    const login = await post('login', { email, password }).expect(200);
    const cookie = login.headers['set-cookie'] as unknown as string[];
    const input = {
      to: 'demo@example.com',
      eventKey: 'http:message-1',
      subject: 'Bonjour de Brume',
      content: 'Bonjour,\n\nVotre demande est reçue.',
    };
    const send = () =>
      request(app.getHttpServer())
        .post('/api/admin/mails')
        .set('Cookie', cookie)
        .set('Origin', origin)
        .set('X-CSRF-Protection', '1')
        .send(input);
    const first = await send().expect(202);
    const second = await send().expect(202);
    expect(first.body).toMatchObject({
      kind: 'email.generic',
      status: Status.PENDING,
      recipient: input.to,
    });
    expect((second.body as { id: string }).id).toBe(
      (first.body as { id: string }).id,
    );
    expect(typeof (first.body as { id: string }).id).toBe('string');
    expect(first.body).not.toHaveProperty('payload');
    expect(
      await db.getRepository(Mail).countBy({ kind: 'email.generic' }),
    ).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    expect(document.paths['/api/admin/mails'].post?.requestBody).toBeDefined();
    expect(
      document.paths['/api/admin/mails'].post?.responses['202'],
    ).toBeDefined();
    expect(document.components?.schemas?.SendMailDto).toBeDefined();
  });
  it('réserve l’envoi HTTP aux administrateurs avec session et protection CSRF', async () => {
    const input = {
      to: 'demo@example.com',
      eventKey: 'http:access',
      subject: 'Test',
      content: 'Bonjour',
    };
    const send = () =>
      request(app.getHttpServer())
        .post('/api/admin/mails')
        .set('Origin', origin)
        .set('X-CSRF-Protection', '1');
    await send().send(input).expect(401);
    await registerConfirmed();
    const login = await post('login', { email, password }).expect(200);
    const cookie = login.headers['set-cookie'] as unknown as string[];
    await send().set('Cookie', cookie).send(input).expect(403);
    await db.getRepository(User).update({ email }, { role: Role.ADMIN });
    await request(app.getHttpServer())
      .post('/api/admin/mails')
      .set('Cookie', cookie)
      .send(input)
      .expect(403);
    expect(
      await db.getRepository(Mail).countBy({ kind: 'email.generic' }),
    ).toBe(0);
  });
  it('renvoie 400 pour un objet, un contenu ou un bouton invalide, sans créer de mail', async () => {
    await registerConfirmed();
    await db.getRepository(User).update({ email }, { role: Role.ADMIN });
    const login = await post('login', { email, password }).expect(200);
    const cookie = login.headers['set-cookie'] as unknown as string[];
    const base = {
      to: 'demo@example.com',
      eventKey: 'http:validation',
      subject: 'Test',
      content: 'Bonjour',
    };
    for (const patch of [
      { to: 'invalid' },
      { subject: '   ' },
      { subject: 'Injected\r\nBcc: other@example.com' },
      { content: '' },
      { eventKey: '   ' },
      { title: null },
      { preheader: null },
      { action: null },
      { action: [] },
      { action: { label: 'Voir', url: 'javascript:alert(1)' } },
      { action: { label: 'Voir', url: 'https://user:secret@example.com' } },
      {
        action: { label: 'Voir', url: 'https://brume.example', unknown: true },
      },
      { unknown: 'value' },
    ]) {
      await request(app.getHttpServer())
        .post('/api/admin/mails')
        .set('Cookie', cookie)
        .set('Origin', origin)
        .set('X-CSRF-Protection', '1')
        .send({ ...base, ...patch })
        .expect(400);
    }
    expect(
      await db.getRepository(Mail).countBy({ kind: 'email.generic' }),
    ).toBe(0);
  });
  it('met en file un email générique chiffré, le déduplique et l’envoie dans le modèle Brume', async () => {
    const input = {
      to: email,
      eventKey: 'support:message-42',
      subject: 'Un message pour vous',
      content: 'Bonjour Camille,\n\nVotre demande est prise en compte.',
      title: 'Prenons le temps.',
      action: { label: 'Voir mon compte', url: `${origin}/compte` },
    };
    const first = await emails.sendEmail(input);
    const second = await emails.sendEmail(input);
    expect(first.id).toBe(second.id);
    expect(first).not.toHaveProperty('payload');
    expect(first).toMatchObject({
      kind: 'email.generic',
      status: Status.PENDING,
    });
    const stored = await db
      .getRepository(Mail)
      .createQueryBuilder('n')
      .addSelect('n.payload')
      .getOneOrFail();
    expect(stored.payload).not.toContain(input.content);
    await worker.tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const wire = JSON.parse(fetchMock.mock.calls[0][1]!.body as string) as {
      Messages: { Subject: string; HTMLPart: string; TextPart: string }[];
    };
    expect(wire.Messages[0].Subject).toBe(input.subject);
    expect(wire.Messages[0].HTMLPart).toContain('#f4f1eb');
    expect(wire.Messages[0].HTMLPart).toContain('Prenons le temps.');
    expect(wire.Messages[0].TextPart).toContain(input.content);
    expect(
      await db.getRepository(Mail).findOneByOrFail({ id: first.id }),
    ).toMatchObject({ status: Status.SENT });
  });
  it('annule l’email générique avec sa transaction métier', async () => {
    await expect(
      db.transaction(async (manager) => {
        await emails.sendEmail(
          {
            to: email,
            eventKey: 'cancelled:message',
            subject: 'Test',
            content: 'Message de test.',
          },
          manager,
        );
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await db.getRepository(Mail).count()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('refuse un contenu générique invalide avant de le mettre en file', async () => {
    await expect(
      emails.sendEmail({
        to: email,
        eventKey: 'invalid:message',
        subject: 'Test',
        content: 'Bonjour',
        action: { label: 'Lien', url: 'javascript:alert(1)' },
      }),
    ).rejects.toThrow();
    expect(await db.getRepository(Mail).count()).toBe(0);
  });
  it('conserve une opération payée pendant une panne et reprend après redémarrage sans doublon', async () => {
    const item = await order();
    fetchMock.mockRejectedValueOnce(
      new TypeError('network failure', { cause: { code: 'ECONNREFUSED' } }),
    );
    await worker.tick();
    expect(await db.query('SELECT paid FROM _email_test_orders')).toEqual([
      { paid: true },
    ]);
    expect(
      await db.getRepository(Mail).findOneByOrFail({ id: item.id }),
    ).toMatchObject({
      status: Status.RETRY,
      attempts: 1,
      lastError: 'MAILJET_UNREACHABLE',
    });
    await emails.retry(item.id);
    await Promise.all([newWorker().tick(), newWorker().tick()]);
    await newWorker().tick();
    expect(fetchMock).toHaveBeenCalledTimes(2); // failed connection + one accepted send
    expect(
      await db.getRepository(Mail).findOneByOrFail({ id: item.id }),
    ).toMatchObject({ status: Status.SENT });
    await expect(emails.retry(item.id)).rejects.toThrow();
  });
  it('une relivraison concurrente du même événement ne crée qu’une demande', async () => {
    const item = await order();
    const id = item.eventKey.split(':')[1];
    await Promise.all(
      Array.from({ length: 5 }, () =>
        db.transaction((manager) =>
          emails.enqueueOrderConfirmation(manager, { id, email }),
        ),
      ),
    );
    expect(await db.getRepository(Mail).count()).toBe(1);
    await Promise.all([worker.tick(), newWorker().tick()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('annule aussi la demande email si la transaction métier échoue', async () => {
    const id = randomUUID();
    await expect(
      db.transaction(async (manager) => {
        await manager.query(
          'INSERT INTO _email_test_orders VALUES ($1, true)',
          [id],
        );
        await emails.enqueueOrderConfirmation(manager, { id, email });
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(await db.getRepository(Mail).count()).toBe(0);
    expect(await db.query('SELECT * FROM _email_test_orders')).toEqual([]);
    await expect(
      emails.enqueueOrderConfirmation(db.manager, { id, email }),
    ).rejects.toThrow('transaction');
  });
  it('ne transmet que l’identifiant et le lien de commande, sans secrets ni données de paiement', async () => {
    const item = await order();
    await worker.tick();
    const wire = JSON.parse(fetchMock.mock.calls[0][1]!.body as string) as {
      Messages: Record<string, unknown>[];
    };
    const message = wire.Messages[0];
    expect(message).toMatchObject({
      To: [{ Email: email }],
      CustomID: item.id,
      DeduplicateCampaign: true,
      TrackClicks: 'disabled',
    });
    expect(message.TextPart).toContain(`${origin}/compte/commandes/`);
    expect(JSON.stringify(message)).not.toMatch(
      /fake-private|password|token|card|cvc|client_secret/i,
    );
    const stored = await db
      .getRepository(Mail)
      .createQueryBuilder('n')
      .addSelect('n.payload')
      .getOneOrFail();
    expect(stored.payload).toBeNull();
  });
  it('ne renvoie jamais automatiquement un envoi dont la réponse est incertaine', async () => {
    const item = await order();
    fetchMock.mockRejectedValueOnce(new Error('timeout'));
    await worker.tick();
    await newWorker().tick();
    expect(
      await db.getRepository(Mail).findOneByOrFail({ id: item.id }),
    ).toMatchObject({ status: Status.UNCERTAIN });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(emails.retry(item.id)).rejects.toThrow();
  });
  it('classe un worker interrompu comme incertain sans nouvel envoi', async () => {
    const item = await order();
    await db.query(
      "UPDATE email_notifications SET status='sending', updated_at=now()-interval '11 minutes' WHERE id=$1",
      [item.id],
    );
    await worker.tick();
    expect(
      await db.getRepository(Mail).findOneByOrFail({ id: item.id }),
    ).toMatchObject({
      status: Status.UNCERTAIN,
      lastError: 'WORKER_INTERRUPTED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('borne les essais, respecte le délai et autorise la reprise d’un échec certain', async () => {
    const item = await order();
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response('', { status: 429 })),
    );
    const limited = new MailWorker(
      db,
      { ...config, enabled: true, maxAttempts: 2 } as MailConfig,
      app.get(MailjetTransport),
    );
    await limited.tick();
    await limited.tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await db.query(
      'UPDATE email_notifications SET next_attempt_at=now() WHERE id=$1',
      [item.id],
    );
    await limited.tick();
    expect(
      await db.getRepository(Mail).findOneByOrFail({ id: item.id }),
    ).toMatchObject({ status: Status.FAILED, attempts: 2 });
    fetchMock.mockImplementation(() => Promise.resolve(success()));
    await emails.retry(item.id);
    await limited.tick();
    expect(
      await db.getRepository(Mail).findOneByOrFail({ id: item.id }),
    ).toMatchObject({ status: Status.SENT });
  });
  it('inscrit, confirme puis connecte via un cookie sécurisé contre JavaScript', async () => {
    await post('register', { email: ' CLIENT@example.com ', password }).expect(
      202,
    );
    await post('login', { email, password }).expect(403);
    const { token } = await lastPayload('account.confirm');
    const raw = await db.query<{ password_hash: string }[]>(
      'SELECT password_hash FROM utilisateurs',
    );
    expect(raw[0].password_hash).not.toContain(password);
    expect(
      (await db.getRepository(User).findOneByOrFail({ email })).passwordHash,
    ).toBeUndefined();
    const encrypted = await db.query<{ payload: string }[]>(
      'SELECT payload FROM email_notifications',
    );
    expect(encrypted[0].payload).not.toContain(token);
    await post('confirm-email', { token }).expect(204);
    await post('confirm-email', { token }).expect(400);
    const response = await post('login', { email, password }).expect(200);
    expect(response.headers['set-cookie'][0]).toMatch(
      /brume_session=.+HttpOnly/,
    );
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', response.headers['set-cookie'])
      .expect(200);
    await post('login', { email, password: 'wrong' }).expect(401);
  });
  it('garde l’inscription en cas de panne et ne remplace pas un compte existant', async () => {
    await post('register', { email, password }).expect(202);
    fetchMock.mockRejectedValueOnce(
      new TypeError('offline', { cause: { code: 'ENOTFOUND' } }),
    );
    await worker.tick();
    expect(await db.getRepository(User).count()).toBe(1);
    await post('register', {
      email: email.toUpperCase(),
      password: 'Other secret password1!',
    }).expect(202);
    expect(await db.getRepository(User).count()).toBe(1);
    expect(await db.getRepository(Mail).count()).toBe(1);
  });
  it('réinitialise une seule fois et révoque les sessions existantes', async () => {
    await registerConfirmed();
    const login = await post('login', { email, password }).expect(200);
    await post('forgot-password', { email }).expect(202);
    const { token } = await lastPayload('account.reset');
    const next = 'Nouveau mot de passe Brume1!';
    await post('reset-password', { token, password: next }).expect(204);
    await post('reset-password', { token, password: next }).expect(400);
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', login.headers['set-cookie'])
      .expect(401);
    await post('login', { email, password }).expect(401);
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set(
        'Authorization',
        `Bearer ${(login.body as { accessToken: string }).accessToken}`,
      )
      .expect(401);
    await post('login', { email, password: next }).expect(200);
  });
  it('une consommation concurrente du même jeton ne réussit qu’une fois', async () => {
    await registerConfirmed();
    await post('forgot-password', { email }).expect(202);
    const { token } = await lastPayload('account.reset');
    const responses = await Promise.all([
      post('reset-password', { token, password }),
      post('reset-password', { token, password }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([204, 400]);
  });
  it('refuse les jetons expirés, ne les envoie plus et permet de renouveler une confirmation', async () => {
    await post('register', { email, password }).expect(202);
    const old = await lastPayload('account.confirm');
    await db.query(
      "UPDATE account_tokens SET expires_at=now()-interval '1 minute'",
    );
    await post('confirm-email', { token: old.token }).expect(400);
    await post('resend-confirmation', { email }).expect(202);
    const fresh = await lastPayload('account.confirm');
    expect(fresh.token).not.toBe(old.token);
    await post('confirm-email', { token: old.token }).expect(400);
    await post('confirm-email', { token: fresh.token }).expect(204);
  });
  it('répond de façon générique aux adresses inconnues et protège les comptes Google', async () => {
    const a = await post('forgot-password', { email }).expect(202);
    await db
      .getRepository(User)
      .insert({ email, googleSub: 'google-only', emailVerifiedAt: new Date() });
    const b = await post('forgot-password', { email }).expect(202);
    expect(a.body).toEqual(b.body);
    expect(await db.getRepository(AccountToken).count()).toBe(0);
    await post('login', { email, password }).expect(401);
  });
  it('protège les routes par CSRF, validation, rôle et session ; masque les payloads aux administrateurs', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password })
      .expect(403);
    await post('register', { email, password: 'short', role: 'ADMIN' }).expect(
      400,
    );
    await registerConfirmed();
    const login = await post('login', { email, password }).expect(200);
    const cookie = login.headers['set-cookie'] as unknown as string[];
    await request(app.getHttpServer()).get('/api/admin/mails').expect(401);
    await request(app.getHttpServer())
      .get('/api/admin/mails')
      .set('Cookie', cookie)
      .expect(403);
    await db.getRepository(User).update({ email }, { role: Role.ADMIN });
    const response = await request(app.getHttpServer())
      .get('/api/admin/mails')
      .set('Cookie', cookie)
      .expect(200);
    expect((response.body as { items: object[] }).items[0]).not.toHaveProperty(
      'payload',
    );
    expect(JSON.stringify(response.body)).not.toMatch(
      /token|fake-private|scrypt/,
    );
    await db.getRepository(Mail).delete({ kind: 'account.confirm' });
    const item = await order();
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve(new Response('', { status: 401 })),
    );
    await worker.tick();
    expect(
      await db.getRepository(Mail).findOneByOrFail({ id: item.id }),
    ).toMatchObject({ status: Status.FAILED });
    await request(app.getHttpServer())
      .post(`/api/admin/mails/${item.id}/retry`)
      .set('Cookie', cookie)
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/admin/mails/${item.id}/retry`)
      .set('Cookie', cookie)
      .set('Origin', origin)
      .set('X-CSRF-Protection', '1')
      .expect(409);
  });
  it('applique et annule la migration sur un schéma vide sans perte de compatibilité', async () => {
    const runner = db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const migration =
        new CreateEmailNotificationsAndPasswordAccounts1795100000000();
      await migration.down(runner);
      await migration.up(runner);
      const columns = (await runner.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name='utilisateurs'",
      )) as { column_name: string }[];
      expect(
        columns.some((column) => column.column_name === 'password_hash'),
      ).toBe(true);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });
  it('refuse un rollback qui détruirait des comptes locaux', async () => {
    await post('register', { email, password }).expect(202);
    const runner = db.createQueryRunner();
    await runner.connect();
    try {
      await expect(
        new CreateEmailNotificationsAndPasswordAccounts1795100000000().down(
          runner,
        ),
      ).rejects.toThrow('comptes locaux');
    } finally {
      await runner.release();
    }
    expect(await db.getRepository(User).count()).toBe(1);
  });
  it('annule l’envoi d’un lien expiré', async () => {
    await post('register', { email, password }).expect(202);
    const future = Date.now() + 25 * 3600 * 1000;
    jest.spyOn(Date, 'now').mockReturnValue(future);
    await worker.tick();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      await db.getRepository(Mail).findOneByOrFail({ kind: 'account.confirm' }),
    ).toMatchObject({ status: Status.CANCELLED, lastError: 'LINK_EXPIRED' });
  });
  it('annule la création du compte si l’outbox ne peut pas être enregistrée', async () => {
    const spy = jest
      .spyOn(emails, 'enqueueAccount')
      .mockRejectedValueOnce(new Error('database unavailable'));
    await post('register', { email, password }).expect(503);
    expect(await db.getRepository(User).count()).toBe(0);
    expect(await db.getRepository(Profile).count()).toBe(0);
    spy.mockRestore();
  });
});
