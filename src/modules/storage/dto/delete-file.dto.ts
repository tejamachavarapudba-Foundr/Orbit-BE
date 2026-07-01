import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

import { StorageType } from '../enums/storage-type.enum';

export class DeleteFileDto {
  @IsEnum(StorageType)
  type: StorageType;

  @IsString()
  @IsNotEmpty()
  path: string;
}