import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  async list(postId: string) {
    return this.prisma.postComment.findMany({ // Changed to postComment
      where: { postId },
      include: { author: true }
    });
  }

  async create(userId: string, dto: { postId: string; content: string; parentId?: string }) {
    if (dto.parentId) {
      const parent = await this.prisma.postComment.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.postId !== dto.postId) {
        throw new NotFoundException(`Comment with ID ${dto.parentId} does not exist on this post`);
      }
    }

    try {
      return await this.prisma.postComment.create({
        data: {
          content: dto.content,
          post: { connect: { id: dto.postId } },
          author: { connect: { id: userId } },
          ...(dto.parentId ? { parent: { connect: { id: dto.parentId } } } : {}),
        },
        include: { author: true },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Post with ID ${dto.postId} does not exist`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      return await this.prisma.postComment.delete({ // Changed to postComment
        where: { id },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Comment with ID ${id} not found`);
      }
      throw error;
    }
  }
}
