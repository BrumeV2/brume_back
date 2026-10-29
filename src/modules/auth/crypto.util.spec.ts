import { hashToken, isToken, randomToken, readCookie } from './crypto.util';

describe('Session and cookie secrets', () => {
  it('generates unpredictable tokens and stores distinct SHA-256 fingerprints', () => {
    const token = randomToken();
    expect(isToken(token)).toBe(true);
    expect(randomToken()).not.toBe(token);
    expect(hashToken(token)).toHaveLength(64);
    expect(hashToken(token)).not.toContain(token);
    expect(isToken('')).toBe(false);
  });

  it('rejects duplicate cookies rather than accepting an ambiguous session', () => {
    expect(readCookie('other=1; brume_session=abc', 'brume_session')).toBe(
      'abc',
    );
    expect(
      readCookie('brume_session=a; brume_session=b', 'brume_session'),
    ).toBeUndefined();
    expect(readCookie(undefined, 'brume_session')).toBeUndefined();
  });
});
