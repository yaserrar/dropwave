import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailModule } from '../mail/mail.module.js';
import { S3Module } from '../s3/s3.module.js';
import { DropsController } from './drops.controller.js';
import { DropsService } from './drops.service.js';
import { InternalController } from './internal.controller.js';
import { LinkTokensService } from './link-tokens.service.js';
import { ScanSignatureGuard } from './scan-signature.guard.js';
import { UploadTokenGuard } from './upload-token.guard.js';
import { UploadsController } from './uploads.controller.js';
import { UploadsService } from './uploads.service.js';

@Module({
  controllers: [UploadsController, DropsController, InternalController],
  providers: [
    UploadsService,
    DropsService,
    LinkTokensService,
    ScanSignatureGuard,
    UploadTokenGuard,
  ],
  imports: [S3Module, MailModule, ConfigModule],
})
export class DropsModule {}
