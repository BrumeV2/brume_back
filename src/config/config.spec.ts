import {
  getRequiredEnv,
  getRequiredEnvNumber,
  getRequiredEnvBoolean,
  parseAbsoluteUrl,
  parseCorsOrigins,
  MissingEnvException,
  InvalidEnvException,
} from './config';

describe('config utils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getRequiredEnv', () => {
    it('renvoie la valeur nettoyee si presente', () => {
      process.env.TEST_KEY = '  valeur  ';
      expect(getRequiredEnv('TEST_KEY')).toBe('valeur');
    });

    it('leve MissingEnvException si absente ou vide', () => {
      delete process.env.TEST_MISSING;
      expect(() => getRequiredEnv('TEST_MISSING')).toThrow(MissingEnvException);
      process.env.TEST_EMPTY = '   ';
      expect(() => getRequiredEnv('TEST_EMPTY')).toThrow(MissingEnvException);
    });
  });

  describe('getRequiredEnvNumber', () => {
    it('renvoie le nombre parse si valide', () => {
      process.env.TEST_NUM = '42';
      expect(getRequiredEnvNumber('TEST_NUM')).toBe(42);
    });

    it('leve InvalidEnvException si non numerique', () => {
      process.env.TEST_INVALID = 'pas-un-nombre';
      expect(() => getRequiredEnvNumber('TEST_INVALID')).toThrow(
        InvalidEnvException,
      );
    });

    it('valide les bornes min et max', () => {
      process.env.TEST_BOUND = '10';
      expect(getRequiredEnvNumber('TEST_BOUND', 5, 15)).toBe(10);
      expect(() => getRequiredEnvNumber('TEST_BOUND', 15, 20)).toThrow(
        InvalidEnvException,
      );
      expect(() => getRequiredEnvNumber('TEST_BOUND', 1, 5)).toThrow(
        InvalidEnvException,
      );
    });
  });

  describe('getRequiredEnvBoolean', () => {
    it('renvoie un booleen pour true ou false', () => {
      process.env.TEST_BOOL = 'true';
      expect(getRequiredEnvBoolean('TEST_BOOL')).toBe(true);
      process.env.TEST_BOOL = 'false';
      expect(getRequiredEnvBoolean('TEST_BOOL')).toBe(false);
    });

    it('leve InvalidEnvException si different de true/false', () => {
      process.env.TEST_BOOL = 'oui';
      expect(() => getRequiredEnvBoolean('TEST_BOOL')).toThrow(
        InvalidEnvException,
      );
    });
  });

  describe('parseAbsoluteUrl', () => {
    it('parse une URL HTTP ou HTTPS absolue', () => {
      const url = parseAbsoluteUrl(
        'https://app.brume.dev/callback',
        'REDIRECT',
      );
      expect(url.origin).toBe('https://app.brume.dev');
    });

    it('leve InvalidEnvException si format invalide', () => {
      expect(() => parseAbsoluteUrl('pas-une-url', 'URL')).toThrow(
        InvalidEnvException,
      );
    });

    it('refuse les URL non HTTP(S) ou portant des identifiants', () => {
      expect(() => parseAbsoluteUrl('ftp://example.com', 'URL')).toThrow(
        InvalidEnvException,
      );
      expect(() =>
        parseAbsoluteUrl('https://user:pass@example.com', 'URL'),
      ).toThrow(InvalidEnvException);
    });
  });

  describe('parseCorsOrigins', () => {
    it('parse des origines valides', () => {
      const origins = parseCorsOrigins(
        'http://localhost:5173, https://app.ybrume.duckdns.org',
      );
      expect(origins).toEqual([
        'http://localhost:5173',
        'https://app.ybrume.duckdns.org',
      ]);
    });

    it('refuse une origine avec chemin ou slash final', () => {
      expect(() => parseCorsOrigins('https://app.brume.dev/')).toThrow(
        InvalidEnvException,
      );
      expect(() => parseCorsOrigins('https://app.brume.dev/sub')).toThrow(
        InvalidEnvException,
      );
    });
  });
});
