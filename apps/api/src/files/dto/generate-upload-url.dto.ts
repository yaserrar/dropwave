import {
  IsInt,
  IsMimeType,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  IsDate,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

import { MAX_FILE_SIZE } from '../../lib/consts.js';

export class GenerateUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename: string;

  @IsMimeType()
  contentType: string;

  @IsInt()
  @Min(1)
  @Max(MAX_FILE_SIZE)
  size: number;

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => (value ? new Date(value) : value))
  expiresAt?: Date;
}
