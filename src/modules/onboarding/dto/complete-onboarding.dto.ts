import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

const MEMBER_ROLES = ['founder', 'investor', 'advisor', 'professional', 'service_provider'];

export class CompleteOnboardingDto {
  @IsOptional()
  @IsIn(MEMBER_ROLES)
  memberRole?: string;

  @IsOptional()
  @IsArray()
  goals?: string[];

  @IsOptional()
  quickProfile?: any;

  @IsOptional()
  roleProfile?: any;
}
