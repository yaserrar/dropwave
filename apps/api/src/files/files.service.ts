import {
  BadGatewayException,
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomUUID } from 'crypto';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto.js';
import { S3Service } from '../s3/s3.service.js';
import {
  MAX_EXPIRY_MS,
  MIN_EXPIRY_MS,
  S3_DOWNLOAD_EXPIRES_IN,
  S3_UPLOAD_EXPIRES_IN,
} from '../lib/consts.js';
import { previewKind } from '../lib/preview.js';
import { ScanResultDto } from './dto/scan-result.dto.js';
import { ShareFileDto } from './dto/share-file.dto.js';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service.js';
import { shareEmail } from '../mail/share-email.js';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly appUrl: string;

  constructor(
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    config: ConfigService,
  ) {
    // From config, never from the request: a forged Origin header would otherwise put
    // someone else's link in an email sent from our domain.
    this.appUrl = config.getOrThrow<string>('APP_URL').replace(/\/+$/, '');
  }

  async findAll() {
    return this.prisma.file.findMany();
  }

  async findOne(fileId: string) {
    return this.prisma.file.findUnique({
      where: { id: fileId },
    });
  }

  /** The file behind a share link, if it can be downloaded right now. */
  private async findAvailable(fileId: string) {
    const file = await this.findOne(fileId);

    // A PENDING file looks missing, so half-finished uploads can't be downloaded.
    if (!file || (file.status !== 'UPLOADED' && file.status !== 'SCANNING')) {
      throw new NotFoundException('File not found');
    }
    if (file.expiresAt && file.expiresAt < new Date()) {
      throw new GoneException('This link has expired');
    }
    return file;
  }

  /**
   * The optional expiry as a Date, or null for "never". The DTO checks it's a valid
   * date; this checks it's a sensible one. The ValidationPipe doesn't transform,
   * so at runtime the value is still the ISO string the client sent.
   */
  private parseExpiry(expiresAt: Date | string | undefined): Date | null {
    if (!expiresAt) return null;
    const date = new Date(expiresAt);
    const fromNow = date.getTime() - Date.now();
    if (fromNow < MIN_EXPIRY_MS) {
      throw new BadRequestException(
        'Expiry must be at least 5 minutes from now',
      );
    }
    if (fromNow > MAX_EXPIRY_MS) {
      throw new BadRequestException('Expiry can be at most 30 days from now');
    }
    return date;
  }

  // Size and type limits are enforced by GenerateUploadUrlDto before this runs.
  async generatePresignedUrl(generateUploadUrlDto: GenerateUploadUrlDto) {
    const expiresAt = this.parseExpiry(generateUploadUrlDto.expiresAt);

    // One id for both the row and the S3 key keeps them easy to match up.
    const fileId = randomUUID();
    const fileKey = this.s3Service.buildFileKey(fileId);

    const uploadUrl = await this.s3Service.createUploadUrl({
      key: fileKey,
      contentType: generateUploadUrlDto.contentType,
      expiresIn: S3_UPLOAD_EXPIRES_IN,
    });

    await this.prisma.file.create({
      data: {
        id: fileId,
        key: fileKey,
        filename: generateUploadUrlDto.filename,
        contentType: generateUploadUrlDto.contentType,
        size: generateUploadUrlDto.size,
        status: 'PENDING',
        expiresAt,
      },
    });

    // Don't log the URL itself: anyone holding it can upload until it expires.
    this.logger.log(
      {
        fileId,
        size: generateUploadUrlDto.size,
        contentType: generateUploadUrlDto.contentType,
        expiresAt,
      },
      'Upload started',
    );

    return { fileId, uploadUrl };
  }

  // Public: anyone with the link calls this, so only expose what the share page shows.
  async getFileInfo(fileId: string) {
    const file = await this.findAvailable(fileId);

    const { id, filename, contentType, size, status, expiresAt, createdAt } =
      file;
    return { id, filename, contentType, size, status, expiresAt, createdAt };
  }

  async confirmUpload(fileId: string) {
    const existingFile = await this.findOne(fileId);

    if (!existingFile) {
      throw new NotFoundException('File not found');
    }
    if (existingFile.status === 'REMOVED') {
      throw new BadRequestException(
        existingFile.scanReason ?? 'This file was rejected',
      );
    }
    if (existingFile.status !== 'PENDING') {
      throw new BadRequestException('File is not in pending state');
    }

    const object = await this.s3Service.getObjectInfo(existingFile.key);
    if (!object) {
      throw new BadRequestException('File has not been uploaded yet');
    }

    // The presigned URL can't limit size, so this is where the declared size
    // (already checked against MAX_FILE_SIZE by the DTO) is actually enforced.
    if (object.size !== existingFile.size) {
      await this.s3Service.deleteObject(existingFile.key);
      this.logger.warn(
        { fileId, declaredSize: existingFile.size, actualSize: object.size },
        'Upload rejected: size does not match the declared size',
      );
      throw new BadRequestException('Uploaded file size does not match');
    }

    await this.prisma.file.updateMany({
      where: { id: fileId, status: 'PENDING' },
      data: { status: 'SCANNING' },
    });
    // The scan may already have finished while the browser was uploading.
    await this.promoteIfClean(fileId);

    const { status } = await this.prisma.file.findUniqueOrThrow({
      where: { id: fileId },
      select: { status: true },
    });
    this.logger.log({ fileId, status }, 'Upload confirmed');
    return { fileId, status };
  }

  /**
   * SCANNING + a clean verdict → UPLOADED. Both /confirm and the scan result call it,
   * so whichever of the two arrives last makes the file available.
   */
  private async promoteIfClean(fileId: string) {
    await this.prisma.file.updateMany({
      where: { id: fileId, status: 'SCANNING', scanVerdict: 'CLEAN' },
      data: { status: 'UPLOADED' },
    });
  }

  /** Applies the file-check Lambda's verdict. Safe to run twice for the same file. */
  async applyScanResult(result: ScanResultDto) {
    const file = await this.prisma.file.findUnique({
      where: { key: result.key },
    });
    // Already cleaned up (e.g. expired): nothing to update, and no reason for Lambda to retry.
    if (!file) {
      this.logger.warn(
        { key: result.key },
        'Scan result for an unknown file; ignoring',
      );
      return;
    }

    if (result.verdict === 'rejected') {
      await this.s3Service.deleteObject(file.key);
      await this.prisma.file.update({
        where: { id: file.id },
        data: {
          status: 'REMOVED',
          scanVerdict: 'REJECTED',
          scanReason: result.reason,
        },
      });
      this.logger.warn(
        {
          fileId: file.id,
          reason: result.reason,
          declaredType: result.declaredType,
          detectedType: result.detectedType,
        },
        'File removed: failed the type check',
      );
      return;
    }

    // Clean: record it even if /confirm hasn't run yet.
    await this.prisma.file.updateMany({
      where: { id: file.id, status: { in: ['PENDING', 'SCANNING'] } },
      data: { scanVerdict: 'CLEAN' },
    });
    await this.promoteIfClean(file.id);
    this.logger.log(
      { fileId: file.id, detectedType: result.detectedType },
      'File passed the type check',
    );
  }

  // Returns the URL as JSON (not a redirect) so the browser can fetch text
  // straight from S3; following a redirect would turn its CORS origin into "null".
  async getPreviewUrl(fileId: string) {
    const file = await this.findAvailable(fileId);

    if (file.status === 'SCANNING') {
      throw new BadRequestException('File is still being scanned');
    }

    if (file.status !== 'UPLOADED') {
      throw new BadRequestException('File is still being checked');
    }

    const kind = previewKind(file.contentType);
    if (!kind) {
      throw new BadRequestException('This file type cannot be previewed');
    }

    const url = await this.s3Service.createDownloadUrl({
      key: file.key,
      filename: file.filename,
      expiresIn: S3_DOWNLOAD_EXPIRES_IN,
      disposition: 'inline',
      // Text is rendered by our page, never by the browser, so serve it as plain UTF-8.
      contentType:
        kind === 'text' ? 'text/plain; charset=utf-8' : file.contentType,
    });

    this.logger.log({ fileId, kind }, 'Preview opened');
    return { kind, url };
  }

  async getDownloadUrl(fileId: string) {
    const file = await this.findAvailable(fileId);

    if (file.status === 'SCANNING') {
      throw new BadRequestException('File is still being scanned');
    }

    const url = await this.s3Service.createDownloadUrl({
      key: file.key,
      filename: file.filename,
      expiresIn: S3_DOWNLOAD_EXPIRES_IN,
    });

    const { downloadCount } = await this.prisma.file.update({
      where: { id: fileId },
      data: { downloadCount: { increment: 1 } },
      select: { downloadCount: true },
    });
    this.logger.log({ fileId, downloadCount }, 'Download started');

    return url;
  }

  /**
   * Emails the share link, one email per address so recipients don't see each other.
   * Returns the addresses that failed instead of throwing, unless all of them did.
   */
  async share(fileId: string, shareFileDto: ShareFileDto) {
    const file = await this.findAvailable(fileId);

    if (file.status !== 'UPLOADED') {
      throw new BadRequestException('File is not available for sharing');
    }

    const email = shareEmail(file, `${this.appUrl}/s/${file.id}`);
    const failed: string[] = [];
    // One at a time: there are only a few, and the SES sandbox allows 1 email per second.
    for (const to of shareFileDto.emails) {
      try {
        await this.mailService.send(to, email);
      } catch (error) {
        failed.push(to);
        this.logger.warn(
          { fileId, to, reason: (error as Error).message },
          'Share email not sent',
        );
      }
    }

    const sent = shareFileDto.emails.length - failed.length;
    if (sent === 0) {
      throw new BadGatewayException(
        "Couldn't send the email. Please try again later.",
      );
    }
    this.logger.log(
      { fileId, sent, failed: failed.length },
      'File shared by email',
    );

    return { sent, failed };
  }
}
