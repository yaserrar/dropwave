import { Module } from '@nestjs/common';
import { FilesService } from './files.service.js';
import { FilesController } from './files.controller.js';
import { S3Module } from '../s3/s3.module.js';
import { InternalController } from './internal.controller.js';
import { ConfigModule } from '@nestjs/config';
import { ScanSignatureGuard } from './scan-signature.guard.js';
import { MailModule } from '../mail/mail.module.js';

@Module({
  controllers: [FilesController, InternalController],
  providers: [FilesService, ScanSignatureGuard],
  imports: [S3Module, MailModule, ConfigModule],
})
export class FilesModule {}
