import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Redirect,
} from '@nestjs/common';
import { minutes, Throttle } from '@nestjs/throttler';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto.js';
import { ShareFileDto } from './dto/share-file.dto.js';
import { FilesService } from './files.service.js';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Throttle({ default: { limit: 3, ttl: minutes(1) } })
  @Post('generate')
  async generatePresignedUrl(
    @Body() generateUploadUrlDto: GenerateUploadUrlDto,
  ) {
    return this.filesService.generatePresignedUrl(generateUploadUrlDto);
  }

  @Get(':id')
  async getFileInfo(@Param('id', ParseUUIDPipe) fileId: string) {
    return this.filesService.getFileInfo(fileId);
  }

  @Post(':id/confirm')
  async confirmUpload(@Param('id', ParseUUIDPipe) fileId: string) {
    return this.filesService.confirmUpload(fileId);
  }

  // Images, PDFs and text only: a short-lived S3 URL that displays the file instead of downloading it.
  @Get(':id/preview')
  async preview(@Param('id', ParseUUIDPipe) fileId: string) {
    return this.filesService.getPreviewUrl(fileId);
  }

  // Redirects to a short-lived S3 URL, so a plain <a href> to this route downloads the file.
  @Get(':id/download')
  @Redirect()
  async download(@Param('id', ParseUUIDPipe) fileId: string) {
    return { url: await this.filesService.getDownloadUrl(fileId) };
  }

  // Each call sends real emails from our domain: few calls per IP, at most 25 emails per 10 minutes.
  @Throttle({ default: { limit: 5, ttl: minutes(10) } })
  @Post(':id/share')
  async share(
    @Param('id', ParseUUIDPipe) fileId: string,
    @Body() shareFileDto: ShareFileDto,
  ) {
    return this.filesService.share(fileId, shareFileDto);
  }
}
