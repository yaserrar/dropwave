import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesModule } from './files/files.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
    }),
    FilesModule,
  ],
  controllers: [FilesModule],
  providers: [],
})
export class AppModule {}
