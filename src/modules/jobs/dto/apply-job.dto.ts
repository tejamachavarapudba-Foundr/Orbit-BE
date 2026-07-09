import { IsOptional, IsString } from "class-validator";

export class ApplyJobDto {
  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  coverLetter?: string;

  @IsOptional()
  @IsString()
  expectedSalary?: string;

  @IsOptional()
  @IsString()
  noticePeriod?: string;

  @IsOptional()
  @IsString()
  portfolioUrl?: string;

  @IsOptional()
  @IsString()
  linkedinUrl?: string;
}