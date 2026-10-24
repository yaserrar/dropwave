import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { minutes, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { FilesModule } from './files/files.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { S3Module } from './s3/s3.module.js';
import { TasksModule } from './tasks/tasks.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
    }),
    FilesModule,
    S3Module,
    PrismaModule,
    ThrottlerModule.forRoot({
      errorMessage: 'Too many requests. Please wait a minute and try again.',
      throttlers: [
        {
          name: 'default',
          ttl: minutes(1),
          limit: 20,
        },
      ],
      getTracker: (req) => req.headers['cf-connecting-ip'] ?? req.ip, // see step 4
    }),
    ScheduleModule.forRoot(),
    TasksModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }], // applies to every route
})
export class AppModule {}
