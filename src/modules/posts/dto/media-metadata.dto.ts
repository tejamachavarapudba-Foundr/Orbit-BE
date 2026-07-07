import { MediaOrientation } from "@prisma/client";

export class MediaMetadataDto {
  index!: number;

  width?: number;

  height?: number;

  duration?: number;

  mimeType?: string;

  fileSize?: number;

  orientation?: MediaOrientation;
}