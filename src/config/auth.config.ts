import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseAbsoluteUrl, parseCorsOrigins } from './config';

@Injectable()
export class AuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly successUrl: string;
  readonly secure: boolean;
  readonly sessionTtl: number;
  readonly rateLimit: number;
  readonly rateWindow: number;
  readonly trustProxyHops: number;
  readonly allowedOrigins: string[];
  readonly transactionTtl = 600;

  constructor(config: ConfigService) {
    const isProduction = config.get<string>('NODE_ENV') === 'production';

    this.clientId = (config.get<string>('GOOGLE_CLIENT_ID') ?? '').trim();
    this.clientSecret = (
      config.get<string>('GOOGLE_CLIENT_SECRET') ?? ''
    ).trim();

    const rawRedirectUri = config.get<string>(
      'GOOGLE_REDIRECT_URI',
      isProduction ? '' : 'http://localhost:3000/api/auth/google/callback',
    );
    if (!rawRedirectUri || rawRedirectUri.trim() === '') {
      throw new Error('GOOGLE_REDIRECT_URI obligatoire.');
    }
    const parsedRedirectUri = parseAbsoluteUrl(
      rawRedirectUri.trim(),
      'GOOGLE_REDIRECT_URI',
    );
    this.redirectUri = rawRedirectUri.trim();

    const rawSuccessUrl = config.get<string>(
      'AUTH_SUCCESS_URL',
      isProduction ? '' : 'http://localhost:5173/',
    );
    if (!rawSuccessUrl || rawSuccessUrl.trim() === '') {
      throw new Error('AUTH_SUCCESS_URL obligatoire.');
    }
    const parsedSuccessUrl = parseAbsoluteUrl(
      rawSuccessUrl.trim(),
      'AUTH_SUCCESS_URL',
    );
    this.successUrl = rawSuccessUrl.trim();

    const rawCors = config.get<string>(
      'CORS_ORIGIN',
      isProduction ? '' : 'http://localhost:5173',
    );
    if (!rawCors || rawCors.trim() === '') {
      throw new Error('CORS_ORIGIN obligatoire.');
    }
    this.allowedOrigins = parseCorsOrigins(rawCors.trim());

    if (!this.allowedOrigins.includes(parsedSuccessUrl.origin)) {
      throw new Error('AUTH_SUCCESS_URL doit appartenir à CORS_ORIGIN.');
    }

    const rawSecure = config.get<string>(
      'AUTH_COOKIE_SECURE',
      isProduction ? 'true' : 'false',
    );
    if (rawSecure !== 'true' && rawSecure !== 'false') {
      throw new Error('AUTH_COOKIE_SECURE doit être true ou false.');
    }
    this.secure = rawSecure === 'true';

    this.sessionTtl = this.parseBoundedInteger(
      config,
      'AUTH_SESSION_TTL_SECONDS',
      86400,
      60,
      2592000,
    );

    this.rateLimit = this.parseBoundedInteger(
      config,
      'AUTH_RATE_LIMIT',
      20,
      1,
      1000,
    );

    this.rateWindow = this.parseBoundedInteger(
      config,
      'AUTH_RATE_WINDOW_SECONDS',
      60,
      1,
      3600,
    );

    this.trustProxyHops = this.parseBoundedInteger(
      config,
      'AUTH_TRUST_PROXY_HOPS',
      0,
      0,
      5,
    );

    const checkedUrls = [parsedRedirectUri, parsedSuccessUrl];
    for (const origin of this.allowedOrigins) {
      checkedUrls.push(parseAbsoluteUrl(origin, 'CORS_ORIGIN'));
    }

    const isLocalhost = (hostname: string) =>
      ['localhost', '127.0.0.1', '[::1]'].includes(hostname);

    const hasNonLocalHttp = checkedUrls.some(
      (url) => url.protocol !== 'https:' && !isLocalhost(url.hostname),
    );
    if (hasNonLocalHttp) {
      throw new Error('HTTPS est obligatoire hors localhost.');
    }

    if (
      (!this.secure && checkedUrls.some((url) => !isLocalhost(url.hostname))) ||
      (isProduction && !this.secure)
    ) {
      throw new Error(
        'Les cookies Secure sont obligatoires hors développement local.',
      );
    }

    if (
      isProduction &&
      (!this.clientId ||
        !this.clientSecret ||
        checkedUrls.some((url) => url.protocol !== 'https:'))
    ) {
      throw new Error(
        'Configurer Google OAuth et HTTPS avant le démarrage en production.',
      );
    }
  }

  private parseBoundedInteger(
    config: ConfigService,
    key: string,
    fallback: number,
    min: number,
    max: number,
  ): number {
    const raw = config.get<string>(key, String(fallback));
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${key} hors limites.`);
    }
    return value;
  }
}
