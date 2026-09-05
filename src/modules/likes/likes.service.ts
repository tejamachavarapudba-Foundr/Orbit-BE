import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LikesService {
  constructor(private prisma: PrismaService) {}

  // 1. List all profiles who liked a specific post
  async list(postId: string) {
    return this.prisma.postLike.findMany({
      where: { postId },
      include: { user: { omit: { fcmTokens: true, resumeKey: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  // 2. Smart Toggle Like (Creates or removes the like record seamlessly)
  async like(userId: string, postId: string) {
    // Check if the like record already exists in the database
    const existingLike = await this.prisma.postLike.findUnique({
      where: {
        postId_userId: { postId, userId },
      },
    });

    // 🔄 2nd CLICK: If it exists, remove it (Unlike action)
    if (existingLike) {
      return await this.unlike(userId, postId);
    }

    // 🆕 1st CLICK: If it does not exist, insert it (Like action)
    try {
      await this.prisma.postLike.create({
        data: {
          post: { connect: { id: postId } },
          user: { connect: { id: userId } },
        },
      });
      return { liked: true, message: 'Post liked successfully' };
    } catch (error: any) {
      // Prisma code P2025 stands for "Foreign key constraint failed / Record not found"
      if (error.code === 'P2025') {
        throw new NotFoundException('Post not found');
      }
      throw error;
    }
  }

  // 3. Isolated Explicit Unlike Core Execution Block
  async unlike(userId: string, postId: string) {
    try {
      await this.prisma.postLike.delete({
        where: {
          postId_userId: { postId, userId },
        },
      });
      return { liked: false, message: 'Post unliked successfully' };
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException('Like connection not found');
      }
      throw error;
    }
  }
}
