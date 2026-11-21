import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  deriveTokenKey,
  signToken,
  verifyToken,
  type TokenPurpose,
} from '../lib/link-tokens.js';

/**
 * Short-lived, HMAC-signed tokens tied to one drop (see lib/link-tokens.ts). They're
 * stateless: nothing is stored, and a token can't be moved to another drop.
 */
@Injectable()
export class LinkTokensService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    // Derived from the scan-result secret, so deploying this needs no new secret.
    this.key = deriveTokenKey(config.getOrThrow<string>('SCAN_RESULT_SECRET'));
  }

  issue(purpose: TokenPurpose, dropId: string, ttlSeconds: number) {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    return {
      token: signToken(this.key, purpose, dropId, expiresAt),
      expiresAt: new Date(expiresAt * 1000),
    };
  }

  /** When the first valid token among `tokens` expires, or null if none is valid. */
  verify(purpose: TokenPurpose, dropId: string, tokens: string[]): Date | null {
    for (const token of tokens) {
      const expiresAt = verifyToken(this.key, purpose, dropId, token);
      if (expiresAt !== null) return new Date(expiresAt * 1000);
    }
    return null;
  }
}
