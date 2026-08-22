import { Body, Controller, Get, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { Public } from '../../common/decorators/public.decorator';
import { DigilockerOAuthService } from './digilocker-oauth.service';
import { VerificationService } from './verification.service';
import { SubmitFounderVerificationDto } from './dto/submit-founder-verification.dto';
import { ReviewFounderVerificationDto } from './dto/review-founder-verification.dto';

@Controller('verification')
export class VerificationController {
  constructor(
    private readonly verification: VerificationService,
    private readonly digilocker: DigilockerOAuthService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('status')
  getStatus(@Req() req: any) {
    return this.verification.getStatus(req.user.id);
  }

  // GET /verification/identity/url
  @UseGuards(JwtAuthGuard)
  @Get('identity/url')
  getIdentityUrl(@Req() req: any) {
    return { url: this.digilocker.buildAuthUrl(req.user.id) };
  }

  // GET /verification/identity/callback — hit directly by DigiLocker, no bearer token available
  @Public()
  @Get('identity/callback')
  async identityCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const deepLink = process.env.APP_DIGILOCKER_DEEP_LINK ?? 'startuphouze://verify-identity';

    try {
      if (!code || !state) {
        throw new Error('Missing code or state');
      }
      await this.digilocker.handleCallback(code, state);
      res.redirect(`${deepLink}?status=success`);
    } catch {
      res.redirect(`${deepLink}?status=error`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('founder')
  submitFounderVerification(@Req() req: any, @Body() dto: SubmitFounderVerificationDto) {
    return this.verification.submitFounderVerification(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('founder/pending')
  listPendingFounderVerifications() {
    return this.verification.listPendingFounderVerifications();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('founder/:profileId/review')
  reviewFounderVerification(
    @Param('profileId') profileId: string,
    @Req() req: any,
    @Body() dto: ReviewFounderVerificationDto,
  ) {
    return this.verification.reviewFounderVerification(profileId, req.user.id, dto);
  }
}
