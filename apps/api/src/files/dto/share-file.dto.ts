import { IsArray, IsNotEmpty } from 'class-validator';

export class ShareFileDto {
  @IsNotEmpty()
  @IsArray()
  emails: string[];
}
