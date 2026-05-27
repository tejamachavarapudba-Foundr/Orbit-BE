import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'; // Added NotFoundException
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(private prisma: PrismaService) {}

  async list() {
    return this.prisma.post.findMany();
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException(`Post with ID "${id}" not found.`);
    return post;
  }

  async create(userId: string, dto: CreatePostDto) {
    console.log('DTO received in Service:', dto);
    return this.prisma.post.create({
      data: {
        content: dto.content,
        category: dto.category as any,
        imageUrl: dto.imageUrl,
        linkUrl: dto.linkUrl,
        mediaType: dto.mediaType,
        author: { connect: { id: userId } }
      },
    });
  }

  async update(id: string, dto: any) {
    try {
      // Safely spread the dto fields and preserve enum type casting for categories
      return await this.prisma.post.update({
        where: { id },
        data: {
          ...dto,
          ...(dto.category ? { category: dto.category as any } : {}),
        },
      });
    } catch (error: any) {
      // Prisma error code P2025 means record was not found
      if (error.code === 'P2025') {
        throw new NotFoundException(`Post with ID "${id}" does not exist.`);
      }
      throw error;
    }
  }

    async remove(id: string, userId: string) {
    // 1. Fetch the post first to see who owns it
    const post = await this.prisma.post.findUnique({ where: { id } });

    // 2. If the post doesn't exist, throw a 404
    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" does not exist.`);
    }

    // 3. Security Guard: If the current user is NOT the author, block them
    if (post.authorId !== userId) {
      throw new ForbiddenException('You are not authorized to delete this post.');
    }

    // 4. Safely delete since ownership is verified
    return this.prisma.post.delete({ where: { id } });
  }
}
