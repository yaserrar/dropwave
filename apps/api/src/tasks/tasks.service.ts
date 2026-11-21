import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { purgeFiles } from '../drops/purge.js';
import { BURN_PURGE_DELAY_MS, BURN_ZIP_PURGE_DELAY_MS } from '../lib/consts.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { S3Service } from '../s3/s3.service.js';

// S3 deletes at most 1000 objects per request.
const BATCH_SIZE = 1000;

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  // Set while a job runs, so a slow run never overlaps the next one.
  private readonly running = new Set<string>();

  constructor(
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
  ) {}

  /** Runs `job` unless its previous run is still going. */
  private async exclusive(name: string, job: () => Promise<void>) {
    if (this.running.has(name)) {
      this.logger.warn({ job: name }, 'Previous run is still going; skipping');
      return;
    }
    this.running.add(name);
    try {
      await job();
    } catch (error) {
      // An Error as the first argument is logged with its stack (`err` field).
      this.logger.error(error, `${name} failed`);
    } finally {
      this.running.delete(name);
    }
  }

  /**
   * Deletes expired drops: every file's S3 object first, then the file rows, then
   * the drops left empty. A failed S3 delete keeps its row and is retried on the
   * next run. Expired links are already blocked at request time (410); this only
   * frees storage.
   */
  @Cron('5 */10 * * * *') // every 10 minutes, at second 5
  async deleteExpiredDrops() {
    await this.exclusive('Expired-drop cleanup', async () => {
      const now = new Date();
      let deleted = 0;
      let failed = 0;

      while (true) {
        const batch = await this.prisma.file.findMany({
          where: { drop: { expiresAt: { lt: now } } },
          select: { id: true, key: true },
          orderBy: { createdAt: 'asc' },
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
          this.logS3Errors(
            result.errors,
            'Could not delete expired file from S3',
          );
          // The failed rows would come back in the next query; leave them for the next run.
          break;
        }
        if (batch.length < BATCH_SIZE) break;
      }

      // Drops whose files are all gone (and expired drops that never had any).
      const drops = await this.prisma.drop.deleteMany({
        where: { expiresAt: { lt: now }, files: { none: {} } },
      });

      if (deleted > 0 || failed > 0 || drops.count > 0) {
        this.logger.log(
          { drops: drops.count, files: deleted, failed },
          'Expired drops cleaned up (failures are retried next run)',
        );
      }
    });
  }

  /**
   * Deletes the files of burn-after-download links that were downloaded: a single
   * file once its one-minute download URL has expired. "Download all" deletes its
   * files itself when the zip ends, since a slow client can take far longer than a
   * minute; this only sweeps up after a zip cut short by a restart, hours later,
   * and after a failed delete. The drop row stays, so the link says it was used.
   */
  @Cron('30 * * * * *') // every minute, at second 30
  async purgeDownloadedDrops() {
    await this.exclusive('Downloaded-drop purge', async () => {
      const now = Date.now();
      const files = await this.prisma.file.findMany({
        where: {
          status: { not: 'DELETED' },
          drop: {
            OR: [
              {
                consumedBy: 'FILE',
                consumedAt: { lt: new Date(now - BURN_PURGE_DELAY_MS) },
              },
              { consumedAt: { lt: new Date(now - BURN_ZIP_PURGE_DELAY_MS) } },
            ],
          },
        },
        select: { id: true, key: true },
        take: BATCH_SIZE,
      });
      if (files.length === 0) return;

      const result = await purgeFiles(this.prisma, this.s3Service, files);
      this.logS3Errors(
        result.errors,
        'Could not delete downloaded file from S3',
      );
      this.logger.log(
        { deleted: result.deleted, failed: result.errors.length },
        'Downloaded burn-after-download files deleted',
      );
    });
  }

  private logS3Errors(
    errors: { key: string; message: string }[],
    message: string,
  ) {
    for (const error of errors.slice(0, 5)) {
      this.logger.warn({ key: error.key, error: error.message }, message);
    }
  }
}
