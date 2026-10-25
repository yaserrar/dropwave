import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { S3Service } from '../s3/s3.service.js';

// S3 deletes at most 1000 objects per request.
const BATCH_SIZE = 1000;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  // Set while a cleanup runs, so a slow run never overlaps the next one.
  private running = false;

  constructor(
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Deletes expired files: S3 objects first, then their rows, so a failed S3
   * delete keeps its row and is retried on the next run. Expired links are
   * already blocked at request time (410); this only frees storage.
   */
  @Cron('5 */10 * * * *') // every 10 minutes, at second 5
  async deleteExpiredFiles() {
    if (this.running) {
      this.logger.warn('Previous cleanup is still running; skipping this one');
      return;
    }
    this.running = true;

    const now = new Date();
    let deleted = 0;
    let failed = 0;

    try {
      while (true) {
        const batch = await this.prisma.file.findMany({
          where: { expiresAt: { lt: now } },
          select: { id: true, key: true },
          orderBy: { expiresAt: 'asc' },
          take: BATCH_SIZE,
        });
        if (batch.length === 0) break;

        const result = await this.s3Service.deleteObjects(
          batch.map((file) => file.key),
        );

        // Only drop rows whose object is really gone.
        const gone = new Set(result.deleted);
        const ids = batch.filter((file) => gone.has(file.key)).map((f) => f.id);
        await this.prisma.file.deleteMany({ where: { id: { in: ids } } });
        deleted += ids.length;

        if (result.errors.length > 0) {
          failed += result.errors.length;
          for (const error of result.errors.slice(0, 5)) {
            this.logger.warn(
              { key: error.key, error: error.message },
              'Could not delete expired file from S3',
            );
          }
          // The failed rows would come back in the next query; leave them for the next run.
          break;
        }
        if (batch.length < BATCH_SIZE) break;
      }

      if (deleted > 0 || failed > 0) {
        this.logger.log(
          { deleted, failed },
          'Expired files cleaned up (failures are retried next run)',
        );
      }
    } catch (error) {
      // An Error as the first argument is logged with its stack (`err` field).
      this.logger.error(error, 'Expired-file cleanup failed');
    } finally {
      this.running = false;
    }
  }
}
