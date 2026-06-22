import { IsEmail, IsString } from 'class-validator';
export class LogoutDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}
