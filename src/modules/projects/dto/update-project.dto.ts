import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

// Hardcoded to match the Prisma ProjectStage enum — avoids importing
// @prisma/client here before it's generated.
const ProjectStageValues = ['idea', 'prototype', 'mvp', 'beta', 'launched', 'growth', 'scaling', 'profitable'];

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  tagline?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  pitch?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industryTags?: string[];

  @IsOptional()
  @IsString()
  projectType?: string;

  @IsOptional()
  @IsEnum(ProjectStageValues, {
    message: `stage must be one of the following values: ${ProjectStageValues.join(', ')}`,
  })
  stage?: string;

  @IsOptional()
  @IsString()
  fundingStage?: string;

  @IsOptional()
  @IsInt()
  teamSize?: number;

  @IsOptional()
  @IsInt()
  foundedYear?: number | null;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  demoUrl?: string;

  @IsOptional()
  @IsString()
  pitchDeckUrl?: string;

  @IsOptional()
  @IsString()
  pitchVideoUrl?: string;

  @IsOptional()
  @IsString()
  askAmount?: string;

  @IsOptional()
  @IsString()
  equityPercent?: string;

  @IsOptional()
  @IsString()
  githubUrl?: string;

  @IsOptional()
  @IsString()
  twitterUrl?: string;

  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  coverUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  techStack?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lookingFor?: string[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsString()
  cinNumber?: string;

  @IsOptional()
  @IsString()
  dpiitNumber?: string;

  @IsOptional()
  @IsString()
  incorporationDocUrl?: string;

  @IsOptional()
  @IsString()
  incorporationDocKey?: string;

  @IsOptional()
  @IsString()
  incorporationReason?: string;
}
