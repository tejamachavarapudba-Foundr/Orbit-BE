import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChatsService {
  constructor(private prisma: PrismaService) {}

    // 1. Fetch all chats where the user is either userA OR userB
  async list(userId: string) {
    // HARD BOUNDARY: Block query execution if userId is falsy or blank
    if (!userId || typeof userId !== 'string') {
      throw new ForbiddenException('Database access denied: Invalid identification signature');
    }

    return this.prisma.conversation.findMany({
      where: {
        AND: [
          // Forces database engines to completely drop matching if criteria isn't met
          {
            OR: [
              { userAId: userId },
              { userBId: userId }
            ]
          }
        ]
      },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  }


    // 2. Find a specific chat room and ensure the user belongs to it
  async findOne(id: string, userId: string) {
    const chat = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc' // Sorts chat history from oldest to newest
          }
        }
      }
    });

    if (!chat) throw new NotFoundException(`Chat entry with ID ${id} not found`);
    
    // Check fields against your schema columns
    if (chat.userAId !== userId && chat.userBId !== userId) {
      throw new ForbiddenException('You are not a participant in this chat');
    }

    return chat;
  }


  // 3. Find or Create a Chat room using the userA/userB layout
  async create(userId: string, participantId: string) {
    if (userId === participantId) {
      throw new ForbiddenException('You cannot start a chat room with yourself');
    }

    // Check if both users exist in the system to prevent Foreign Key errors
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: [userId, participantId] }
      }
    });

    // Verify current user exists
    const currentUserExists = users.some(user => user.id === userId);
    if (!currentUserExists) {
      throw new NotFoundException(`Current user with ID ${userId} does not exist`);
    }

    // Verify target participant exists
    const participantExists = users.some(user => user.id === participantId);
    if (!participantExists) {
      throw new NotFoundException(`Participant with ID ${participantId} does not exist`);
    }

    // Check if a conversation exists in either direction (A to B or B to A)
    let existingChat = await this.prisma.conversation.findFirst({
      where: {
        OR: [
          { userAId: userId, userBId: participantId },
          { userAId: participantId, userBId: userId }
        ]
      }
    });

    if (existingChat) return existingChat;

    // Create the room using direct field assignments
    return this.prisma.conversation.create({
      data: {
        userAId: userId,
        userBId: participantId,
        lastMessageAt: new Date()
      }
    });
  }

  // 4. Delete a chat channel safely
  async remove(id: string, userId: string) {
    await this.findOne(id, userId);

    try {
      return await this.prisma.conversation.delete({
        where: { id }
      });
    } catch (error) {
      if (error.code === 'P2025') throw new NotFoundException('Chat channel does not exist');
      throw error;
    }
  }
}
