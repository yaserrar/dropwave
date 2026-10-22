import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FilesService } from './files.service.js';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto.js';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('generate')
  async generatePresignedUrl(
    @Body() generateUploadUrlDto: GenerateUploadUrlDto,
  ) {
    return this.filesService.generatePresignedUrl(generateUploadUrlDto);
  }

  @Post(':id/confirm')
  async confirmUpload(@Param('id', ParseUUIDPipe) fileId: string) {
    return this.filesService.confirmUpload(fileId);
  }
}
