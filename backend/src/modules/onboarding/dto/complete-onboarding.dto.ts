import { IsArray, IsOptional, IsString } from 'class-validator';

export class CompleteOnboardingDto {
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