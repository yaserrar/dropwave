import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

// scrypt's recommended interactive cost: ~16 MB of memory and a few dozen ms per
// guess, which makes offline guessing expensive without slowing down the API.
const COST = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
// Node refuses scrypt runs that need more than 32 MB by default (128 * N * r is 16 MB).
const MAX_MEMORY = 64 * 1024 * 1024;

function derive(
  password: string,
  salt: Buffer,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // NFC so "é" typed as one character or as e + accent gives the same hash.
    scrypt(
      password.normalize('NFC'),
      salt,
      KEY_LENGTH,
      { ...options, maxmem: MAX_MEMORY },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

/** "scrypt$N$r$p$<salt>$<key>" (base64): the parameters travel with the hash, so they can change later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, COST);
  return [
    'scrypt',
    COST.N,
    COST.r,
    COST.p,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

/** Compares in constant time. A malformed stored hash never matches. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, n, r, p, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64');
  const options = { N: Number(n), r: Number(r), p: Number(p) };
  if (
    !Object.values(options).every(Number.isInteger) ||
    expected.length === 0
  ) {
    return false;
  }

  const actual = await derive(password, Buffer.from(salt, 'base64'), options);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
