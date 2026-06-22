// src/modules/media/media.controller.ts
import { Controller, Post, Body, UseInterceptors, UploadedFile, UseGuards, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { IsEnum, IsNotEmpty } from 'class-validator';

// 1. DTO placed directly inside the controller to prevent path resolution errors
export enum MediaKind {
  AVATAR = 'avatar',
  POST = 'post',
  COVER = 'cover',
}

export class UploadMediaDto {
  @IsEnum(MediaKind, { message: 'kind must be either avatar, post, or cover' })
  @IsNotEmpty()
  kind: MediaKind;
}
@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file')) // Matches the form-data key "file"
  async uploadFile(
    @UploadedFile() file: any,
    @Body() dto: UploadMediaDto,
  ) {
    if (!file) {
      throw new BadRequestException('File chunk missing. Please upload a file under the key "file"');
    }

    return this.mediaService.processUpload(file, dto.kind);
  }
}
