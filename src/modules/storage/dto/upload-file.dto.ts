import { IsEnum } from 'class-validator';
import { StorageType } from '../enums/storage-type.enum';

export enum UploadType {
  AVATAR = 'avatar',
  POST = 'post',
  PROJECT = 'project',
  EVENT = 'event',
  DOCUMENT = 'document',
  CHAT = 'chat',
}

export class UploadFileDto {
  @IsEnum(StorageType)
  type: StorageType;
}