import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  // 1. Fetch clear histories for the authenticated user only
  async list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }, // Newest notifications first
    });
  }

  // 2. Mark a single notification row as read securely
  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    // SECURITY BOUNDARY: Block users from mutating stranger notifications
    if (notification.userId !== userId) {
      throw new ForbiddenException('Access Denied: You cannot modify this alert status');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  // 3. Mark all user notifications as read simultaneously
  async readAll(userId: string) {
    return this.prisma.notification.updateMany({
      where: { 
        userId,
        isRead: false 
      },
      data: { isRead: true },
    });
  }

  // ==========================================
  // APP-WIDE INTERNAL ALERTS DISPATCH UTILITY
  // ==========================================
  // Inject this service into other modules to trigger contextual alerts
  async createNotification(userId: string, type: NotificationType, title: string, message: string) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
      },
    });

    void this.push.sendToProfile(userId, title, message);

    return notification;
  }
}
