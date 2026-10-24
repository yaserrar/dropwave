import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Credentials come from the default AWS chain: AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY
// or ~/.aws locally, and the instance's IAM role on EC2.
@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.client = new S3Client({
      region: config.getOrThrow<string>('AWS_REGION'),
      // Otherwise presigned PUT URLs embed a checksum of an empty body and every
      // browser upload fails. Only add checksums when an S3 operation requires one.
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
  }

  // The bucket is passed separately on every command, so it doesn't belong in the key.
  buildFileKey(fileId: string): string {
    return `uploads/${fileId}`;
  }

  /**
   * Presigned PUT URL the browser uploads to directly. The browser must send the
   * same Content-Type header, or S3 rejects the upload with SignatureDoesNotMatch.
   */
  createUploadUrl(params: {
    key: string;
    contentType: string;
    expiresIn?: number;
  }): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.contentType,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: params.expiresIn ?? 15 * 60,
      // Content-Type isn't signed by default; signing it is what makes S3 enforce it.
      signableHeaders: new Set(['content-type']),
    });
  }

  /**
   * Presigned GET URL. `attachment` (default) makes the browser download the file under
   * its original name; `inline` lets it display the file, e.g. in an <img> or <iframe>.
   */
  createDownloadUrl(params: {
    key: string;
    filename: string;
    expiresIn?: number;
    disposition?: 'attachment' | 'inline';
    /** Overrides the stored Content-Type, e.g. to force a charset for text previews. */
    contentType?: string;
  }): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ResponseContentDisposition: contentDisposition(
        params.filename,
        params.disposition ?? 'attachment',
      ),
      ResponseContentType: params.contentType,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: params.expiresIn ?? 5 * 60,
    });
  }

  /**
   * Size and type of an uploaded object, or null if nothing was uploaded at that key.
   * Use it to confirm an upload finished and that its size matches what the client declared.
   */
  async getObjectInfo(
    key: string,
  ): Promise<{ size: number; contentType: string | undefined } | null> {
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { size: head.ContentLength ?? 0, contentType: head.ContentType };
    } catch (error) {
      if (error instanceof NotFound) return null;
      throw error;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /**
   * Deletes up to 1000 objects in one request. S3 reports per-key failures in the
   * response instead of throwing, so this returns which keys were actually deleted.
   * Keys that don't exist count as deleted.
   */
  async deleteObjects(keys: string[]): Promise<{
    deleted: string[];
    errors: { key: string; message: string }[];
  }> {
    if (keys.length === 0) return { deleted: [], errors: [] };
    const result = await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
        },
      }),
    );
    return {
      deleted: (result.Deleted ?? []).flatMap((d) => (d.Key ? [d.Key] : [])),
      errors: (result.Errors ?? []).map((e) => ({
        key: e.Key ?? '',
        message: `${e.Code}: ${e.Message}`,
      })),
    };
  }

  async checkFileExists(key: string): Promise<boolean> {
    const info = await this.getObjectInfo(key);
    return info !== null;
  }

  async checkBucketExists(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}

// `filename` is the ASCII fallback for old clients; `filename*` carries the real
// UTF-8 name so names like "résumé.pdf" survive the download.
function contentDisposition(
  filename: string,
  disposition: 'attachment' | 'inline',
): string {
  const fallback = filename
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
