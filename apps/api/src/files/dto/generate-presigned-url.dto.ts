import {
  IsInt,
  IsMimeType,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MAX_FILE_SIZE = 1024 * 1024 * 20; // 20 MB

export class GeneratePresignedUrlDto {
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
}
