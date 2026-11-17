export class MissingEnvException extends Error {
  constructor(key: string) {
    super(
      `[ConfigError] Variable d'environnement obligatoire manquante ou vide : "${key}".`,
    );
    this.name = 'MissingEnvException';
  }
}

export class InvalidEnvException extends Error {
  constructor(key: string, expectedType: string, receivedValue: string) {
    super(
      `[ConfigError] Variable d'environnement invalide pour "${key}" : attendu un ${expectedType}, reçu "${receivedValue}".`,
    );
    this.name = 'InvalidEnvException';
  }
}

export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new MissingEnvException(key);
  }
  return value.trim();
}

export function getRequiredEnvNumber(
  key: string,
  min?: number,
  max?: number,
): number {
  const rawValue = getRequiredEnv(key);
  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue)) {
    throw new InvalidEnvException(key, 'nombre', rawValue);
  }
  if (min !== undefined && parsedValue < min) {
    throw new InvalidEnvException(
      key,
      `nombre superieur ou egal a ${min}`,
      rawValue,
    );
  }
  if (max !== undefined && parsedValue > max) {
    throw new InvalidEnvException(
      key,
      `nombre inferieur ou egal a ${max}`,
      rawValue,
    );
  }
  return parsedValue;
}

export function getRequiredEnvBoolean(key: string): boolean {
  const rawValue = getRequiredEnv(key).toLowerCase();
  if (rawValue !== 'true' && rawValue !== 'false') {
    throw new InvalidEnvException(key, 'booleen ("true" ou "false")', rawValue);
  }
  return rawValue === 'true';
}

export function parseAbsoluteUrl(value: string, key: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new InvalidEnvException(key, 'URL absolue', value);
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    throw new InvalidEnvException(
      key,
      'URL HTTP(S) sans identifiants ni fragment',
      value,
    );
  }
  return parsed;
}

export function parseCorsOrigins(value: string): string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!origins.length) {
    throw new MissingEnvException('CORS_ORIGIN');
  }

  for (const origin of origins) {
    const parsed = parseAbsoluteUrl(origin, 'CORS_ORIGIN');
    if (parsed.origin !== origin) {
      throw new InvalidEnvException(
        'CORS_ORIGIN',
        'origine sans chemin ni slash final',
        origin,
      );
    }
  }

  return origins;
}
