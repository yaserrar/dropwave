import { Body, Controller, Get, Post } from '@nestjs/common';
import { FilesService } from './files.service.js';
import { GeneratePresignedUrlDto } from './dto/generate-presigned-url.dto.js';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  findAll() {
    return this.filesService.findAll();
  }

  @Post('generate')
  generatePresignedUrl(
    @Body() generatePresignedUrlDto: GeneratePresignedUrlDto,
  ) {
    return this.filesService.generatePresignedUrl(generatePresignedUrlDto);
  }
}
