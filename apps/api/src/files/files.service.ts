import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomUUID } from 'crypto';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto.js';
import { S3Service } from '../s3/s3.service.js';
import { MAX_FILE_SIZE, S3_UPLOAD_EXPIRES_IN } from '../lib/consts.js';

@Injectable()
export class FilesService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
  ) {}

  findAll() {
    return `This action returns all files`;
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
    });

    return { uploadUrl: uploadUrl, file: file };
  }
}
