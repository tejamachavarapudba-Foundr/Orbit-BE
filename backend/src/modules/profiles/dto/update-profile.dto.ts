import { IsArray, IsBoolean, IsOptional, IsString, IsInt, IsObject } from 'class-validator';
export class UpdateProfileDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() headline?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() linkedinUrl?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsArray() skills?: string[];
  @IsOptional() @IsArray() lookingFor?: string[];
  @IsOptional() @IsBoolean() openToConnect?: boolean;
  @IsOptional() @IsBoolean() onboardingCompleted?: boolean;
  @IsOptional() @IsArray() onboardingGoals?:     string[];
  @IsOptional() @IsInt() profileCompletion?:   number;
  @IsOptional() @IsString() onboardingStep?:      string;
  @IsOptional() @IsObject() roleProfile?: any;
}
