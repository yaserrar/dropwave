import { Body, Controller, Get, Post } from '@nestjs/common';
import { FilesService } from './files.service.js';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto.js';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  findAll() {
    return this.filesService.findAll();
  }

  @Post('generate')
  generatePresignedUrl(@Body() generateUploadUrlDto: GenerateUploadUrlDto) {
    return this.filesService.generatePresignedUrl(generateUploadUrlDto);
  }
}
