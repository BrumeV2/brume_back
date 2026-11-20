import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function encryptPayload(value: object, key: Buffer | null): string {
  if (!key)
    throw new Error(
      'EMAIL_ENCRYPTION_KEY obligatoire pour enregistrer un email.',
    );
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}
export function decryptPayload(value: string, key: Buffer | null): unknown {
  if (!key) throw new Error('EMAIL_ENCRYPTION_KEY manquante.');
  const bytes = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]).toString('utf8'),
  ) as unknown;
}
