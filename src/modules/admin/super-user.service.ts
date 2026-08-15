import { Injectable, NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { hash } from '../../common/utils/hash.util';

@Injectable()
export class SuperUserService {
  constructor(private prisma: PrismaService) {}

  // Internal Audit Logger to track Root Changes independently
  private async logSuperAction(userId: string, action: string, details: string, targetId?: string) {
    try {
      await this.prisma.auditLog.create({
        data: { userId, action, details, targetId }
      });
    } catch (err) {
      console.error('Critical: Super User logging transaction failed:', err);
    }
  }

  // ==========================================
  // 1. EXCLUSIVE ADMIN CREATION ENGINE
  // ==========================================
  async createAdminAccount(dto: { email: string; fullName: string; password?: string }) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Account with this email address already exists');

    const temporaryPassword = dto.password || 'StartuphouzeAdminDefault123!';
    const passwordHash = await hash(temporaryPassword);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: 'ADMIN' as any,
        profile: { create: { fullName: dto.fullName } }
      },
      select: { id: true, email: true, role: true, createdAt: true }
    });
  }

  // ==========================================
  // 2. MANAGEMENT ACCOUNT ROLE SWITCHER
  // ==========================================
  async changeUserRole(targetId: string, newRole: string, superId: string) {
    const targetUser = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!targetUser) throw new NotFoundException('Target user account not found');

    const formattedRole = newRole.toUpperCase().trim();
    if (!['USER', 'ADMIN', 'SUPER_USER'].includes(formattedRole)) {
      throw new BadRequestException('Invalid target role classification provided');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: targetId },
      data: { role: formattedRole as any },
      select: { id: true, email: true, role: true }
    });

    await this.logSuperAction(
      superId,
      'USER_ROLE_CHANGED',
      `Super User changed the role classification of account ${targetUser.email} to ${formattedRole}`,
      targetId
    );

    return updatedUser;
  }

  // ==========================================
  // 3. SUPER USER ROOT STATUS CONTROLLER
  // ==========================================
  async superUserToggleBan(targetId: string, isBanned: boolean, superId: string) {
    const targetUser = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!targetUser) throw new NotFoundException('Target user account not found');

    if (targetId === superId) {
      throw new ForbiddenException('Safety Lock: You cannot freeze or ban your own account');
    }

    const result = await this.prisma.user.update({
      where: { id: targetId },
      data: { isBanned },
      select: { id: true, email: true, role: true, isBanned: true }
    });

    await this.logSuperAction(
      superId,
      isBanned ? 'ACCOUNT_FROZEN_BY_ROOT' : 'ACCOUNT_RESTORED_BY_ROOT',
      `Super User manually set the ban/freeze condition to ${isBanned} for account: ${targetUser.email}`,
      targetId
    );

    return result;
  }

  // ==========================================
  // 4. PERMANENT ACCOUNT PURGE ENGINE
  // ==========================================
  async superUserHardDelete(targetId: string, superId: string) {
    const targetUser = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!targetUser) throw new NotFoundException('Target user account not found');

    if (targetId === superId) {
      throw new ForbiddenException('Safety Lock: You cannot delete your own root account');
    }

    await this.prisma.user.delete({
      where: { id: targetId }
    });

    await this.logSuperAction(
      superId,
      'ACCOUNT_PERMANENTLY_PURGED',
      `Super User permanently deleted account registry reference: ${targetUser.email}`,
      targetId
    );

    return { message: `Account ${targetUser.email} was successfully purged from the system database permanently` };
  }
}
