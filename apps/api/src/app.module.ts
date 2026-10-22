import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesModule } from './files/files.module.js';
import { FilesController } from './files/files.controller.js';
import { S3Service } from './s3/s3.service.js';
import { S3Module } from './s3/s3.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
    }),
    FilesModule,
    S3Module,
  ],
  controllers: [],
  providers: [S3Service],
})
export class AppModule {}
