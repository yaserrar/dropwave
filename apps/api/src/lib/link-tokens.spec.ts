import { deriveTokenKey, signToken, verifyToken } from './link-tokens.js';

const key = deriveTokenKey('test-secret');
const dropId = '6f1c2d3e-0000-4000-8000-000000000001';
const now = Date.UTC(2026, 10, 21, 12, 0, 0);
const inFifteenMinutes = now / 1000 + 15 * 60;

describe('link tokens', () => {
  it('accepts a token for its purpose and drop until it expires', () => {
    const token = signToken(key, 'unlock', dropId, inFifteenMinutes);
    expect(verifyToken(key, 'unlock', dropId, token, now)).toBe(
      inFifteenMinutes,
    );
    // One second before expiry it still works; at expiry it doesn't.
    expect(
      verifyToken(key, 'unlock', dropId, token, (inFifteenMinutes - 1) * 1000),
    ).toBe(inFifteenMinutes);
    expect(
      verifyToken(key, 'unlock', dropId, token, inFifteenMinutes * 1000),
    ).toBeNull();
  });

  it('is tied to one drop and one purpose', () => {
    const token = signToken(key, 'unlock', dropId, inFifteenMinutes);
    const otherDrop = '6f1c2d3e-0000-4000-8000-000000000002';
    expect(verifyToken(key, 'unlock', otherDrop, token, now)).toBeNull();
    expect(verifyToken(key, 'upload', dropId, token, now)).toBeNull();
  });

  it('refuses tokens signed with another key', () => {
    const forged = signToken(
      deriveTokenKey('other-secret'),
      'unlock',
      dropId,
      inFifteenMinutes,
    );
    expect(verifyToken(key, 'unlock', dropId, forged, now)).toBeNull();
  });

  it('refuses a token whose expiry was pushed back', () => {
    const token = signToken(key, 'unlock', dropId, inFifteenMinutes);
    const [, mac] = token.split('.');
    const extended = `${inFifteenMinutes + 3600}.${mac}`;
    expect(verifyToken(key, 'unlock', dropId, extended, now)).toBeNull();
  });

  it('refuses malformed tokens', () => {
    for (const token of [
      '',
      'abc',
      '123',
      '123.',
      '.abc',
      '1e9.abc',
      '1.2.3',
    ]) {
      expect(verifyToken(key, 'unlock', dropId, token, now)).toBeNull();
    }
  });

  it('derives a key that is not the secret itself', () => {
    expect(key.toString('utf8')).not.toContain('test-secret');
    expect(key).toHaveLength(32);
  });
});
