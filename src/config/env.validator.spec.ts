import {
  getRequiredEnv,
  getRequiredEnvNumber,
  MissingEnvException,
  InvalidEnvException,
} from './env.validator';

describe('env.validator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getRequiredEnv', () => {
    it('renvoie la valeur nettoyee si la variable est presente', () => {
      process.env.TEST_KEY = 'valeur_test';
      expect(getRequiredEnv('TEST_KEY')).toBe('valeur_test');
    });

    it('leve MissingEnvException si la variable est absente', () => {
      delete process.env.TEST_MISSING;
      expect(() => getRequiredEnv('TEST_MISSING')).toThrow(MissingEnvException);
      expect(() => getRequiredEnv('TEST_MISSING')).toThrow(
        `[ConfigError] Variable d'environnement obligatoire manquante ou vide : "TEST_MISSING".`,
      );
    });

    it('leve MissingEnvException si la variable ne contient que des espaces', () => {
      process.env.TEST_EMPTY = '   ';
      expect(() => getRequiredEnv('TEST_EMPTY')).toThrow(MissingEnvException);
    });
  });

  describe('getRequiredEnvNumber', () => {
    it('renvoie le nombre parse si la valeur est numerique', () => {
      process.env.TEST_PORT = '3000';
      expect(getRequiredEnvNumber('TEST_PORT')).toBe(3000);
    });

    it('leve InvalidEnvException si la valeur n est pas un nombre', () => {
      process.env.TEST_INVALID_NUM = 'abc';
      expect(() => getRequiredEnvNumber('TEST_INVALID_NUM')).toThrow(
        InvalidEnvException,
      );
      expect(() => getRequiredEnvNumber('TEST_INVALID_NUM')).toThrow(
        `[ConfigError] Variable d'environnement invalide pour "TEST_INVALID_NUM" : attendu un nombre, reçu "abc".`,
      );
    });
  });
});
