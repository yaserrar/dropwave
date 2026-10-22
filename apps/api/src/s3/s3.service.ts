import { S3Client } from '@aws-sdk/client-s3/dist-types/S3Client.js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.client = new S3Client({
      region: config.getOrThrow<string>('AWS_REGION'),
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
    this.bucket = config.getOrThrow<string>('AWS_S3_BUCKET_NAME');
  }

  buildFileKey(fileName: string): string {
    return `${this.bucket}/${fileName}`;
  }
}
