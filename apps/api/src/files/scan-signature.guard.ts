import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
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
  private readonly logger = new Logger(ScanSignatureGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const timestamp = req.header('x-dropwave-timestamp');
    const signature = req.header('x-dropwave-signature');
    if (!timestamp || !signature || !req.rawBody) {
      return this.reject('Missing signature');
    }

    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > MAX_AGE_SECONDS) {
      return this.reject('Signature expired');
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
      return this.reject('Invalid signature');
    }
    return true;
  }

  // Guards run before the error interceptor, so the request log alone wouldn't say
  // why; and a forged or replayed scan result is worth noticing.
  private reject(reason: string): never {
    this.logger.warn({ reason }, 'Rejected a scan result');
    throw new UnauthorizedException(reason);
  }
}
