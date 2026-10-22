import { HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomUUID } from 'crypto';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto.js';
import { S3Service } from '../s3/s3.service.js';
import {
  MAX_FILE_SIZE,
  S3_UPLOAD_EXPIRES_IN,
  S3_DOWNLOAD_EXPIRES_IN,
} from '../lib/consts.js';

@Injectable()
export class FilesService {
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

  async generatePresignedUrl(generateUploadUrlDto: GenerateUploadUrlDto) {
    if (generateUploadUrlDto.size > MAX_FILE_SIZE) {
      throw new HttpException('File size exceeds the maximum limit', 400);
    }

    const fileKey = this.s3Service.buildFileKey(randomUUID());

    const uploadUrl = await this.s3Service.createUploadUrl({
      key: fileKey,
      contentType: generateUploadUrlDto.contentType,
      expiresIn: S3_UPLOAD_EXPIRES_IN,
    });

    console.log(`Generated presigned URL for file key: ${uploadUrl}`);

    const file = await this.prisma.file.create({
      data: {
        key: fileKey,
        filename: generateUploadUrlDto.filename,
        contentType: generateUploadUrlDto.contentType,
        size: generateUploadUrlDto.size,
        status: 'PENDING',
      },
      select: {
        id: true,
        key: true,
        filename: true,
        contentType: true,
        size: true,
        status: true,
      },
    });

    return { uploadUrl: uploadUrl, file: file };
  }

  async confirmUpload(fileId: string) {
    const existingFile = await this.findOne(fileId);
    if (!existingFile) {
      throw new NotFoundException('File not found');
    }

    // check file exist in bucket
    const fileExists = await this.s3Service.checkFileExists(existingFile.key);
    if (!fileExists) {
      throw new NotFoundException('File does not exist in S3 bucket');
    }

    const newFile = await this.prisma.file.update({
      where: { id: fileId },
      data: { status: 'UPLOADED' },
    });

    const presignedUrl = await this.s3Service.createDownloadUrl({
      key: newFile.key,
      filename: newFile.filename,
      expiresIn: S3_DOWNLOAD_EXPIRES_IN,
    });

    return { file: newFile, downloadUrl: presignedUrl };
  }
}
