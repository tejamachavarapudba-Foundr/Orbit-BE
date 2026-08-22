import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { VerificationService } from './verification.service';
import { DigilockerOAuthService } from './digilocker-oauth.service';
import { VerificationController } from './verification.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.OAUTH_STATE_SECRET ?? 'dev-oauth-state',
      signOptions: { expiresIn: '600s' },
    }),
  ],
  providers: [VerificationService, DigilockerOAuthService],
  controllers: [VerificationController],
  exports: [VerificationService],
})
export class VerificationModule {}
