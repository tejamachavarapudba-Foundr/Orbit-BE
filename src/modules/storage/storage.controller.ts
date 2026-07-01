import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

import { StorageService } from './storage.service';

import { UploadFileDto } from './dto/upload-file.dto';
import { DeleteFileDto } from './dto/delete-file.dto';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    }),
  )
  async upload(
    @UploadedFile()
    file: Express.Multer.File,

    @Body()
    dto: UploadFileDto,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded.',
      );
    }

    return this.storageService.upload(
      file,
      dto.type,
    );
  }

  @Delete('delete')
  async delete(
    @Body()
    dto: DeleteFileDto,
  ) {
    return this.storageService.delete(
      dto.type,
      dto.path,
    );
  }
}