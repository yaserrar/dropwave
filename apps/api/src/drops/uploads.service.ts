import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { S3Service } from '../s3/s3.service.js';
import {
  MAX_DROP_SIZE,
  MAX_EXPIRY_MS,
  MIN_EXPIRY_MS,
  S3_UPLOAD_EXPIRES_IN,
  UPLOAD_TOKEN_TTL_SECONDS,
} from '../lib/consts.js';
import {
  baseName,
  findPathConflict,
  normalizeRelativePath,
} from '../lib/drop-paths.js';
import { formatBytes } from '../lib/format.js';
import { hashPassword } from '../lib/password.js';
import { CreateDropDto } from './dto/create-drop.dto.js';
import { ScanResultDto } from './dto/scan-result.dto.js';
import { LinkTokensService } from './link-tokens.service.js';

/**
 * Creating a drop and getting its files in: upload URLs, confirmations, the
 * file-check Lambda's verdicts, and removing a file before the link is shared.
 *
 * A drop stays hidden (404) while any of its files is PENDING, so a link never
 * shows a half-finished upload.
 */
@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
    private readonly tokens: LinkTokensService,
  ) {}

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

  /** Normalized paths in the order sent, or a 400 saying which one is wrong. */
  private parsePaths(dto: CreateDropDto): string[] {
    const paths = dto.files.map((file) => {
      const path = normalizeRelativePath(file.path);
      if (!path) {
        throw new BadRequestException(`"${file.path}" isn't a valid file path`);
      }
      return path;
    });
    const conflict = findPathConflict(paths);
    if (conflict) {
      throw new BadRequestException(
        conflict.kind === 'duplicate'
          ? `"${conflict.path}" is in the list twice`
          : `"${conflict.path}" is both a file and a folder`,
      );
    }
    return paths;
  }

  // Count, per-file size and type are checked by CreateDropDto before this runs.
  async createDrop(dto: CreateDropDto) {
    const expiresAt = this.parseExpiry(dto.expiresAt);
    const paths = this.parsePaths(dto);
    const totalSize = dto.files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_DROP_SIZE) {
      throw new BadRequestException(
        `All files together can be at most ${formatBytes(MAX_DROP_SIZE)}`,
      );
    }

    const dropId = randomUUID();
    // The file id doubles as its S3 key, which is how the Lambda's verdict finds it.
    const files = dto.files.map((file, index) => {
      const id = randomUUID();
      const path = paths[index]!;
      return {
        id,
        key: this.s3Service.buildFileKey(id),
        path,
        filename: baseName(path),
        contentType: file.contentType,
        size: file.size,
      };
    });
    const passwordHash = dto.password ? await hashPassword(dto.password) : null;
    const burnAfterDownload = dto.burnAfterDownload ?? false;

    await this.prisma.drop.create({
      data: {
        id: dropId,
        expiresAt,
        passwordHash,
        burnAfterDownload,
        files: {
          create: files.map((file) => ({ ...file, status: 'PENDING' })),
        },
      },
    });

    // Every URL is valid for a minute; with three uploads at a time, the browser asks
    // for a fresh one (uploadUrl below) when a file's turn comes later than that.
    const uploadUrls = await Promise.all(
      files.map((file) => this.createUploadUrl(file)),
    );

    // Never log the password or the upload URLs: anyone holding one can upload.
    this.logger.log(
      {
        dropId,
        files: files.length,
        size: totalSize,
        expiresAt,
        protected: passwordHash !== null,
        burnAfterDownload,
      },
      'Upload started',
    );

    const upload = this.tokens.issue(
      'upload',
      dropId,
      UPLOAD_TOKEN_TTL_SECONDS,
    );
    return {
      dropId,
      uploadToken: upload.token,
      files: files.map((file, index) => ({
        id: file.id,
        path: file.path,
        uploadUrl: uploadUrls[index]!,
      })),
    };
  }

  private createUploadUrl(file: { key: string; contentType: string }) {
    return this.s3Service.createUploadUrl({
      key: file.key,
      contentType: file.contentType,
      expiresIn: S3_UPLOAD_EXPIRES_IN,
    });
  }

  private async findFile(dropId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({
      where: { id: fileId, dropId },
    });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  /** A fresh upload URL, for a file whose first one expired before its turn. */
  async uploadUrl(dropId: string, fileId: string) {
    const file = await this.findFile(dropId, fileId);
    if (file.status !== 'PENDING') {
      throw new BadRequestException('This file is already uploaded');
    }
    return { uploadUrl: await this.createUploadUrl(file) };
  }

  async confirmUpload(dropId: string, fileId: string) {
    const existingFile = await this.findFile(dropId, fileId);

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
    this.logger.log({ dropId, fileId, status }, 'Upload confirmed');
    return { fileId, status };
  }

  /**
   * Takes a file out of its drop: removed from the list before the link is shared,
   * or failed to upload. Safe to call twice, and on a file the check rejected.
   */
  async removeFile(dropId: string, fileId: string) {
    const file = await this.findFile(dropId, fileId);
    // A file the check rejected stays listed as removed on the share page.
    if (file.status === 'DELETED' || file.status === 'REMOVED') return;

    await this.s3Service.deleteObject(file.key);
    await this.prisma.file.update({
      where: { id: fileId },
      data: { status: 'DELETED' },
    });
    this.logger.log({ dropId, fileId }, 'File removed from its drop');
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
    // Already cleaned up (e.g. expired or removed): nothing to update, and no
    // reason for Lambda to retry.
    if (!file || file.status === 'DELETED') {
      this.logger.warn(
        { key: result.key },
        'Scan result for a file that is gone; ignoring',
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
}
