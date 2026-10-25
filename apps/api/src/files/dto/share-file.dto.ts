import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
} from 'class-validator';

import { MAX_SHARE_RECIPIENTS } from '../../lib/consts.js';

export class ShareFileDto {
  // Every address gets an email from our domain, so the list is capped (and the
  // route is throttled) to keep Dropwave from being used to send spam.
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_SHARE_RECIPIENTS)
  @ArrayUnique()
  @IsEmail({}, { each: true })
  emails: string[];
}
