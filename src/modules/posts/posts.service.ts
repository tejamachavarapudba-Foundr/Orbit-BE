import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'; // Added NotFoundException
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { MediaType, PostCategory } from '@prisma/client';
import { StorageService } from '../storage/storage.service';
import { StorageType } from '../storage/enums/storage-type.enum';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async list() {
    return this.prisma.post.findMany({
      include: {
        media: true,
        author: true,
        likes: true,
        comments: true,
     },
       orderBy: {
       createdAt: "desc",
      },
    });
  }

  async findOne(id: string) {
  const post = await this.prisma.post.findUnique({
    where: {
      id,
    },
    include: {
      media: true,
      author: true,
      likes: true,
      comments: true,
    },
  });

  if (!post) {
    throw new NotFoundException(
      `Post with ID "${id}" not found.`,
    );
  }

  return post;
}

  async create(
  userId: string,
  dto: CreatePostDto,
  files: Express.Multer.File[],
) {
  const post =
    await this.prisma.post.create({
      data: {
        content: dto.content,
        category: dto.category ?? PostCategory.Update,
        linkUrl: dto.linkUrl,
        ...(dto.projectId && {
          project: {
          connect: {
          id: dto.projectId,
        },
      },
    }),
        author: {
          connect: {
            id: userId,
          },
        },
      },
    });

  if (files?.length) {
    for (
      let i = 0;
      i < files.length;
      i++
    ) {
      const file = files[i];

      const upload =
        await this.storageService.upload(
          file,
          StorageType.POST,
          post.id,
        );

      await this.prisma.postMedia.create({
        data: {
          postId: post.id,
          url: upload.url,

          type: file.mimetype.startsWith(
            "video/",
          )
            ? MediaType.VIDEO
            : MediaType.IMAGE,

          order: i,
        },
      });
    }
  }

  return this.prisma.post.findUnique({
    where: {
      id: post.id,
    },

    include: {
      media: true,
      author: true,
      likes: true,
      comments: true,
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
    // Get all media belonging to this post
const media = await this.prisma.postMedia.findMany({
  where: {
    postId: id,
  },
});

// Delete files from Supabase Storage
for (const item of media) {
  try {
    const path =
      this.storageService.extractPathFromUrl(
        item.url,
      );

    if (path) {
      await this.storageService.delete(
        StorageType.POST,
        path,
      );
    }
  } catch (error) {
    console.warn(
      "Failed to delete media:",
      item.url,
    );
  }
}

// Delete the post (PostMedia rows will be deleted automatically because of Cascade)
return this.prisma.post.delete({
  where: {
    id,
  },
});
  }
}
