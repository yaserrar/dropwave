import { Module } from '@nestjs/common';
import { FilesService } from './files.service.js';
import { FilesController } from './files.controller.js';
import { S3Module } from '../s3/s3.module.js';

@Module({
  controllers: [FilesController],
  providers: [FilesService],
  imports: [S3Module],
})
export class FilesModule {}
