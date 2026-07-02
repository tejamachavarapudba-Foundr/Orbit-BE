import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service'; // Adjust relative path based on your exact structure

@Injectable()
export class MessagesService {
  // Inject NotificationsService alongside PrismaService
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async list(conversationId: string, userId: string, limit: number, cursor?: string) {
    // 1. Fetch conversation to verify participant membership
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('The requested conversation room does not exist');
    }

    // 2. SECURITY GUARD: Deny access if the user does not belong to this specific room
    if (conversation.userAId !== userId && conversation.userBId !== userId) {
      throw new ForbiddenException('Access Denied: You are not a participant in this conversation');
    }

    // 3. Authorized safely: pull logs for this room only
    return this.prisma.message.findMany({
      where: { conversationId },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, dto: { conversationId: string; content: string }) {
    // 1. Double check participant ownership before allowing message inserts
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
    });

    if (!conversation) throw new NotFoundException('Target conversation record not found');
    
    if (conversation.userAId !== userId && conversation.userBId !== userId) {
      throw new ForbiddenException('You cannot transmit messages into a room you do not belong to');
    }

    // 2. Save the message to the database
    const newMessage = await this.prisma.message.create({
      data: {
        content: dto.content,
        conversation: { connect: { id: dto.conversationId } },
        sender: { connect: { id: userId } }, 
      },
    });

    // 3. Determine who should receive the notification (the other participant)
    const recipientId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;

    // 4. Trigger Scenario A Hook: Send the app notification alert safely
    try {
      await this.notificationsService.createNotification(
        recipientId,
        'NEW_MESSAGE' as any, // Casts cleanly to your Prisma enum definition type
        'New Chat Message',
        `You have received a new message: "${dto.content.substring(0, 30)}${dto.content.length > 30 ? '...' : ''}"`
      );
    } catch (notificationError) {
      // Log the error internally but don't crash the API response if notification saving fails
      console.error('Failed to dispatch message notification alert:', notificationError);
    }

    return newMessage;
  }

  async updateStatus(id: string) {
    try {
      return await this.prisma.message.update({
        where: { id },
        data: { 
          readAt: new Date() 
        }, 
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Message entry with ID ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.message.delete({
        where: { id },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Message entry with ID ${id} does not exist`);
      }
      throw error;
    }
  }
  async searchMessages(
    conversationId: string,
    userId: string,
    query: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException(
        'Conversation not found',
      );
    }

    if (
      conversation.userAId !== userId &&
      conversation.userBId !== userId
    ) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }

    return this.prisma.message.findMany({
      where: {
        conversationId,
        content: {
          contains: query,
          mode: 'insensitive',
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
