import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectCommentsService {
  constructor(private prisma: PrismaService) {}

  async list(projectId: string) {
    return this.prisma.projectComment.findMany({
      where: { projectId },
      include: { author: { omit: { fcmTokens: true, resumeKey: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, dto: { projectId: string; content: string; parentId?: string }) {
    if (dto.parentId) {
      const parent = await this.prisma.projectComment.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.projectId !== dto.projectId) {
        throw new NotFoundException(`Comment with ID ${dto.parentId} does not exist on this project`);
      }
    }

    try {
      return await this.prisma.projectComment.create({
        data: {
          content: dto.content,
          project: { connect: { id: dto.projectId } },
          author: { connect: { id: userId } },
          ...(dto.parentId ? { parent: { connect: { id: dto.parentId } } } : {}),
        },
        include: { author: { omit: { fcmTokens: true, resumeKey: true } } },
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new NotFoundException(`Project with ID ${dto.projectId} does not exist`);
      }
      throw error;
    }
  }

  async remove(id: string, userId: string) {
    const comment = await this.prisma.projectComment.findUnique({ where: { id } });

    if (!comment) {
      throw new NotFoundException(`Comment with ID ${id} not found`);
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    try {
      return await this.prisma.projectComment.delete({
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
