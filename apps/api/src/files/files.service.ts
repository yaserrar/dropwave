import { HttpException, Injectable } from '@nestjs/common';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto.js';
import { S3Service } from '../s3/s3.service.js';
import { FILES_MAX_SIZE, S3_EXPIRES_IN } from '../lib/consts.js';

@Injectable()
export class FilesService {
  constructor(private readonly s3Service: S3Service) {}

  findAll() {
    return `This action returns all files`;
  }

  generatePresignedUrl(generateUploadUrlDto: GenerateUploadUrlDto) {
    if (!generateUploadUrlDto.filename) {
      return new HttpException('Filename is required', 400);
    }

    if (!generateUploadUrlDto.contentType) {
      return new HttpException('Content type is required', 400);
    }

    if (generateUploadUrlDto.size > FILES_MAX_SIZE) {
      return new HttpException('File size exceeds the maximum limit', 400);
    }

    const fileKey = this.s3Service.buildFileKey(generateUploadUrlDto.filename);

    const uploadUrl = this.s3Service.createUploadUrl({
      key: fileKey,
      contentType: generateUploadUrlDto.contentType,
      expiresIn: S3_EXPIRES_IN,
    });

    console.log(`Generated presigned URL for file key: ${fileKey}`);

    return uploadUrl;
  }
}
