import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesModule } from './files/files.module.js';
import { S3Module } from './s3/s3.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
    }),
    FilesModule,
    S3Module,
    PrismaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
