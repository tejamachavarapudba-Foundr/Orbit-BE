import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ==========================================
  // 1. PLATFORM HIGH-UTILITY METRICS ENGINE
  // ==========================================
  async getPlatformStats() {
    // Executes concurrent count calculations across tables for efficient performance
    const [
      totalUsers,
      bannedUsers,
      totalProjects,
      totalJobs,
      totalApplications,
      totalMessages
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isBanned: true } }),
      this.prisma.project.count(),
      this.prisma.job.count(),
      this.prisma.jobApplication.count(),
      this.prisma.message.count()
    ]);

    // Extra metrics: Group distributions to analyze startup health
    const projectsByStage = await this.prisma.project.groupBy({
      by: ['stage'],
      _count: { id: true }
    });

    return {
      overview: {
        totalUsers,
        activeUsers: totalUsers - bannedUsers,
        bannedUsers,
        totalProjects,
        totalJobs,
        totalMessages,
        conversionRate: totalUsers > 0 ? ((totalApplications / totalUsers) * 100).toFixed(2) + '%' : '0%'
      },
      growthMetrics: {
        projectsByStage: projectsByStage.map(item => ({
          stage: item.stage,
          count: item._count.id
        }))
      },
      systemStatus: {
        databaseConnected: true,
        timestamp: new Date()
      }
    };
  }

  // ==========================================
  // 2. MODERATOR USER REGISTRY
  // ==========================================
  async listUsers(limit: number, page: number, search?: string) {
    const skip = (page - 1) * limit;
    const trimmedSearch = search?.trim();

    const where: Prisma.UserWhereInput | undefined = trimmedSearch
      ? {
          OR: [
            { email: { contains: trimmedSearch, mode: 'insensitive' } },
            { profile: { fullName: { contains: trimmedSearch, mode: 'insensitive' } } },
          ],
        }
      : undefined;

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        take: limit,
        skip: skip,
        select: {
          id: true,
          email: true,
          role: true,
          isBanned: true,
          createdAt: true,
          updatedAt: true,
          profile: true // Includes user profile cards automatically
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.user.count({ where })
    ]);

    return {
      data: users,
      meta: {
        totalItems: total,
        itemCount: users.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      }
    };
  }

  // ==========================================
  // 3. SEVERE DISCIPLINARY ENFORCEMENT ENGINE
  // ==========================================
    async toggleUserBan(id: string, adminId: string) { // Added adminId argument
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`User record not found`);

    const updatedStatus = !user.isBanned;
    const actionText = updatedStatus ? 'USER_BANNED' : 'USER_UNBANNED';

    const result = await this.prisma.user.update({
      where: { id },
      data: { isBanned: updatedStatus }
    });

    // 🟢 CREATE LOG EVENT
    await this.logAction(
      adminId,
      actionText,
      `Admin manually changed publication allowance status for email account profile: ${user.email}`,
      id
    );

    return result;
  }


  // ==========================================
  // 4. CONTENT MODERATION REGISTRY
  // ==========================================
  async listPosts(limit: number, page: number, search?: string) {
    const skip = (page - 1) * limit;
    const trimmedSearch = search?.trim();

    const where: Prisma.PostWhereInput | undefined = trimmedSearch
      ? {
          OR: [
            { content: { contains: trimmedSearch, mode: 'insensitive' } },
            { author: { fullName: { contains: trimmedSearch, mode: 'insensitive' } } },
          ],
        }
      : undefined;

    const [posts, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, fullName: true, avatarUrl: true } },
          media: { select: { id: true, url: true, type: true }, take: 1 },
          _count: { select: { likes: true, comments: true } },
        },
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      data: posts,
      meta: {
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async removePost(id: string, adminId?: string) {
    try {
      const deleted = await this.prisma.post.delete({
        where: { id },
        include: { author: { select: { fullName: true } } },
      });

      if (adminId) {
        await this.logAction(
          adminId,
          'POST_DELETED',
          `Admin force-deleted a post by ${deleted.author?.fullName || 'unknown author'}`,
          id,
        );
      }

      return deleted;
    } catch (error) {
      // Prisma error code for target record not found
      if (error.code === 'P2025') {
        throw new NotFoundException(`Post card content registry item with ID ${id} does not exist`);
      }
      throw error;
    }
  }

    // ==========================================
  // 5. GLOBAL PROJECT WORKSPACE REGISTRY
  // ==========================================
  async listProjects(limit: number, page: number) {
    const skip = (page - 1) * limit;

    const [projects, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        take: limit,
        skip: skip,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: {
            select: { id: true, fullName: true }
          }
        }
      }),
      this.prisma.project.count()
    ]);

    return {
      data: projects,
      meta: {
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

    // ==========================================
  // 6. STARTUP VERIFICATION ENGINE (MANUAL ADMIN ACTIONS)
  // ==========================================
    async verifyProject(id: string, isVerified: boolean, adminId: string) { // Added adminId argument
    try {
      const result = await this.prisma.project.update({
        where: { id },
        data: { isVerified, isPublished: isVerified }
      });

      // 🟢 CREATE LOG EVENT
      await this.logAction(
        adminId,
        'PROJECT_VERIFIED_STATUS_CHANGED',
        `Admin adjusted workspace profile verification badge flag setting to: ${isVerified}`,
        id
      );

      return result;
    } catch (error) {
      throw error;
    }
  }

    // ==========================================
  // 7. READABLE SECURITY AUDIT TRACKER
  // ==========================================
  async getSystemLogs() {
    const historicalLogs = await this.prisma.auditLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' }, // Displays newest administrative/user actions first
      include: {
        user: {
          include: {
            profile: {
              select: { fullName: true }
            }
          }
        }
      }
    });

    return {
      logSource: "Unified Security Audit Log Engine",
      generatedAt: new Date(),
      recentSystemActions: historicalLogs.map(log => ({
        id: log.id,
        action: log.action,
        details: log.details,
        targetId: log.targetId,
        timestamp: log.createdAt,
        performedBy: {
          userId: log.userId,
          name: log.user?.profile?.fullName || "System/Unknown Administrator"
        }
      }))
    };
  }

  
    // Centralized action tracker utility
  async logAction(userId: string, action: string, details: string, targetId?: string) {
    try {
      await this.prisma.auditLog.create({
        data: { userId, action, details, targetId }
      });
    } catch (err) {
      console.error('Critical: Logging transaction failed to commit:', err);
    }
  }
  

  
}
