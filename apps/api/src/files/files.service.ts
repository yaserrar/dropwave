import {
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

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
  ) {}

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
    this.logger.log(expiresAt);
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
    this.logger.log(`Generated upload URL for file ${fileId}`);

    return { fileId, uploadUrl };
  }

  // Public: anyone with the link calls this, so only expose what the share page shows.
  async getFileInfo(fileId: string) {
    const file = await this.findAvailable(fileId);

    return file;
  }

  async confirmUpload(fileId: string) {
    const existingFile = await this.findAvailable(fileId);

    const object = await this.s3Service.getObjectInfo(existingFile.key);
    if (!object) {
      throw new BadRequestException('File has not been uploaded yet');
    }

    // The presigned URL can't limit size, so this is where the declared size
    // (already checked against MAX_FILE_SIZE by the DTO) is actually enforced.
    if (object.size !== existingFile.size) {
      await this.s3Service.deleteObject(existingFile.key);
      throw new BadRequestException('Uploaded file size does not match');
    }

    await this.prisma.file.update({
      where: { id: fileId },
      data: { status: 'SCANNING' },
    });

    return { fileId };
  }

  async markScanComplete(fileId: string) {
    const file = await this.findAvailable(fileId);

    if (file.status !== 'SCANNING') {
      throw new BadRequestException('File is not in scanning state');
    }

    await this.prisma.file.update({
      where: { id: fileId },
      data: { status: 'UPLOADED' },
    });

    return { fileId };
  }

  // Returns the URL as JSON (not a redirect) so the browser can fetch text
  // straight from S3; following a redirect would turn its CORS origin into "null".
  async getPreviewUrl(fileId: string) {
    const file = await this.findAvailable(fileId);

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

    await this.prisma.file.update({
      where: { id: fileId },
      data: { downloadCount: { increment: 1 } },
    });

    return url;
  }
}
