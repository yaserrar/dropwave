import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { S3Service } from '../s3/s3.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TasksService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
  ) {}
  private readonly logger = new Logger(TasksService.name);

  @Cron('5 */10 * * * *') // Runs at the once each 10 minutes
  async DeleteExpiredFiles() {
    this.logger.debug('Deleting expired files...');

    const expiredFiles = this.prisma.file.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    const count = (await expiredFiles).length;
    this.logger.debug(`Found ${count} expired files to delete.`);
    const expiredKeys = (await expiredFiles).map((file) =>
      this.s3Service.buildFileKey(file.id),
    );
    await this.s3Service.deleteObjects(expiredKeys);

    this.logger.debug(`Deleted ${expiredKeys.length} expired files from S3.`);

    await this.prisma.file.deleteMany({
      where: {
        id: {
          in: (await expiredFiles).map((file) => file.id),
        },
      },
    });
    this.logger.debug(
      `Deleted ${expiredKeys.length} expired files from the database.`,
    );
  }
}
