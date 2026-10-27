import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { generateKeyPairSync, sign } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { CertificateFormat } from 'google-auth-library/build/src/auth/oauth2client';
import type {
  GetTokenOptions,
  GetTokenResponse,
} from 'google-auth-library/build/src/auth/oauth2client';
import { AuthConfig } from './auth.config';
import { GoogleOidcProvider } from './google.provider';

describe('GoogleOidcProvider (real JWT verification, mocked Google network)', () => {
  const clientId = 'brume-test.apps.googleusercontent.com';
  const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const otherKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
  let provider: GoogleOidcProvider;
  type Exchange = (options: GetTokenOptions) => Promise<GetTokenResponse>;
  let exchange: jest.SpiedFunction<Exchange>;

  function jwt(
    overrides: Record<string, unknown> = {},
    invalidSignature = false,
  ) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: 'https://accounts.google.com',
      aud: clientId,
      sub: 'google-123',
      iat: now,
      exp: now + 300,
      nonce: 'nonce',
      email: 'Camille@example.com',
      email_verified: true,
      given_name: 'Camille',
      ...overrides,
    };
    const data = [{ alg: 'RS256', kid: 'test-key', typ: 'JWT' }, payload]
      .map((part) => Buffer.from(JSON.stringify(part)).toString('base64url'))
      .join('.');
    return `${data}.${sign('RSA-SHA256', Buffer.from(data), invalidSignature ? otherKeys.privateKey : keys.privateKey).toString('base64url')}`;
  }

  function googleReturns(token: string) {
    exchange.mockResolvedValue({
      tokens: { id_token: token },
      res: null,
    } satisfies GetTokenResponse);
  }

  beforeEach(() => {
    jest
      .spyOn(OAuth2Client.prototype, 'getFederatedSignonCertsAsync')
      .mockResolvedValue({
        certs: {
          'test-key': keys.publicKey
            .export({ format: 'pem', type: 'spki' })
            .toString(),
        },
        format: CertificateFormat.PEM,
      });
    // Select the Promise overload instead of the callback overload for the spy.
    exchange = jest.spyOn(
      OAuth2Client.prototype as { getToken: Exchange },
      'getToken',
    );
    provider = new GoogleOidcProvider(
      new AuthConfig(
        new ConfigService({
          GOOGLE_CLIENT_ID: clientId,
          GOOGLE_CLIENT_SECRET: 'test-only',
        }),
      ),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('requests only identity scopes and binds state, nonce and PKCE', () => {
    const params = new URL(
      provider.authorizationUrl('state', 'nonce', 'verifier'),
    ).searchParams;
    expect(params.get('scope')).toBe('openid email profile');
    expect(params.get('state')).toBe('state');
    expect(params.get('nonce')).toBe('nonce');
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('code_challenge')).toHaveLength(43);
    expect(params.has('code_verifier')).toBe(false);
  });

  it('verifies a signed Google token and returns only validated identity fields', async () => {
    googleReturns(jwt());
    await expect(
      provider.exchange('code', 'nonce', 'verifier'),
    ).resolves.toEqual({
      sub: 'google-123',
      email: 'camille@example.com',
      firstName: 'Camille',
      lastName: null,
    });
    expect(exchange).toHaveBeenCalledWith({
      code: 'code',
      codeVerifier: 'verifier',
      redirect_uri: 'http://localhost:3000/api/auth/google/callback',
    });
  });

  it.each([
    ['issuer', { iss: 'https://attacker.example' }],
    ['audience', { aud: 'other-client' }],
    [
      'expiry (even within library clock tolerance)',
      { exp: Math.floor(Date.now() / 1000) - 1 },
    ],
    ['nonce', { nonce: 'other-nonce' }],
    ['unverified email', { email_verified: false }],
    ['invalid email', { email: 'invalid' }],
    ['missing subject', { sub: '' }],
    ['malformed subject', { sub: 42 }],
    ['malformed email', { email: 42 }],
    ['malformed profile', { given_name: 42 }],
    ['future issue time', { iat: Math.floor(Date.now() / 1000) + 120 }],
    ['authorized party', { azp: 'other-client' }],
  ])('rejects invalid %s', async (_name, claims) => {
    googleReturns(jwt(claims));
    await expect(
      provider.exchange('code', 'nonce', 'verifier'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a forged signature', async () => {
    googleReturns(jwt({}, true));
    await expect(
      provider.exchange('code', 'nonce', 'verifier'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('sanitizes provider errors and reports a service outage', async () => {
    exchange.mockRejectedValue({
      response: { status: 503 },
      message: 'secret-code-and-token',
    });
    await expect(
      provider.exchange('code', 'nonce', 'verifier'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    exchange.mockRejectedValue(new Error('secret-code-and-token'));
    await expect(
      provider.exchange('code', 'nonce', 'verifier'),
    ).rejects.toMatchObject({
      response: {
        code: 'AUTH_UNAVAILABLE',
        message: 'Service de connexion indisponible. Réessayez.',
      },
    });
  });

  it('rejects an invalid authorization code without exposing the provider error', async () => {
    exchange.mockRejectedValue({
      response: { status: 400, data: { error: 'invalid_grant' } },
      message: 'secret-code',
    });
    await expect(
      provider.exchange('code', 'nonce', 'verifier'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('fails closed when Google has not been configured', () => {
    const unconfigured = new GoogleOidcProvider(
      new AuthConfig(new ConfigService({})),
    );
    expect(() =>
      unconfigured.authorizationUrl('state', 'nonce', 'verifier'),
    ).toThrow(ServiceUnavailableException);
  });
});
