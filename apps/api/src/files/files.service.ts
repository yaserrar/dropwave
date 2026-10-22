import { Injectable } from '@nestjs/common';
import { CreateFileDto } from './dto/create-file.dto.js';
import { UpdateFileDto } from './dto/update-file.dto.js';

@Injectable()
export class FilesService {
  findAll() {
    return `This action returns all files`;
  }
}
