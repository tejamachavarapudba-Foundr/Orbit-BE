// src/modules/media/dto/upload-media.dto.ts
import { IsEnum, IsNotEmpty } from 'class-validator';

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
