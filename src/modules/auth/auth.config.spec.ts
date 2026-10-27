import { ConfigService } from '@nestjs/config';
import { AuthConfig } from './auth.config';

describe('AuthConfig', () => {
  it('allows localhost development without Google credentials', () => {
    expect(new AuthConfig(new ConfigService({})).secure).toBe(false);
  });

  it.each([
    { NODE_ENV: 'production' },
    { AUTH_SESSION_TTL_SECONDS: '-1' },
    { AUTH_RATE_LIMIT: 'NaN' },
    { AUTH_TRUST_PROXY_HOPS: '-1' },
    { CORS_ORIGIN: '*' },
    { CORS_ORIGIN: '' },
    { CORS_ORIGIN: 'https://shop.example/' },
    { AUTH_SUCCESS_URL: 'https://attacker.example/' },
    {
      AUTH_COOKIE_SECURE: 'false',
      CORS_ORIGIN: 'https://shop.example',
      AUTH_SUCCESS_URL: 'https://shop.example/',
    },
    { GOOGLE_REDIRECT_URI: 'http://api.example/api/auth/google/callback' },
  ])('rejects unsafe configuration %j', (values) => {
    expect(() => new AuthConfig(new ConfigService(values))).toThrow();
  });

  it('accepts an HTTPS production configuration', () => {
    const config = new AuthConfig(
      new ConfigService({
        NODE_ENV: 'production',
        GOOGLE_CLIENT_ID: 'test',
        GOOGLE_CLIENT_SECRET: 'test',
        GOOGLE_REDIRECT_URI: 'https://api.example/api/auth/google/callback',
        AUTH_SUCCESS_URL: 'https://shop.example/',
        CORS_ORIGIN: 'https://shop.example',
      }),
    );
    expect(config.secure).toBe(true);
  });
});
