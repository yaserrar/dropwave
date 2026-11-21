import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { minutes, Throttle } from '@nestjs/throttler';
import { CreateDropDto } from './dto/create-drop.dto.js';
import { UploadsService } from './uploads.service.js';
import { UploadTokenGuard } from './upload-token.guard.js';

// A drop holds up to 20 files, each needing an upload URL and a confirmation, so
// these routes allow more than the default 20 per minute. The upload token
// already limits them to the browser that created the drop.
const PER_FILE_LIMIT = { default: { limit: 60, ttl: minutes(1) } };

/** The uploading browser's routes. */
@Controller('drops')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Throttle({ default: { limit: 3, ttl: minutes(1) } })
  @Post()
  async createDrop(@Body() createDropDto: CreateDropDto) {
    return this.uploadsService.createDrop(createDropDto);
  }

  @Throttle(PER_FILE_LIMIT)
  @UseGuards(UploadTokenGuard)
  @Post(':id/files/:fileId/upload-url')
  async uploadUrl(
    @Param('id', ParseUUIDPipe) dropId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.uploadsService.uploadUrl(dropId, fileId);
  }

  @Throttle(PER_FILE_LIMIT)
  @UseGuards(UploadTokenGuard)
  @Post(':id/files/:fileId/confirm')
  async confirmUpload(
    @Param('id', ParseUUIDPipe) dropId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    return this.uploadsService.confirmUpload(dropId, fileId);
  }

  @Throttle(PER_FILE_LIMIT)
  @UseGuards(UploadTokenGuard)
  @Delete(':id/files/:fileId')
  @HttpCode(204)
  async removeFile(
    @Param('id', ParseUUIDPipe) dropId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    await this.uploadsService.removeFile(dropId, fileId);
  }
}
