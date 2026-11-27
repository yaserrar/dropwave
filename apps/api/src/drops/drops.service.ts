import {
  BadGatewayException,
  BadRequestException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { S3Service } from '../s3/s3.service.js';
import { MailService } from '../mail/mail.service.js';
import { shareEmail } from '../mail/share-email.js';
import {
  S3_BURN_DOWNLOAD_EXPIRES_IN,
  S3_DOWNLOAD_EXPIRES_IN,
  UNLOCK_MAX_FAILURES,
  UNLOCK_TOKEN_TTL_SECONDS,
  UNLOCK_WINDOW_MS,
} from '../lib/consts.js';
import {
  contentDisposition,
  dropTitle,
  zipFileName,
} from '../lib/drop-paths.js';
import { verifyPassword } from '../lib/password.js';
import { previewKind } from '../lib/preview.js';
import type {
  DownloadKind,
  File as DropFile,
} from '../generated/prisma/client.js';
import { ShareDropDto } from './dto/share-drop.dto.js';
import { writeZip } from './drop-zip.js';
import { LinkTokensService } from './link-tokens.service.js';
import { purgeFiles } from './purge.js';

/** Why a link can't be opened, so the share page can say so (410 responses). */
type GoneReason = 'expired' | 'consumed';

const gone = (reason: GoneReason) =>
  new GoneException({
    statusCode: HttpStatus.GONE,
    reason,
    message:
      reason === 'expired'
        ? 'This link has expired'
        : 'This link was already used: its files were downloaded once and deleted',
  });

/**
 * Everything the share page does with a link: its info, the password, previews,
 * downloads (one file, or all of them as a zip) and sharing by email.
 *
 * Password-protected drops refuse all of it, except the bare fact that the link is
 * protected and when it expires, until the browser sends a valid unlock token
 * (an httpOnly cookie set by `unlock`).
 */
@Injectable()
export class DropsService {
  private readonly logger = new Logger(DropsService.name);
  private readonly appUrl: string;

  constructor(
    private readonly s3Service: S3Service,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly tokens: LinkTokensService,
    config: ConfigService,
  ) {
    // From config, never from the request: a forged Origin header would otherwise put
    // someone else's link in an email sent from our domain.
    this.appUrl = config.getOrThrow<string>('APP_URL').replace(/\/+$/, '');
  }

  /** The drop behind a share link with its files, if the link works right now. */
  private async findViewable(dropId: string) {
    const drop = await this.prisma.drop.findUnique({
      where: { id: dropId },
      include: {
        files: {
          where: { status: { not: 'DELETED' } },
          orderBy: { path: 'asc' },
        },
      },
    });
    if (!drop) throw new NotFoundException('File not found');
    // Checked before anything else: nothing is left to protect or to wait for.
    if (drop.consumedAt) throw gone('consumed');
    if (drop.expiresAt && drop.expiresAt < new Date()) throw gone('expired');

    // A drop still uploading looks missing, so half-finished uploads can't be
    // opened; so does one whose files were all rejected by the check.
    if (
      drop.files.some((file) => file.status === 'PENDING') ||
      drop.files.every((file) => file.status === 'REMOVED')
    ) {
      throw new NotFoundException('File not found');
    }
    return drop;
  }

  /** When the browser's unlock expires; null for a link without a password. */
  private unlockedUntil(
    drop: { id: string; passwordHash: string | null },
    unlockTokens: string[],
  ): Date | null | undefined {
    if (!drop.passwordHash) return null;
    return this.tokens.verify('unlock', drop.id, unlockTokens) ?? undefined;
  }

  private async findUnlocked(dropId: string, unlockTokens: string[]) {
    const drop = await this.findViewable(dropId);
    if (this.unlockedUntil(drop, unlockTokens) === undefined) {
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        reason: 'locked',
        message: 'Enter the password to open this link',
      });
    }
    return drop;
  }

  private findFile(drop: { files: DropFile[] }, fileId: string) {
    const file = drop.files.find((f) => f.id === fileId);
    if (!file || file.status === 'REMOVED') {
      throw new NotFoundException('File not found');
    }
    if (file.status !== 'UPLOADED') {
      throw new BadRequestException('File is still being checked');
    }
    return file;
  }

  // Public: anyone with the link calls this, so only expose what the share page shows.
  async getInfo(dropId: string, unlockTokens: string[]) {
    const drop = await this.findViewable(dropId);
    const summary = {
      id: drop.id,
      protected: drop.passwordHash !== null,
      burnAfterDownload: drop.burnAfterDownload,
      expiresAt: drop.expiresAt,
    };

    const unlockedUntil = this.unlockedUntil(drop, unlockTokens);
    // Locked: no names, sizes or count until the password is entered.
    if (unlockedUntil === undefined) return { ...summary, locked: true };

    return {
      ...summary,
      locked: false,
      unlockedUntil,
      createdAt: drop.createdAt,
      files: drop.files.map(
        ({ id, path, filename, contentType, size, status }) => ({
          id,
          path,
          filename,
          contentType,
          size,
          status,
        }),
      ),
    };
  }

  /**
   * Checks the password and returns an unlock token for the cookie. Wrong passwords
   * are limited per link (here) and per IP (the route's throttle), so a link can't
   * be brute-forced from one machine or from many.
   */
  async unlock(dropId: string, password: string) {
    const drop = await this.findViewable(dropId);
    if (!drop.passwordHash) {
      throw new BadRequestException('This link has no password');
    }

    await this.takeUnlockAttempt(drop.id);
    if (!(await verifyPassword(password, drop.passwordHash))) {
      const { unlockFailures } = await this.prisma.drop.findUniqueOrThrow({
        where: { id: drop.id },
        select: { unlockFailures: true },
      });
      this.logger.warn({ dropId, failures: unlockFailures }, 'Wrong password');
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        reason: 'wrong-password',
        message: 'Wrong password',
        attemptsLeft: Math.max(0, UNLOCK_MAX_FAILURES - unlockFailures),
      });
    }

    // The right password clears the count, so earlier typos don't add up.
    await this.prisma.drop.update({
      where: { id: drop.id },
      data: { unlockFailures: 0, unlockWindowStart: null },
    });
    this.logger.log({ dropId }, 'Link unlocked');
    return this.tokens.issue('unlock', drop.id, UNLOCK_TOKEN_TTL_SECONDS);
  }

  /**
   * Counts an attempt before the password is checked, atomically, so parallel
   * guesses can't slip past the limit: at most UNLOCK_MAX_FAILURES attempts per
   * window without a success.
   */
  private async takeUnlockAttempt(dropId: string) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - UNLOCK_WINDOW_MS);

    // The last window is over (or there was none): this attempt opens a new one.
    const opened = await this.prisma.drop.updateMany({
      where: {
        id: dropId,
        OR: [
          { unlockWindowStart: null },
          { unlockWindowStart: { lt: windowStart } },
        ],
      },
      data: { unlockFailures: 1, unlockWindowStart: now },
    });
    if (opened.count > 0) return;

    const counted = await this.prisma.drop.updateMany({
      where: {
        id: dropId,
        unlockWindowStart: { gte: windowStart },
        unlockFailures: { lt: UNLOCK_MAX_FAILURES },
      },
      data: { unlockFailures: { increment: 1 } },
    });
    if (counted.count > 0) return;

    const { unlockWindowStart } = await this.prisma.drop.findUniqueOrThrow({
      where: { id: dropId },
      select: { unlockWindowStart: true },
    });
    const retryInMs =
      (unlockWindowStart?.getTime() ?? now.getTime()) +
      UNLOCK_WINDOW_MS -
      now.getTime();
    const minutes = Math.max(1, Math.ceil(retryInMs / 60_000));
    this.logger.warn({ dropId }, 'Unlock refused: too many wrong passwords');
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        reason: 'too-many-attempts',
        message: `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // Returns the URL as JSON (not a redirect) so the browser can fetch text
  // straight from S3; following a redirect would turn its CORS origin into "null".
  async getPreviewUrl(dropId: string, fileId: string, unlockTokens: string[]) {
    const drop = await this.findUnlocked(dropId, unlockTokens);
    // The content of a burn-after-download link is fetched once, by its download.
    if (drop.burnAfterDownload) {
      throw new BadRequestException(
        'Previews are off for links that work for one download only',
      );
    }
    const file = this.findFile(drop, fileId);

    const kind = previewKind(file.contentType);
    if (!kind) {
      throw new BadRequestException('This file type cannot be previewed');
    }

    const url = await this.s3Service.createDownloadUrl({
      key: file.key,
      filename: file.filename,
      expiresIn: S3_DOWNLOAD_EXPIRES_IN,
      disposition: 'inline',
      // Text is rendered by our page, never by the browser, so serve it as plain UTF-8.
      contentType:
        kind === 'text' ? 'text/plain; charset=utf-8' : file.contentType,
    });

    this.logger.log({ dropId, fileId, kind }, 'Preview opened');
    return { kind, url };
  }

  /** The file a download sends. A burn-after-download link has one download: with several files, that's the zip. */
  private downloadableFile(
    drop: { burnAfterDownload: boolean; files: DropFile[] },
    fileId: string,
  ) {
    const file = this.findFile(drop, fileId);
    if (
      drop.burnAfterDownload &&
      drop.files.filter((f) => f.status !== 'REMOVED').length > 1
    ) {
      throw new BadRequestException(
        'This link works for one download only: download all the files at once',
      );
    }
    return file;
  }

  /**
   * A download's checks without the download, for HEAD requests: link checkers,
   * proxies and download managers send them, and they must never use up a
   * burn-after-download link.
   */
  async checkDownload(dropId: string, fileId: string, unlockTokens: string[]) {
    const drop = await this.findUnlocked(dropId, unlockTokens);
    this.downloadableFile(drop, fileId);
  }

  /** A presigned URL for one file. On a burn-after-download link, this is the one download. */
  async getDownloadUrl(dropId: string, fileId: string, unlockTokens: string[]) {
    const drop = await this.findUnlocked(dropId, unlockTokens);
    const file = this.downloadableFile(drop, fileId);
    if (drop.burnAfterDownload) await this.consume(drop.id, 'FILE');

    // A presigned URL can be reused until it expires, so a burn-after-download
    // file gets one that lasts a minute; the object is deleted right after (TasksService).
    const url = await this.s3Service.createDownloadUrl({
      key: file.key,
      filename: file.filename,
      expiresIn: drop.burnAfterDownload
        ? S3_BURN_DOWNLOAD_EXPIRES_IN
        : S3_DOWNLOAD_EXPIRES_IN,
    });

    const { downloadCount } = await this.prisma.file.update({
      where: { id: file.id },
      data: { downloadCount: { increment: 1 } },
      select: { downloadCount: true },
    });
    this.logger.log(
      { dropId, fileId, downloadCount, burned: drop.burnAfterDownload },
      'Download started',
    );
    return url;
  }

  /** The files "Download all" zips, once none is still being checked. */
  private zipFiles(drop: { files: DropFile[] }) {
    if (drop.files.some((file) => file.status === 'SCANNING')) {
      throw new BadRequestException(
        'Some files are still being checked. Try again in a few seconds.',
      );
    }
    return drop.files.filter((file) => file.status === 'UPLOADED');
  }

  private setZipHeaders(res: Response, dropId: string, files: DropFile[]) {
    const name = zipFileName(
      files.map((file) => file.path),
      dropId,
    );
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      contentDisposition(name, 'attachment'),
    );
    res.setHeader('Cache-Control', 'no-store');
  }

  /** HEAD on "Download all": the zip's checks and headers, without using up the link. */
  async checkDownloadAll(
    dropId: string,
    unlockTokens: string[],
    res: Response,
  ) {
    const drop = await this.findUnlocked(dropId, unlockTokens);
    this.setZipHeaders(res, drop.id, this.zipFiles(drop));
  }

  /**
   * "Download all": streams every available file as one zip, read from S3 as it's
   * sent. On a burn-after-download link this is the one download; its files are
   * deleted as soon as the zip ends, complete or cut short.
   */
  async downloadAll(dropId: string, unlockTokens: string[], res: Response) {
    const drop = await this.findUnlocked(dropId, unlockTokens);
    const files = this.zipFiles(drop);
    if (drop.burnAfterDownload) await this.consume(drop.id, 'ZIP');
    this.setZipHeaders(res, drop.id, files);

    // The client closing the connection stops reading from S3 straight away.
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) abort.abort(new Error('Client went away'));
    });

    try {
      await writeZip(
        files.map((file) => ({
          key: file.key,
          path: file.path,
          contentType: file.contentType,
          date: file.createdAt,
        })),
        (key) => this.s3Service.getObjectStream(key),
        res,
        abort.signal,
      );
    } catch (error) {
      if (!res.headersSent) {
        // Nothing was sent: the link isn't used up, and the client gets a real error.
        if (drop.burnAfterDownload) await this.release(drop.id);
        // Answered as JSON, so the browser mustn't save it as the zip.
        res.removeHeader('Content-Disposition');
        this.logger.error(error, 'Zip download failed before it started');
        throw new BadGatewayException(
          "Couldn't prepare the download. Please try again.",
        );
      }
      // Mid-stream there's no status left to change; cut the connection so the
      // browser reports a failed download instead of saving a broken zip.
      this.logger.warn(
        { dropId, reason: (error as Error).message },
        'Zip download interrupted',
      );
      res.destroy();
      // Part of the content went out, so the link stays used up.
      if (drop.burnAfterDownload) await this.purgeZipped(drop.id, files);
      return;
    }

    if (drop.burnAfterDownload) {
      await this.purgeZipped(drop.id, files);
      return;
    }
    const { downloadCount } = await this.prisma.drop.update({
      where: { id: drop.id },
      data: { downloadCount: { increment: 1 } },
      select: { downloadCount: true },
    });
    this.logger.log(
      { dropId, files: files.length, downloadCount },
      'Zip downloaded',
    );
  }

  /**
   * Deletes a burn-after-download drop's files once its zip has ended. The purge
   * job retries what fails here, hours later (it can't tell a failed delete from
   * a zip still streaming).
   */
  private async purgeZipped(dropId: string, files: DropFile[]) {
    const result = await purgeFiles(this.prisma, this.s3Service, files);
    for (const error of result.errors.slice(0, 5)) {
      this.logger.warn(
        { dropId, key: error.key, error: error.message },
        'Could not delete zipped file from S3',
      );
    }
    this.logger.log(
      { dropId, files: files.length, deleted: result.deleted },
      'Zip ended; burn-after-download files deleted',
    );
  }

  /**
   * Marks a burn-after-download drop as used, and how. One UPDATE guarded by
   * `consumedAt IS NULL`: of two downloads at the same moment, exactly one wins.
   */
  private async consume(dropId: string, by: DownloadKind) {
    const { count } = await this.prisma.drop.updateMany({
      where: { id: dropId, burnAfterDownload: true, consumedAt: null },
      data: { consumedAt: new Date(), consumedBy: by },
    });
    if (count === 0) throw gone('consumed');
  }

  private async release(dropId: string) {
    await this.prisma.drop.update({
      where: { id: dropId },
      data: { consumedAt: null, consumedBy: null },
    });
  }

  /**
   * Emails the share link, one email per address so recipients don't see each other.
   * Returns the addresses that failed instead of throwing, unless all of them did.
   * Needs no unlock: a protected link's email names nothing, and has no password.
   */
  async share(dropId: string, shareDropDto: ShareDropDto) {
    const drop = await this.findViewable(dropId);

    // The type check takes seconds; the API only emails links to checked files.
    if (drop.files.some((file) => file.status === 'SCANNING')) {
      throw new BadRequestException(
        'This file is still being checked. Try again in a few seconds.',
      );
    }

    const files = drop.files.filter((file) => file.status === 'UPLOADED');
    const email = shareEmail(
      {
        title: dropTitle(files.map((file) => file.path)),
        fileCount: files.length,
        size: files.reduce((sum, file) => sum + file.size, 0),
        expiresAt: drop.expiresAt,
        protected: drop.passwordHash !== null,
        burnAfterDownload: drop.burnAfterDownload,
      },
      `${this.appUrl}/s/${drop.id}`,
    );
    const failed: string[] = [];
    // One at a time: there are only a few, and the SES sandbox allows 1 email per second.
    for (const to of shareDropDto.emails) {
      try {
        await this.mailService.send(to, email);
      } catch (error) {
        failed.push(to);
        this.logger.warn(
          { dropId, to, reason: (error as Error).message },
          'Share email not sent',
        );
      }
    }

    const sent = shareDropDto.emails.length - failed.length;
    if (sent === 0) {
      throw new BadGatewayException(
        "Couldn't send the email. Please try again later.",
      );
    }
    this.logger.log(
      { dropId, sent, failed: failed.length },
      'Link shared by email',
    );

    return { sent, failed };
  }
}
