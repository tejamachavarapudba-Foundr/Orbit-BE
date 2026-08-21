import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
@Module({
  imports: [
    PrismaModule,
    MailModule,
    NotificationsModule,
    PassportModule,
    JwtModule.register({
      // FIX: Matches the fallback matrix key matching strategy signature validations
      secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access',
      signOptions: { 
        expiresIn: process.env.JWT_ACCESS_TTL ? `${process.env.JWT_ACCESS_TTL}s` : '900s' 
      },
    })
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
