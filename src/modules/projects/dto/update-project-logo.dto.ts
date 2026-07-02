import { IsOptional, IsString } from 'class-validator';

export class UpdateProjectLogoDto {
  @IsOptional()
  @IsString()
  logoUrl?: string;
}