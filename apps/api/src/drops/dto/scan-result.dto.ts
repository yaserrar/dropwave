import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class ScanResultDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^uploads\//)
  key: string;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['clean', 'rejected'])
  verdict: 'clean' | 'rejected';

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  declaredType?: string;

  @IsString()
  @IsOptional()
  detectedType?: string;
}
