import { readBearerToken } from './crypto.util';
describe('readBearerToken', () => {
  it('lit un jeton opaque Bearer, sans imposer de casse au schéma', () => {
    const token = 'a'.repeat(43);
    expect(readBearerToken(`Bearer ${token}`)).toBe(token);
    expect(readBearerToken(`bearer ${token}`)).toBe(token);
  });
  it.each([
    undefined,
    '',
    'Basic abc',
    'Bearer invalid',
    `Bearer ${'a'.repeat(43)} extra`,
    `Bearer  ${'a'.repeat(43)}`,
    `Bearer ${'a'.repeat(43)}\n`,
  ])('refuse le header ambigu ou invalide %s', (header) => {
    expect(readBearerToken(header)).toBeUndefined();
  });
});
