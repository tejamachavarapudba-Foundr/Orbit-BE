import { IsIn, IsOptional, IsString } from 'class-validator';

export class ReviewFounderVerificationDto {
  @IsIn(['approved', 'rejected']) status: 'approved' | 'rejected';
  @IsString() @IsOptional() reviewNotes?: string;
}
