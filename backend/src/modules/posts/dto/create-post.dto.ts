import { IsString, IsOptional, IsEnum } from 'class-validator';
import { PostCategory } from '@prisma/client';

// Hardcode the string array fallback matching your Prisma schema PostCategory enum.
// This prevents class-validator from crashing if Prisma hasn't loaded yet.
const PostCategoryValues = ['TECH', 'DESIGN', 'MARKETING', 'BUSINESS', 'OTHER']; 

export class CreatePostDto {
  @IsString()
  content!: string;

  @IsOptional()
  // Use the safe array values instead of the raw Prisma object reference
  @IsEnum(PostCategoryValues, {
    message: `category must be one of the following values: ${PostCategoryValues.join(', ')}`,
  })
  category?: PostCategory;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  linkUrl?: string;

  @IsOptional()
  @IsString()
  mediaType?: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}
