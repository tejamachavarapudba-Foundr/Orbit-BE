import { IsString, Length } from 'class-validator';

export class VerifyPhoneOtpDto {
  @IsString()
  @Length(4, 10)
  code: string;
}
