import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PostCategory } from '@prisma/client';

const PostCategoryValues = ['Announcement', 'Launch', 'Marketing', 'Funding', 'Hiring', 'Service', 'Advertisement', 'Update', 'Milestone', 'Query', 'Other'];

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(PostCategoryValues, {
    message: `category must be one of the following values: ${PostCategoryValues.join(', ')}`,
  })
  category?: PostCategory;

  @IsOptional()
  @IsString()
  linkUrl?: string;
}
