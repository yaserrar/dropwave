import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { LinkTokensService } from './link-tokens.service.js';

export const UPLOAD_TOKEN_HEADER = 'x-upload-token';

/**
 * Upload routes are only for the browser that created the drop: it got an upload
 * token with the drop and sends it back in a header. The share link alone isn't
 * enough to add, replace or remove files.
 */
@Injectable()
export class UploadTokenGuard implements CanActivate {
  constructor(private readonly tokens: LinkTokensService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const token = req.header(UPLOAD_TOKEN_HEADER);
    const dropId = req.params.id;
    if (
      !token ||
      typeof dropId !== 'string' ||
      !this.tokens.verify('upload', dropId, [token])
    ) {
      throw new UnauthorizedException('This upload has expired. Start again.');
    }
    return true;
  }
}
