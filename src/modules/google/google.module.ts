import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GoogleOAuthService } from './google-oauth.service';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleController } from './google.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.OAUTH_STATE_SECRET ?? 'dev-oauth-state',
      signOptions: { expiresIn: '600s' },
    }),
  ],
  providers: [GoogleOAuthService, GoogleCalendarService],
  controllers: [GoogleController],
  exports: [GoogleOAuthService, GoogleCalendarService],
})
export class GoogleModule {}
