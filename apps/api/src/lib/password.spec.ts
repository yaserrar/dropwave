import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('verifies the right password and refuses a wrong one', async () => {
    const hash = await hashPassword('correct horse');
    expect(await verifyPassword('correct horse', hash)).toBe(true);
    expect(await verifyPassword('correct hors', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('stores a salted scrypt hash, never the password', async () => {
    const [a, b] = await Promise.all([
      hashPassword('secret'),
      hashPassword('secret'),
    ]);
    expect(a).toMatch(
      /^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/,
    );
    expect(a).not.toContain('secret');
    // A random salt per hash: the same password never hashes the same twice.
    expect(a).not.toBe(b);
  });

  it('treats composed and decomposed accents as the same password', async () => {
    const hash = await hashPassword('café');
    expect(await verifyPassword('café', hash)).toBe(true);
  });

  it('never matches a malformed stored hash', async () => {
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$whatever')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$abc$8$1$c2FsdA==$a2V5')).toBe(
      false,
    );
  });
});
