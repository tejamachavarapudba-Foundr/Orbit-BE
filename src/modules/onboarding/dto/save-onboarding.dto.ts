import { IsArray, IsOptional, IsString } from 'class-validator';

export class SaveOnboardingDto {
  @IsOptional()
  @IsString()
  step?: string;

  @IsOptional()
  @IsString()
  memberRole?: string;

  @IsOptional()
  @IsArray()
  goals?: string[];

  @IsOptional()
  quickProfile?: any;

  @IsOptional()
  roleProfile?: any;
}