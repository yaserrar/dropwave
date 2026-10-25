import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  RawBodyRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

// Signed requests older than this are refused, so a captured one can't be replayed later.
const MAX_AGE_SECONDS = 5 * 60;

/** Lets a request through only if the file-check Lambda signed it with SCAN_RESULT_SECRET. */
@Injectable()
export class ScanSignatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const timestamp = req.header('x-dropwave-timestamp');
    const signature = req.header('x-dropwave-signature');
    if (!timestamp || !signature || !req.rawBody) {
      throw new UnauthorizedException('Missing signature');
    }

    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > MAX_AGE_SECONDS) {
      throw new UnauthorizedException('Signature expired');
    }

    const secret = this.config.getOrThrow<string>('SCAN_RESULT_SECRET');
    const expected =
      'sha256=' +
      createHmac('sha256', secret)
        .update(`${timestamp}.`)
        .update(req.rawBody)
        .digest('hex');

    // Constant-time comparison: a normal === leaks how many characters matched.
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid signature');
    }
    return true;
  }
}
