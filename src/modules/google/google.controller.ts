import { Controller, Delete, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { GoogleOAuthService } from './google-oauth.service';

@Controller('google/oauth')
export class GoogleController {
  constructor(private readonly oauth: GoogleOAuthService) {}

  // GET /google/oauth/url
  @UseGuards(JwtAuthGuard)
  @Get('url')
  getAuthUrl(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return { url: this.oauth.buildAuthUrl(userId) };
  }

  // GET /google/oauth/status
  @UseGuards(JwtAuthGuard)
  @Get('status')
  getStatus(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.oauth.getStatus(userId);
  }

  // DELETE /google/oauth/disconnect
  @UseGuards(JwtAuthGuard)
  @Delete('disconnect')
  disconnect(@Req() req: any) {
    const userId = req.user.id || req.user.sub;
    return this.oauth.disconnect(userId);
  }

  // GET /google/oauth/callback — hit directly by Google, no bearer token available
  @Public()
  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const deepLink = process.env.APP_OAUTH_DEEP_LINK ?? 'com.startuphouze.app://oauth-callback';

    try {
      if (!code || !state) {
        throw new Error('Missing code or state');
      }
      await this.oauth.handleCallback(code, state);
      res.redirect(`${deepLink}?status=success`);
    } catch {
      res.redirect(`${deepLink}?status=error`);
    }
  }
}
