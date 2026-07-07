import {
  IsArray,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateJobDto {
  @IsString()
  startupName!: string;

  @IsString()
  heading!: string;

  @IsString()
  role!: string;

  @IsOptional()
  @IsString()
  experience?: string;

  @IsOptional()
  @IsArray()
  skills?: string[];

  @IsOptional()
  @IsString()
  description?: string;
}