import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function url(value: string, key: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} doit être une URL absolue.`);
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    throw new Error(
      `${key} doit être une URL HTTP(S) sans identifiants ni fragment.`,
    );
  }
  return parsed;
}

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
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID', '').trim();
    this.clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET', '').trim();
    this.redirectUri = config.get<string>(
      'GOOGLE_REDIRECT_URI',
      'http://localhost:3000/api/auth/google/callback',
    );
    this.successUrl = config.get<string>(
      'AUTH_SUCCESS_URL',
      'http://localhost:5173/',
    );
    const production = config.get<string>('NODE_ENV') === 'production';
    const secure = config.get<string>(
      'AUTH_COOKIE_SECURE',
      production ? 'true' : 'false',
    );
    if (!['true', 'false'].includes(secure))
      throw new Error('AUTH_COOKIE_SECURE doit être true ou false.');
    this.secure = secure === 'true';
    this.sessionTtl = this.integer(
      config,
      'AUTH_SESSION_TTL_SECONDS',
      86400,
      60,
      2592000,
    );
    this.rateLimit = this.integer(config, 'AUTH_RATE_LIMIT', 20, 1, 1000);
    this.trustProxyHops = this.integer(
      config,
      'AUTH_TRUST_PROXY_HOPS',
      0,
      0,
      5,
    );
    this.rateWindow = this.integer(
      config,
      'AUTH_RATE_WINDOW_SECONDS',
      60,
      1,
      3600,
    );
    this.allowedOrigins = config
      .get<string>('CORS_ORIGIN', 'http://localhost:5173')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!this.allowedOrigins.length)
      throw new Error(
        'CORS_ORIGIN doit contenir au moins une origine explicite.',
      );
    const urls = [
      url(this.redirectUri, 'GOOGLE_REDIRECT_URI'),
      url(this.successUrl, 'AUTH_SUCCESS_URL'),
    ];
    for (const origin of this.allowedOrigins) {
      const parsed = url(origin, 'CORS_ORIGIN');
      if (parsed.origin !== origin)
        throw new Error(
          'CORS_ORIGIN exige des origines sans chemin ni slash final.',
        );
      urls.push(parsed);
    }
    if (!this.allowedOrigins.includes(new URL(this.successUrl).origin))
      throw new Error('AUTH_SUCCESS_URL doit appartenir à CORS_ORIGIN.');
    // HTTP and non-Secure cookies are allowed only on local development hosts.
    if (
      urls.some(
        (value) =>
          value.protocol !== 'https:' &&
          !['localhost', '127.0.0.1', '[::1]'].includes(value.hostname),
      )
    ) {
      throw new Error('HTTPS est obligatoire hors localhost.');
    }
    if (
      (!this.secure &&
        urls.some(
          (value) =>
            !['localhost', '127.0.0.1', '[::1]'].includes(value.hostname),
        )) ||
      (production && !this.secure)
    ) {
      throw new Error(
        'Les cookies Secure sont obligatoires hors développement local.',
      );
    }
    if (
      production &&
      (!this.clientId ||
        !this.clientSecret ||
        urls.some((value) => value.protocol !== 'https:'))
    ) {
      throw new Error(
        'Configurer Google OAuth et HTTPS avant le démarrage en production.',
      );
    }
  }

  private integer(
    config: ConfigService,
    key: string,
    fallback: number,
    min: number,
    max: number,
  ) {
    const value = Number(config.get<string>(key, String(fallback)));
    if (!Number.isInteger(value) || value < min || value > max)
      throw new Error(`${key} hors limites.`);
    return value;
  }
}
