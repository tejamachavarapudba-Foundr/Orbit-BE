import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubmitFounderVerificationDto {
  @IsString() @IsNotEmpty() certificateName: string;
  @IsString() @IsOptional() cinNumber?: string;
  @IsString() @IsNotEmpty() documentUrl: string;
  @IsString() @IsNotEmpty() documentKey: string;
}
