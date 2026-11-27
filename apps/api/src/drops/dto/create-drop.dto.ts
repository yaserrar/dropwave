import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDate,
  IsInt,
  IsMimeType,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

import {
  MAX_FILE_SIZE,
  MAX_FILES_PER_DROP,
  MAX_PATH_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../lib/consts.js';

export class DropFileDto {
  // "report.pdf", or "photos/2024/a.jpg" for a file inside a dropped folder.
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PATH_LENGTH)
  path: string;

  @IsMimeType()
  contentType: string;

  @IsInt()
  @Min(1)
  @Max(MAX_FILE_SIZE)
  size: number;
}

// The total size and unique paths are checked by UploadsService.
export class CreateDropDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_FILES_PER_DROP)
  @ValidateNested({ each: true })
  @Type(() => DropFileDto)
  files: DropFileDto[];

  @IsOptional()
  @IsDate()
  @Transform(({ value }) => (value ? new Date(value) : value))
  expiresAt?: Date;

  // Only its hash is stored. Never logged.
  @IsOptional()
  @IsString()
  @Length(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)
  password?: string;

  @IsOptional()
  @IsBoolean()
  burnAfterDownload?: boolean;
}
