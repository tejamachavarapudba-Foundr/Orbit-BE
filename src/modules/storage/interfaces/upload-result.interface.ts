export interface UploadResult {

  success: boolean;

  bucket: string;

  path: string;

  filename: string;

  originalFileName: string;

  url: string;

  mimetype: string;

  size: number;

}