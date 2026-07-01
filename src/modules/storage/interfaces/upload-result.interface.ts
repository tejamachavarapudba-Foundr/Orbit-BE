export interface UploadResult {

  success: boolean;

  bucket: string;

  path: string;

  filename: string;

  url: string;

  mimetype: string;

  size: number;

}