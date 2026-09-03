import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SmsModule } from '../sms/sms.module';
import { getRequiredEnv } from '../../common/utils/env.util';
@Module({
  imports: [
    PrismaModule,
    MailModule,
    NotificationsModule,
    SmsModule,
    PassportModule,
    JwtModule.register({
      secret: getRequiredEnv('JWT_ACCESS_SECRET'),
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
