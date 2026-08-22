import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCommunityDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberIds?: string[];
}
