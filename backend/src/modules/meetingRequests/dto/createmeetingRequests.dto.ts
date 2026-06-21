import { IsString, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateMeetingRequestDto {
  @IsUUID()
  @IsNotEmpty()
  startupId: string;

  @IsString()
  @IsNotEmpty()
  purpose: string;

  @IsString()
  @IsNotEmpty()
  preferredDate1: string;

  @IsString()
  @IsNotEmpty()
  preferredTime1: string;

  @IsString()
  @IsNotEmpty()
  preferredDate2: string;

  @IsString()
  @IsNotEmpty()
  preferredTime2: string;

  @IsString()
  @IsNotEmpty()
  expectedInvestment: string;

  @IsString()
  @IsOptional()
  message?: string;
}
