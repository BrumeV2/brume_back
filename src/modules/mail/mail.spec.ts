import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { MailConfig } from '../../config/mail.config';
import { Mail } from './entities/mail.entity';
import { EmailDeliveryError, MailjetTransport } from './mailjet.transport';
import { decryptPayload, encryptPayload } from './payload-cipher';
import { renderEmail } from './templates';
function config(values: Record<string, string> = {}) {
  const service = new ConfigService();
  jest
    .spyOn(service, 'get')
    .mockImplementation(
      (key: string, fallback?: unknown) => values[key] ?? fallback,
    );
  return new MailConfig(service);
}
describe('Configuration et confidentialité des emails', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each([
    { EMAIL_ENABLED: 'yes' },
    { EMAIL_ENABLED: 'true' },
    { EMAIL_ENCRYPTION_KEY: 'bad' },
    { EMAIL_POLL_MS: '0' },
    { EMAIL_MAX_ATTEMPTS: '2.5' },
    { EMAIL_FROM: 'not-an-email' },
    { FRONTEND_URL: 'https://shop.example/?secret=123' },
    { FRONTEND_URL: 'https://user:pass@shop.example/' },
    { FRONTEND_URL: 'https://shop.example/path' },
    { NODE_ENV: 'production', FRONTEND_URL: 'http://shop.example' },
  ])('refuse une configuration invalide %j', (values) => {
    expect(() => config(values)).toThrow();
  });
  it('chiffre les jetons avec un IV aléatoire et détecte toute altération', () => {
    const key = Buffer.alloc(32, 1);
    const data = { token: 'secret-token' };
    const first = encryptPayload(data, key);
    const second = encryptPayload(data, key);
    expect(first).not.toBe(second);
    expect(first).not.toContain(data.token);
    expect(decryptPayload(first, key)).toEqual(data);
    const tampered = Buffer.from(first, 'base64');
    tampered[30] ^= 1;
    expect(() => decryptPayload(tampered.toString('base64'), key)).toThrow();
    expect(() => decryptPayload(first, Buffer.alloc(32, 2))).toThrow();
    expect(() => encryptPayload(data, null)).toThrow();
  });
  it('échappe le HTML et ne sérialise pas les propriétés étrangères du payload', () => {
    const message = renderEmail(
      'order.confirmed',
      { orderId: '<script>"', token: 'never-include-this' },
      'https://shop.example',
    );
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
    expect(JSON.stringify(message)).not.toContain('never-include-this');
  });
  it('met les jetons de compte dans le fragment du lien', () => {
    const result = renderEmail(
      'account.reset',
      { token: 'abc' },
      'https://shop.example',
    );
    expect(result.text).toContain('/reset-password#token=abc');
    expect(result.text).not.toContain('?token=');
  });
  it.each([429, 400, 401, 503])(
    'classe la réponse HTTP %s sans conserver son contenu',
    async (status) => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response('secret provider response', { status }),
        );
      const transport = new MailjetTransport(config());
      try {
        await transport.send(
          {
            id: 'mail-id',
            recipient: 'demo@example.com',
          } as Mail,
          renderEmail(
            'order.confirmed',
            { orderId: '123' },
            'https://shop.example',
          ),
        );
        throw new Error('Expected delivery failure');
      } catch (error) {
        expect(error).toBeInstanceOf(EmailDeliveryError);
        const failure = error as EmailDeliveryError;
        expect(failure.category).toBe(
          status === 429 ? 'retry' : status >= 500 ? 'uncertain' : 'failed',
        );
        expect(failure.message).not.toContain('secret');
      }
    },
  );
  it.each(['{}', 'not json', '{"Messages":[{"Status":"error"}]}'])(
    'ne considère jamais une réponse inattendue comme un succès',
    async (body) => {
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(body, { status: 200 }));
      await expect(
        new MailjetTransport(config()).send(
          { id: 'id', recipient: 'demo@example.com' } as Mail,
          renderEmail(
            'order.confirmed',
            { orderId: '123' },
            'https://shop.example',
          ),
        ),
      ).rejects.toBeInstanceOf(EmailDeliveryError);
    },
  );
});
