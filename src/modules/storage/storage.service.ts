import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { randomUUID } from 'crypto';

import { extname } from 'path';

import { StorageType } from './enums/storage-type.enum';

import { UploadResult } from './interfaces/upload-result.interface';


@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  private readonly supabase: SupabaseClient;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.supabase = createClient(
      this.configService.getOrThrow<string>('SUPABASE_URL'),
      this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

    private getBucket(type: StorageType): string {
  switch (type) {
    case StorageType.AVATAR:
      return this.configService.get<string>(
        'SUPABASE_BUCKET_AVATARS',
        'avatars',
      );

    case StorageType.POST:
      return this.configService.get<string>(
        'SUPABASE_BUCKET_POSTS',
        'post-media',
      );

    case StorageType.PROJECT:
      return this.configService.get<string>(
        'SUPABASE_BUCKET_PROJECTS',
        'project-images',
      );

    case StorageType.EVENT:
      return this.configService.get<string>(
        'SUPABASE_BUCKET_EVENTS',
        'event-images',
      );

    case StorageType.DOCUMENT:
      return this.configService.get<string>(
        'SUPABASE_BUCKET_DOCUMENTS',
        'documents',
      );

    case StorageType.RESUME:
      return this.configService.get<string>(
        "SUPABASE_BUCKET_RESUMES",
        "resumes",
      );

    case StorageType.CHAT:
      return this.configService.get<string>(
        'SUPABASE_BUCKET_CHAT',
        'chat-media',
      );

    default:
      throw new BadRequestException('Invalid storage type');
  }
}

  private generateFilename(
    originalName: string,
    prefix?: string,
  ) {
    return `${prefix ?? randomUUID()}${extname(originalName)}`;
  }

  private buildPath(
    entityId: string,
    filename: string,
  ) {
    return `${entityId}/${filename}`;
  }

  private getPublicUrl(
    bucket: string,
    path: string,
  ) {
    const {
      data: { publicUrl },
    } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return publicUrl;
  }

  private validateImage(
    file: Express.Multer.File,
  ) {
    const allowed = [
      'image/png',
      'image/jpeg',
      'image/webp',
    ];

    if (
      !allowed.includes(file.mimetype)
    ) {
      throw new BadRequestException(
        'Invalid image format.',
      );
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      throw new BadRequestException(
        'Image exceeds 5 MB.',
      );
    }
  }

  private validateVideo(
    file: Express.Multer.File,
  ) {
    const allowed = [
      'video/mp4',
      'video/quicktime',
      'video/webm',
    ];

    if (
      !allowed.includes(file.mimetype)
    ) {
      throw new BadRequestException(
        'Invalid video format.',
      );
    }

    if (
      file.size >
      50 * 1024 * 1024
    ) {
      throw new BadRequestException(
        'Video exceeds 50 MB.',
      );
    }
  }

  private validateDocument(
    file: Express.Multer.File,
  ) {
    const allowed = [
      'application/pdf',
    ];

    if (
      !allowed.includes(file.mimetype)
    ) {
      throw new BadRequestException(
        'Only PDF allowed.'
      );
    }

    if (
      file.size >
      20 * 1024 * 1024
    ) {
      throw new BadRequestException(
        'Document exceeds 20 MB.',
      );
    }
  }

  private validate(
    file: Express.Multer.File,
    type: StorageType,
  ) {

    switch (type) {

      case StorageType.AVATAR:
      case StorageType.PROJECT:
      case StorageType.EVENT:

        this.validateImage(file);

        break;

      case StorageType.POST:

        if (
          file.mimetype.startsWith(
            'image/',
          )
        ) {

          this.validateImage(file);

        } else {

          this.validateVideo(file);

        }

        break;

      case StorageType.DOCUMENT:

        this.validateDocument(file);

        break;

      case StorageType.RESUME:

        this.validateResume(file);

        break;

      case StorageType.CHAT:

        break;

    }

  }
     async upload(
    file: Express.Multer.File,
    type: StorageType,
    entityId?: string,
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    
    
    this.validate(file, type);

    const bucket = this.getBucket(type);

    const filename = this.generateFilename(file.originalname);

    const path = this.buildPath(entityId ?? type, filename);

    const startedAt = Date.now();

    const { error } = await this.supabase.storag
      .from(bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(error.message);

      throw new InternalServerErrorException(
        'Failed to upload file.',
      );
    }

    const url =
      type === StorageType.RESUME
        ? ""
        : this.getPublicUrl(bucket, path);

    this.logger.log(
      `Uploaded ${filename} (${file.size} bytes) to ${bucket} in ${
        Date.now() - startedAt
      }ms`,
    );

    return {
      success: true,
      bucket,
      path,
      filename,
      originalFileName: file.originalname,
      url,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  async delete(
  type: StorageType,
  path: string,
) {
  const bucket = this.getBucket(type);

  const { error } = await this.supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    console.error('SUPABASE STORAGE ERROR:', error);
    this.logger.error(error.message);

    throw new InternalServerErrorException(error.message);
  }

  return {
    success: true,
    message: 'File deleted successfully.',
  };
}

  async exists(
  type: StorageType,
  path: string,
): Promise<boolean> {
  const bucket = this.getBucket(type);

  const folder = path.substring(
    0,
    path.lastIndexOf('/'),
  );

  const fileName = path.substring(
    path.lastIndexOf('/') + 1,
  );

  const { data, error } =
    await this.supabase.storage
      .from(bucket)
      .list(folder);

  if (error) {
    return false;
  }

  return data.some(
    (file) => file.name === fileName,
  );
}

  async getMetadata(
  type: StorageType,
  path: string,
) {
  const bucket = this.getBucket(type);

  const folder = path.substring(
    0,
    path.lastIndexOf('/'),
  );

  const fileName = path.substring(
    path.lastIndexOf('/') + 1,
  );

  const { data, error } =
    await this.supabase.storage
      .from(bucket)
      .list(folder);

  if (error) {
    throw new InternalServerErrorException(
      error.message,
    );
  }

  return data.find(
    (file) => file.name === fileName,
  );
  }

  extractPathFromUrl(
      url: string,
  ) {
      const marker = "/object/public/";

      const index = url.indexOf(marker);

      if (index === -1) {
        return "";
      }

      const path = url.substring(
        index + marker.length,
      );

      return path.substring(
        path.indexOf("/") + 1,
      );
  }

  
  private validateResume(
    file: Express.Multer.File,
  ) {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
          "Resume must be PDF, DOC or DOCX.",
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException(
        "Resume exceeds 10 MB.",
      );
    }
  }

}