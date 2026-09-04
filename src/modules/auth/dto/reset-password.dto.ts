import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

const PASSWORD_COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
const PASSWORD_MESSAGE = 'Password must include an uppercase letter, a lowercase letter, a number, and a symbol.';

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Please enter a valid email address' })
  email: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code.' })
  code: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @Matches(PASSWORD_COMPLEXITY, { message: PASSWORD_MESSAGE })
  newPassword: string;
}
