import * as crypto from 'crypto';
import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { hash, compare } from '../../common/utils/hash.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');
    const passwordHash = await hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        profile: { create: { fullName: dto.fullName } },
      },
    });
    // backfill profile id (= user id)
    await this.prisma.profile.upsert({
      where: { id: user.id },
      update: { fullName: dto.fullName },
      create: { id: user.id, fullName: dto.fullName },
    });
    return this.issueTokens(user.id, user.email, user.role); // 🟢 Passed user.role here
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
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh',
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

  return user;
}

  // 🟢 CHANGED SIGNATURE: Added role parameter to bake into JWT payload tokens
  private async issueTokens(sub: string, email: string, role: string) {
    const accessToken = await this.jwt.signAsync(
      { sub, email, role }, // 🟢 Added 'role' to token payload payload context
      { secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access',
        expiresIn: Number(process.env.JWT_ACCESS_TTL ?? 900) },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub, email, role }, // 🟢 Added 'role' here as well
      { secret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh',
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
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour tracking frame

    // 4. Record the reset token data in the database
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,          // Make sure to add this field to your schema.prisma User model!
        resetTokenExpires,   // Make sure to add this field to your schema.prisma User model!
      },
    });

    // 5. Construct the deep link mapping back to your Expo Frontend app
    const resetLink = `http://localhost:3000/api/auth/reset-password?token=${resetToken}`;

    // 6. Send the link out via your mail delivery pipeline here
    // await this.mailService.sendResetEmail(user.email, resetLink);
    console.log(`[DEV ONLY] Password Reset Link: ${resetLink}`);

    return genericResponse;
  }

}
