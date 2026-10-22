import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesModule } from './files/files.module.js';
import { FilesController } from './files/files.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
    }),
    FilesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
