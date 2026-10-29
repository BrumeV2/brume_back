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

export function getRequiredEnvNumber(key: string): number {
  const rawValue = getRequiredEnv(key);
  const parsedValue = Number(rawValue);
  if (isNaN(parsedValue)) {
    throw new InvalidEnvException(key, 'nombre', rawValue);
  }
  return parsedValue;
}
