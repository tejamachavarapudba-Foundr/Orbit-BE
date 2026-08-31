import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

const PASSWORD_COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
const PASSWORD_MESSAGE = 'Password must include an uppercase letter, a lowercase letter, a number, and a symbol.';

export class RegisterDto {
  @IsEmail() email!: string;
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @Matches(PASSWORD_COMPLEXITY, { message: PASSWORD_MESSAGE })
  password!: string;
  @IsString() fullName!: string;
}
