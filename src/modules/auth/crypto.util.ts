import { createHash, randomBytes } from 'node:crypto';

export const randomToken = () => randomBytes(32).toString('base64url');
export const hashToken = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export const isToken = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

export function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  const values = (header ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  // Ambiguous cookies (e.g. injected from another path) are rejected.
  return values.length === 1 ? values[0].slice(name.length + 1) : undefined;
}
