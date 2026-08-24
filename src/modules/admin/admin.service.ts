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
  async getSystemLogs(limit = 50, page = 1) {
    const skip = (page - 1) * limit;

    const [historicalLogs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        take: limit,
        skip,
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
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      logSource: "Unified Security Audit Log Engine",
      generatedAt: new Date(),
      meta: {
        totalItems: total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
      },
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

  // ==========================================
  // 8. GROWTH / ENGAGEMENT / FUNNEL ANALYTICS
  // ==========================================
  async getAnalytics() {
    const windowDays = 30;
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const bucketByDay = (rows: { createdAt: Date }[]) => {
      const counts = new Map<string, number>();
      for (let i = 0; i < windowDays; i += 1) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        counts.set(d.toISOString().slice(0, 10), 0);
      }
      for (const row of rows) {
        const key = row.createdAt.toISOString().slice(0, 10);
        if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));
    };

    const [
      newUsers,
      newPosts,
      roleBreakdown,
      verificationBreakdown,
      identityVerifiedCount,
      totalProfiles,
      likeCount,
      commentCount,
      savedPostCount,
      jobAppBreakdown,
      projectAppBreakdown,
      meetingBreakdown,
      eventBreakdown,
    ] = await Promise.all([
      this.prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      this.prisma.post.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      this.prisma.profile.groupBy({ by: ['role'], _count: { id: true } }),
      this.prisma.founderVerification.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.profile.count({ where: { identityVerified: true } }),
      this.prisma.profile.count(),
      this.prisma.postLike.count(),
      this.prisma.postComment.count(),
      this.prisma.savedPost.count(),
      this.prisma.jobApplication.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.projectApplication.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.meeting.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.event.groupBy({ by: ['status'], _count: { id: true } }),
    ]);

    return {
      growth: {
        signupsByDay: bucketByDay(newUsers),
        postsByDay: bucketByDay(newPosts),
      },
      distribution: {
        roleBreakdown: roleBreakdown.map((r) => ({ role: r.role, count: r._count.id })),
      },
      verification: {
        founderVerificationBreakdown: verificationBreakdown.map((v) => ({ status: v.status, count: v._count.id })),
        identityVerifiedRate: totalProfiles > 0 ? Number(((identityVerifiedCount / totalProfiles) * 100).toFixed(1)) : 0,
        identityVerifiedCount,
        totalProfiles,
      },
      engagement: {
        likeCount,
        commentCount,
        savedPostCount,
      },
      funnels: {
        jobApplications: jobAppBreakdown.map((a) => ({ status: a.status, count: a._count.id })),
        projectApplications: projectAppBreakdown.map((a) => ({ status: a.status, count: a._count.id })),
      },
      health: {
        meetingsByStatus: meetingBreakdown.map((m) => ({ status: m.status, count: m._count.id })),
        eventsByStatus: eventBreakdown.map((e) => ({ status: e.status, count: e._count.id })),
      },
    };
  }

  // ==========================================
  // 9. JOB POSTING MODERATION
  // ==========================================
  async listJobs(limit: number, page: number, search?: string) {
    const skip = (page - 1) * limit;
    const trimmedSearch = search?.trim();

    const where: Prisma.JobWhereInput | undefined = trimmedSearch
      ? {
          OR: [
            { heading: { contains: trimmedSearch, mode: 'insensitive' } },
            { startupName: { contains: trimmedSearch, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const [jobs, total] = await this.prisma.$transaction([
      this.prisma.job.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          poster: { select: { id: true, fullName: true } },
          _count: { select: { applications: true } },
        },
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      data: jobs,
      meta: { totalItems: total, currentPage: page, totalPages: Math.ceil(total / limit) },
    };
  }

  async removeJob(id: string, adminId: string) {
    try {
      const deleted = await this.prisma.job.delete({ where: { id } });
      await this.logAction(adminId, 'JOB_DELETED', `Admin force-deleted job posting "${deleted.heading}"`, id);
      return deleted;
    } catch (error) {
      if (error.code === 'P2025') throw new NotFoundException(`Job with ID ${id} does not exist`);
      throw error;
    }
  }

  // ==========================================
  // 10. EVENT MODERATION
  // ==========================================
  async listEvents(limit: number, page: number, search?: string) {
    const skip = (page - 1) * limit;
    const trimmedSearch = search?.trim();

    const where: Prisma.EventWhereInput | undefined = trimmedSearch
      ? {
          OR: [
            { title: { contains: trimmedSearch, mode: 'insensitive' } },
            { location: { contains: trimmedSearch, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const [events, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          host: { select: { id: true, fullName: true } },
          _count: { select: { attendees: true } },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      data: events,
      meta: { totalItems: total, currentPage: page, totalPages: Math.ceil(total / limit) },
    };
  }

  async removeEvent(id: string, adminId: string) {
    try {
      const deleted = await this.prisma.event.delete({ where: { id } });
      await this.logAction(adminId, 'EVENT_DELETED', `Admin force-deleted event "${deleted.title}"`, id);
      return deleted;
    } catch (error) {
      if (error.code === 'P2025') throw new NotFoundException(`Event with ID ${id} does not exist`);
      throw error;
    }
  }

  // ==========================================
  // 11. COMMUNITY MODERATION
  // ==========================================
  async listCommunities(limit: number, page: number, search?: string) {
    const skip = (page - 1) * limit;
    const trimmedSearch = search?.trim();

    const where: Prisma.CommunityWhereInput | undefined = trimmedSearch
      ? { name: { contains: trimmedSearch, mode: 'insensitive' } }
      : undefined;

    const [communities, total] = await this.prisma.$transaction([
      this.prisma.community.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, fullName: true } },
          _count: { select: { members: true } },
        },
      }),
      this.prisma.community.count({ where }),
    ]);

    return {
      data: communities,
      meta: { totalItems: total, currentPage: page, totalPages: Math.ceil(total / limit) },
    };
  }

  async removeCommunity(id: string, adminId: string) {
    try {
      const deleted = await this.prisma.community.delete({ where: { id } });
      await this.logAction(adminId, 'COMMUNITY_DELETED', `Admin force-deleted community "${deleted.name}"`, id);
      return deleted;
    } catch (error) {
      if (error.code === 'P2025') throw new NotFoundException(`Community with ID ${id} does not exist`);
      throw error;
    }
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
