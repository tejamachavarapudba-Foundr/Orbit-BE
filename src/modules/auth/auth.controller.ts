import { Body, Controller, Get, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { SendPhoneOtpDto } from './dto/send-phone-otp.dto';
import { VerifyPhoneOtpDto } from './dto/verify-phone-otp.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public() @Post('register')
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  @Public() @Post('login')
  login(@Body() dto: LoginDto) { return this.auth.login(dto); }

  @Public() @Post('refresh')
  refresh(@Body() dto: RefreshDto) { return this.auth.refresh(dto.refreshToken); }

  @UseGuards(JwtAuthGuard) @Get('me')
  me(@CurrentUser() u: { id: string }) { return this.auth.me(u.id); }

   @Public() @Post('logout')
  logout(@Body('email')  email: string ) { // Use @Body('email') to get just the string
   return this.auth.logout(email); }

   @Public() 
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK) // Explicitly returns a 200 status code instead of a 201
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.newPassword);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body() dto: ForgotPasswordDto) {
    return this.auth.resendVerification(dto.email);
  }

  @UseGuards(JwtAuthGuard)
  @Post('phone/send-otp')
  @HttpCode(HttpStatus.OK)
  sendPhoneOtp(@CurrentUser() u: { id: string }, @Body() dto: SendPhoneOtpDto) {
    return this.auth.sendPhoneOtp(u.id, dto.phoneNumber);
  }

  @UseGuards(JwtAuthGuard)
  @Post('phone/verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyPhoneOtp(@CurrentUser() u: { id: string }, @Body() dto: VerifyPhoneOtpDto) {
    return this.auth.verifyPhoneOtp(u.id, dto.code);
  }
}
