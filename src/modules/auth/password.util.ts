import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
const derive = (password: string, salt: string) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
const dummyHash = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;
export async function verifyPassword(
  password: string,
  encoded: string | null | undefined,
) {
  const [algorithm, salt, hash] = (encoded ?? dummyHash).split('$');
  if (
    algorithm !== 'scrypt' ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    !/^[a-f0-9]{128}$/.test(hash)
  )
    return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, Buffer.from(hash, 'hex')) && !!encoded;
}
