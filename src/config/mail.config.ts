import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { parseAbsoluteUrl } from './config';

@Injectable()
export class MailConfig {
  readonly enabled: boolean;
  readonly apiKey: string;
  readonly apiSecret: string;
  readonly fromEmail: string;
  readonly fromName: string;
  readonly frontendUrl: string;
  readonly encryptionKey: Buffer | null;
  readonly pollMs: number;
  readonly maxAttempts: number;
  constructor(config: ConfigService) {
    const production = config.get<string>('NODE_ENV') === 'production';
    const enabled = config.get<string>('EMAIL_ENABLED', 'false');
    if (!['true', 'false'].includes(enabled))
      throw new Error('EMAIL_ENABLED invalide.');
    this.enabled = enabled === 'true';
    this.apiKey = config.get<string>('MAILJET_API_KEY', '').trim();
    this.apiSecret = config.get<string>('MAILJET_API_SECRET', '').trim();
    this.fromEmail = config
      .get<string>('EMAIL_FROM', 'notifications@brume.test')
      .trim();
    this.fromName = config.get<string>('EMAIL_FROM_NAME', 'Brume').trim();
    if (!isEmail(this.fromEmail) || /[\r\n]/.test(this.fromName))
      throw new Error('Expéditeur email invalide.');
    const url = parseAbsoluteUrl(
      config.get<string>(
        'FRONTEND_URL',
        production ? '' : 'http://localhost:5173',
      ),
      'FRONTEND_URL',
    );
    if (
      url.search ||
      url.pathname !== '/' ||
      (production && url.protocol !== 'https:')
    )
      throw new Error(
        'FRONTEND_URL doit être une origine (HTTPS en production).',
      );
    this.frontendUrl = url.origin;
    const key = config.get<string>('EMAIL_ENCRYPTION_KEY', '');
    if (key && !/^[a-fA-F0-9]{64}$/.test(key))
      throw new Error(
        'EMAIL_ENCRYPTION_KEY doit contenir 64 caractères hexadécimaux.',
      );
    this.encryptionKey = key ? Buffer.from(key, 'hex') : null;
    if (
      this.enabled &&
      (!this.apiKey || !this.apiSecret || !this.encryptionKey)
    )
      throw new Error(
        'Configurer Mailjet et EMAIL_ENCRYPTION_KEY avant activation.',
      );
    this.pollMs = this.integer(config, 'EMAIL_POLL_MS', 5000, 100, 60000);
    this.maxAttempts = this.integer(config, 'EMAIL_MAX_ATTEMPTS', 5, 1, 20);
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
