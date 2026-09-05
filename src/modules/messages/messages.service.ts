import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service'; // Adjust relative path based on your exact structure
import { CreateMessageDto } from './dto/create-message.dto';

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

  async create(userId: string, dto: CreateMessageDto) {
    // 1. Double check participant ownership before allowing message inserts
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
    });

    if (!conversation) throw new NotFoundException('Target conversation record not found');

    if (conversation.userAId !== userId && conversation.userBId !== userId) {
      throw new ForbiddenException('You cannot transmit messages into a room you do not belong to');
    }

    if (!dto.content.trim() && !dto.attachmentUrl) {
      throw new BadRequestException('A message needs text or an attachment.');
    }

    // 2. Save the message to the database, and bump the conversation's
    // lastMessageAt so chat list ordering/relative-time reflects this
    // message instead of staying frozen at whenever the room was created.
    const [newMessage] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          content: dto.content,
          attachmentUrl: dto.attachmentUrl,
          attachmentKey: dto.attachmentKey,
          attachmentName: dto.attachmentName,
          attachmentType: dto.attachmentType,
          attachmentSize: dto.attachmentSize,
          conversation: { connect: { id: dto.conversationId } },
          sender: { connect: { id: userId } },
        },
      }),
      this.prisma.conversation.update({
        where: { id: dto.conversationId },
        data: { lastMessageAt: new Date() },
      }),
    ]);

    // 3. Determine who should receive the notification (the other participant)
    const recipientId = conversation.userAId === userId ? conversation.userBId : conversation.userAId;

    // 4. Trigger Scenario A Hook: Send the app notification alert safely
    try {
      const preview = dto.content.trim()
        ? `"${dto.content.substring(0, 30)}${dto.content.length > 30 ? '...' : ''}"`
        : `an attachment: ${dto.attachmentName ?? 'file'}`;

      await this.notificationsService.createNotification(
        recipientId,
        'NEW_MESSAGE' as any, // Casts cleanly to your Prisma enum definition type
        'New Chat Message',
        `You have received a new message: ${preview}`
      );
    } catch (notificationError) {
      // Log the error internally but don't crash the API response if notification saving fails
      console.error('Failed to dispatch message notification alert:', notificationError);
    }

    return newMessage;
  }

  async updateStatus(id: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: { conversation: true },
    });

    if (!message) {
      throw new NotFoundException(`Message entry with ID ${id} not found`);
    }

    if (message.conversation.userAId !== userId && message.conversation.userBId !== userId) {
      throw new ForbiddenException('You are not a participant in this conversation');
    }

    return this.prisma.message.update({
      where: { id },
      data: {
        readAt: new Date()
      },
    });
  }

  // Marks every unread message in a conversation as read in one query,
  // instead of the caller firing updateStatus() once per unread message
  // (each of which was its own findUnique + update — opening a chat with
  // 15 unread messages meant 30 sequential round trips).
  async markConversationRead(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('The requested conversation room does not exist');
    }

    if (conversation.userAId !== userId && conversation.userBId !== userId) {
      throw new ForbiddenException('Access Denied: You are not a participant in this conversation');
    }

    return this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  async remove(id: string, userId: string) {
    const message = await this.prisma.message.findUnique({ where: { id } });

    if (!message) {
      throw new NotFoundException(`Message entry with ID ${id} does not exist`);
    }

    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    return this.prisma.message.delete({
      where: { id },
    });
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
      take: 200,
    });
  }
}
