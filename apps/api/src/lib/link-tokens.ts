import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * What a token lets its holder do with one drop:
 * - `unlock`: open a password-protected link (info, preview, download).
 * - `upload`: upload, confirm and cancel the files of a drop being created.
 */
export type TokenPurpose = 'unlock' | 'upload';

/**
 * The signing key, derived from a server secret with a fixed label, so tokens can't
 * be confused with anything else signed with that secret (like scan results).
 */
export function deriveTokenKey(secret: string): Buffer {
  return createHmac('sha256', secret)
    .update('dropwave/link-tokens/v1')
    .digest();
}

function signature(
  key: Buffer,
  purpose: TokenPurpose,
  dropId: string,
  expiresAt: number,
): Buffer {
  return createHmac('sha256', key)
    .update(`${purpose}.${dropId}.${expiresAt}`)
    .digest();
}

/** "<expiry in Unix seconds>.<base64url HMAC of purpose, drop and expiry>". */
export function signToken(
  key: Buffer,
  purpose: TokenPurpose,
  dropId: string,
  expiresAt: number,
): string {
  const mac = signature(key, purpose, dropId, expiresAt);
  return `${expiresAt}.${mac.toString('base64url')}`;
}

/**
 * The token's expiry (Unix seconds) if it was signed for this purpose and drop and
 * hasn't expired; null otherwise. Compares in constant time.
 */
export function verifyToken(
  key: Buffer,
  purpose: TokenPurpose,
  dropId: string,
  token: string,
  now = Date.now(),
): number | null {
  const [expiry, mac, extra] = token.split('.');
  if (!expiry || !mac || extra !== undefined || !/^\d{1,12}$/.test(expiry)) {
    return null;
  }
  const expiresAt = Number(expiry);
  if (expiresAt * 1000 <= now) return null;

  const expected = signature(key, purpose, dropId, expiresAt);
  const actual = Buffer.from(mac, 'base64url');
  return actual.length === expected.length && timingSafeEqual(actual, expected)
    ? expiresAt
    : null;
}
