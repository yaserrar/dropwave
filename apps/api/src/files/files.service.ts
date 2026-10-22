import { Injectable } from '@nestjs/common';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto.js';

@Injectable()
export class FilesService {
  findAll() {
    return `This action returns all files`;
  }

  generatePresignedUrl(generateUploadUrlDto: GenerateUploadUrlDto) {
    return { ...generateUploadUrlDto };
  }
}
