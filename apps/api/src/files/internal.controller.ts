import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ScanResultDto } from './dto/scan-result.dto.js';
import { FilesService } from './files.service.js';
import { ScanSignatureGuard } from './scan-signature.guard.js';

/** Routes for our own infrastructure, never the browser. */
@Controller('internal')
export class InternalController {
  constructor(private readonly filesService: FilesService) {}

  // Called by the file-check Lambda; ScanSignatureGuard checks its signature.
  @Post('scan-result')
  @HttpCode(204)
  @SkipThrottle()
  @UseGuards(ScanSignatureGuard)
  async scanResult(@Body() result: ScanResultDto) {
    await this.filesService.applyScanResult(result);
  }
}
