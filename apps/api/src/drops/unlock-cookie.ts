import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { CookieOptions, Request } from 'express';
import { readCookies } from '../lib/cookies.js';

export const UNLOCK_COOKIE = 'dropwave_unlock';

/**
 * The unlock cookie only goes to one drop's routes (its path is /api/drops/<id>),
 * can't be read by scripts, and isn't sent by other sites. Secure when the app is
 * served over HTTPS; locally it's plain http.
 */
export function unlockCookieOptions(
  dropId: string,
  expires: Date,
  secure: boolean,
): CookieOptions {
  return {
    path: `/api/drops/${dropId}`,
    expires,
    httpOnly: true,
    sameSite: 'strict',
    secure,
  };
}

/** Every unlock token the browser sent; the service checks which, if any, is valid. */
export const UnlockTokens = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string[] => {
    const req = context.switchToHttp().getRequest<Request>();
    return readCookies(req.headers.cookie, UNLOCK_COOKIE);
  },
);
