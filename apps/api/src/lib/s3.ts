import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Created on first use, not at import time: this file is imported before
// ConfigModule has loaded .env, so env vars aren't available yet at the top level.
let client: S3Client | undefined;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

// Credentials come from the default AWS chain: AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY
// or ~/.aws locally, and the instance's IAM role on EC2.
function s3(): S3Client {
  client ??= new S3Client({
    region: requireEnv('AWS_REGION'),
    // Otherwise presigned PUT URLs embed a checksum of an empty body and every
    // browser upload fails. Only add checksums when an S3 operation requires one.
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
  return client;
}

function bucket(): string {
  return requireEnv('S3_BUCKET');
}

export function buildFileKey(fileId: string): string {
  return `uploads/${fileId}`;
}

/**
 * Presigned PUT URL the browser uploads to directly. The browser must send the
 * same Content-Type header, or S3 rejects the upload with SignatureDoesNotMatch.
 */
export function createUploadUrl(params: {
  key: string;
  contentType: string;
  expiresIn?: number;
}): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: params.key,
    ContentType: params.contentType,
  });
  return getSignedUrl(s3(), command, {
    expiresIn: params.expiresIn ?? 15 * 60,
    // Content-Type isn't signed by default; signing it is what makes S3 enforce it.
    signableHeaders: new Set(['content-type']),
  });
}

/**
 * Presigned GET URL that makes the browser download the file under its original name.
 */
export function createDownloadUrl(params: {
  key: string;
  filename: string;
  expiresIn?: number;
}): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: params.key,
    ResponseContentDisposition: contentDisposition(params.filename),
  });
  return getSignedUrl(s3(), command, { expiresIn: params.expiresIn ?? 5 * 60 });
}

/**
 * Size and type of an uploaded object, or null if nothing was uploaded at that key.
 * Use it to confirm an upload finished and that its size matches what the client declared.
 */
export async function getObjectInfo(
  key: string,
): Promise<{ size: number; contentType: string | undefined } | null> {
  try {
    const head = await s3().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: key }),
    );
    return { size: head.ContentLength ?? 0, contentType: head.ContentType };
  } catch (error) {
    if (error instanceof NotFound) return null;
    throw error;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

// `filename` is the ASCII fallback for old clients; `filename*` carries the real
// UTF-8 name so names like "résumé.pdf" survive the download.
function contentDisposition(filename: string): string {
  const fallback = filename
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
