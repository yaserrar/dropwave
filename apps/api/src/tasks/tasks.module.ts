import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import { S3Module } from '../s3/s3.module.js';

@Module({
  imports: [S3Module],
  providers: [TasksService],
})
export class TasksModule {}
