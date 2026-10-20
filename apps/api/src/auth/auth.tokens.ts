import { createHash, randomBytes } from 'node:crypto';

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function isSecret(token: string | undefined): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}
