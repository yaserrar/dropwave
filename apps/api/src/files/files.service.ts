import { Injectable } from '@nestjs/common';
import { GeneratePresignedUrlDto } from './dto/generate-presigned-url.dto.js';

@Injectable()
export class FilesService {
  findAll() {
    return `This action returns all files`;
  }

  generatePresignedUrl(generatePresignedUrlDto: GeneratePresignedUrlDto) {
    console.log(generatePresignedUrlDto);
    return generatePresignedUrlDto;
  }
}
