import * as crypto from 'crypto';
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { hash, compare } from '../../common/utils/hash.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SmsService } from '../sms/sms.service';
import { getRequiredEnv } from '../../common/utils/env.util';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
    private notifications: NotificationsService,
    private sms: SmsService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');
    const passwordHash = await hash(dto.password);
    const verificationToken = generateOtp();
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        verificationToken,
        verificationTokenExpires: new Date(Date.now() + OTP_TTL_MS),
        profile: { create: { fullName: dto.fullName } },
      },
    });
    // backfill profile id (= user id)
    await this.prisma.profile.upsert({
      where: { id: user.id },
      update: { fullName: dto.fullName },
      create: { id: user.id, fullName: dto.fullName },
    });

    // Signup succeeds regardless of whether the confirmation email goes out —
    // an unverified account is still usable (soft gate), so a flaky mail
    // provider should never be able to block registration.
    try {
      await this.mail.sendVerificationEmail(user.email, verificationToken);
    } catch {
      // already logged inside MailService
    }

    await this.notifications.createNotification(
      user.id,
      'WELCOME',
      'Welcome to Orbit',
      `Thanks for choosing Orbit, ${dto.fullName.split(' ')[0]} — let's help you build the right connections. Complete your profile to get discovered.`,
    );

    return this.issueTokens(user.id, user.email, user.role); // 🟢 Passed user.role here
  }

  private buildDeepLink(envVar: string, token: string) {
    const base = process.env[envVar] ?? `startuphouze://${envVar === 'APP_VERIFY_EMAIL_DEEP_LINK' ? 'verify-email' : 'reset-password'}`;
    return `${base}?token=${token}`;
  }

  async verifyEmailOtp(email: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || user.emailVerified) {
      throw new BadRequestException('This code is invalid or has expired.');
    }

    if (!user.verificationToken || !user.verificationTokenExpires || user.verificationTokenExpires < new Date()) {
      throw new BadRequestException('This code has expired — request a new one.');
    }

    if (user.verificationAttempts >= MAX_OTP_ATTEMPTS) {
      throw new BadRequestException('Too many incorrect attempts — request a new code.');
    }

    if (user.verificationToken !== code) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { verificationAttempts: { increment: 1 } },
      });
      throw new BadRequestException('That code is incorrect.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpires: null,
        verificationAttempts: 0,
      },
    });

    return { success: true, message: 'Email verified.' };
  }

  async resendVerification(email: string) {
    const genericResponse = { success: true, message: 'If an account exists with that email, a confirmation code has been sent.' };
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || user.emailVerified) return genericResponse;

    const verificationToken = generateOtp();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationTokenExpires: new Date(Date.now() + OTP_TTL_MS),
        verificationAttempts: 0,
      },
    });

    await this.mail.sendVerificationEmail(user.email, verificationToken);
    return genericResponse;
  }

  /** Sends (or re-sends) an OTP to `phoneNumber` and records it as this
   * user's pending phone number — unverified until verifyPhoneOtp succeeds.
   * Twilio Verify owns the code itself (generation, TTL, attempt limits);
   * nothing is stored here beyond which number we're waiting to confirm. */
  async sendPhoneOtp(userId: string, phoneNumber: string) {
    const existing = await this.prisma.user.findUnique({ where: { phoneNumber } });
    if (existing && existing.id !== userId) {
      throw new ConflictException('That phone number is already in use on another account.');
    }

    await this.sms.sendOtp(phoneNumber);
    await this.prisma.user.update({ where: { id: userId }, data: { phoneNumber, phoneVerified: false } });

    return { success: true, message: 'Verification code sent.' };
  }

  async verifyPhoneOtp(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.phoneNumber) {
      throw new BadRequestException('Send a code to your phone number first.');
    }

    const approved = await this.sms.checkOtp(user.phoneNumber, code);
    if (!approved) {
      throw new BadRequestException('That code is incorrect or has expired — request a new one.');
    }

    await this.prisma.user.update({ where: { id: userId }, data: { phoneVerified: true } });
    return { success: true, phoneVerified: true };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.issueTokens(user.id, user.email, user.role); // 🟢 Passed user.role here
  }

  async logout(email: string) {
    if (!email) {
      throw new BadRequestException('Email is required for logout');
    }

    const result = await this.prisma.user.updateMany({
      where: { email: email },
      data: { refreshHash: null },
    });

    if (result.count === 0) {
      throw new UnauthorizedException('User not found');
    }

    return { message: 'Logged out successfully' };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: getRequiredEnv('JWT_REFRESH_SECRET'),
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.refreshHash) throw new UnauthorizedException();
      const ok = await compare(refreshToken, user.refreshHash);
      if (!ok) throw new UnauthorizedException();
      return this.issueTokens(user.id, user.email, user.role); // 🟢 Passed user.role here
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async me(userId: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: {
        include: {
          founderProfile: true,
          investorProfile: true,
          advisorProfile: true,
          professionalProfile: true,
          serviceProviderProfile: true,
        },
      },
    },
  });

  // A JWT can outlive the account it points to (deleted between issuance
  // and this call) — treat that the same as "not authenticated" rather
  // than returning null, which every caller (web's apiFetch in particular)
  // otherwise has to special-case. Returning 401 here lets web's existing
  // refresh-then-redirect-to-login flow handle it the same as an expired
  // token, instead of crashing on an unexpected response shape.
  if (!user) throw new UnauthorizedException('Account no longer exists');

  // Never send auth secrets to the client — this endpoint was returning
  // the raw User row, bcrypt hashes and all.
  const { passwordHash, refreshHash, resetToken, resetTokenExpires, verificationToken, verificationTokenExpires, ...safeUser } = user;
  return safeUser;
}

  // 🟢 CHANGED SIGNATURE: Added role parameter to bake into JWT payload tokens
  private async issueTokens(sub: string, email: string, role: string) {
    const accessToken = await this.jwt.signAsync(
      { sub, email, role }, // 🟢 Added 'role' to token payload payload context
      { secret: getRequiredEnv('JWT_ACCESS_SECRET'),
        expiresIn: Number(process.env.JWT_ACCESS_TTL ?? 900) },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub, email, role }, // 🟢 Added 'role' here as well
      { secret: getRequiredEnv('JWT_REFRESH_SECRET'),
        expiresIn: Number(process.env.JWT_REFRESH_TTL ?? 2592000) },
    );
    await this.prisma.user.update({
      where: { id: sub },
      data: { refreshHash: await hash(refreshToken) },
    });
    return { accessToken, refreshToken };
  }

  async forgotPassword(email: string) {
    const genericResponse = {
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.',
    };

    if (!email) {
      throw new BadRequestException('Email is required');
    }

    // 1. Locate user via normalized lowercase matching
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // 2. Security Check: Silently return if user doesn't exist (prevents email harvesting)
    if (!user) {
      return genericResponse;
    }

    // 3. Generate a cryptographically secure hex token and set an expiration date (1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + RESET_TTL_MS);

    // 4. Record the reset token data in the database
    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpires },
    });

    // 5. Construct the deep link back into the Orbit app, and 6. send it
    const resetLink = this.buildDeepLink('APP_RESET_PASSWORD_DEEP_LINK', resetToken);
    try {
      await this.mail.sendPasswordResetEmail(user.email, resetLink);
    } catch {
      // already logged inside MailService — a failed send shouldn't leak
      // whether the account exists via a different response shape
    }

    return genericResponse;
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { resetToken: token } });
    if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      throw new BadRequestException('This password reset link is invalid or has expired.');
    }

    const passwordHash = await hash(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
        // A password reset is a good moment to force re-login everywhere,
        // in case the reset was prompted by a compromised session.
        refreshHash: null,
      },
    });

    return { success: true, message: 'Password updated — sign in with your new password.' };
  }

}
