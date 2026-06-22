// src/modules/media/dto/upload-media.dto.ts
import { IsEnum, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export enum MediaKind {
  AVATAR = 'avatar',
  POST = 'post',
  COVER = 'cover',
}

export class UploadMediaDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEnum(MediaKind, { message: 'kind must be either avatar, post, or cover' })
  @IsNotEmpty()
  kind: MediaKind;
}
