import { jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { AuthConfig } from './auth.config';

// Unit fixtures must not inherit credentials or cookie settings from Docker/.env.
function isolatedConfig(values: Record<string, string | undefined> = {}) {
  const config = new ConfigService(values);
  jest
    .spyOn(config, 'get')
    .mockImplementation(
      (key: string, fallback?: unknown) => values[key] ?? fallback,
    );
  return config;
}

describe('AuthConfig', () => {
  it('allows localhost development without Google credentials', () => {
    expect(new AuthConfig(isolatedConfig({})).secure).toBe(false);
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
    expect(() => new AuthConfig(isolatedConfig(values))).toThrow();
  });

  it('accepts an HTTPS production configuration', () => {
    const config = new AuthConfig(
      isolatedConfig({
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
