import {
  Body,
  Controller,
  Get,
  Head,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Redirect,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { minutes, Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ShareDropDto } from './dto/share-drop.dto.js';
import { UnlockDropDto } from './dto/unlock-drop.dto.js';
import { DropsService } from './drops.service.js';
import {
  UNLOCK_COOKIE,
  UnlockTokens,
  unlockCookieOptions,
} from './unlock-cookie.js';

/** The share page's routes: anyone with the link calls them. */
@Controller('drops')
export class DropsController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly dropsService: DropsService,
    config: ConfigService,
  ) {
    this.secureCookies = config
      .getOrThrow<string>('APP_URL')
      .startsWith('https:');
  }

  @Get(':id')
  async getInfo(
    @Param('id', ParseUUIDPipe) dropId: string,
    @UnlockTokens() unlockTokens: string[],
  ) {
    return this.dropsService.getInfo(dropId, unlockTokens);
  }

  // Few attempts per IP across all links; DropsService also limits wrong passwords per link.
  @Throttle({ default: { limit: 10, ttl: minutes(10) } })
  @Post(':id/unlock')
  @HttpCode(200)
  async unlock(
    @Param('id', ParseUUIDPipe) dropId: string,
    @Body() unlockDropDto: UnlockDropDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, expiresAt } = await this.dropsService.unlock(
      dropId,
      unlockDropDto.password,
    );
    res.cookie(
      UNLOCK_COOKIE,
      token,
      unlockCookieOptions(dropId, expiresAt, this.secureCookies),
    );
    return { unlockedUntil: expiresAt };
  }

  // Images, PDFs and text only: a short-lived S3 URL that displays the file instead of downloading it.
  @Get(':id/files/:fileId/preview')
  async preview(
    @Param('id', ParseUUIDPipe) dropId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @UnlockTokens() unlockTokens: string[],
  ) {
    return this.dropsService.getPreviewUrl(dropId, fileId, unlockTokens);
  }

  // Express answers HEAD with the GET handler unless a HEAD route comes first, and
  // a HEAD (link checkers, proxies, download managers) must not use up a
  // burn-after-download link. These two run the checks and send no file.
  @Head(':id/files/:fileId/download')
  @HttpCode(200)
  async checkDownload(
    @Param('id', ParseUUIDPipe) dropId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @UnlockTokens() unlockTokens: string[],
  ) {
    await this.dropsService.checkDownload(dropId, fileId, unlockTokens);
  }

  @Head(':id/download')
  @HttpCode(200)
  async checkDownloadAll(
    @Param('id', ParseUUIDPipe) dropId: string,
    @UnlockTokens() unlockTokens: string[],
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.dropsService.checkDownloadAll(dropId, unlockTokens, res);
  }

  // Redirects to a short-lived S3 URL, so a plain <a href> to this route downloads the file.
  @Get(':id/files/:fileId/download')
  @Redirect()
  async download(
    @Param('id', ParseUUIDPipe) dropId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @UnlockTokens() unlockTokens: string[],
  ) {
    return {
      url: await this.dropsService.getDownloadUrl(dropId, fileId, unlockTokens),
    };
  }

  // "Download all": a zip streamed from S3 through the API, so it works with a plain <a href> too.
  @Get(':id/download')
  async downloadAll(
    @Param('id', ParseUUIDPipe) dropId: string,
    @UnlockTokens() unlockTokens: string[],
    @Res() res: Response,
  ) {
    await this.dropsService.downloadAll(dropId, unlockTokens, res);
  }

  // Each call sends real emails from our domain: few calls per IP, at most 25 emails per 10 minutes.
  @Throttle({ default: { limit: 5, ttl: minutes(10) } })
  @Post(':id/share')
  async share(
    @Param('id', ParseUUIDPipe) dropId: string,
    @Body() shareDropDto: ShareDropDto,
  ) {
    return this.dropsService.share(dropId, shareDropDto);
  }
}
