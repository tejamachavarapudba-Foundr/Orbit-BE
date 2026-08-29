import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'; // Added NotFoundException
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { MediaType, MediaOrientation, PostCategory } from '@prisma/client';
import { StorageService } from '../storage/storage.service';
import { StorageType } from '../storage/enums/storage-type.enum';
import { MediaMetadataDto } from "./dto/media-metadata.dto";

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async list(userId?: string, page = 1, limit = 10) {
    return this.prisma.post.findMany({
      where: userId ? { notInterestedBy: { none: { userId } } } : undefined,
      include: {
        media: true,
        author: true,
        likes: true,
        comments: { include: { author: true } },
     },
       orderBy: {
       createdAt: "desc",
      },
      skip: (page - 1) * limit,
      take: limit,
      // Without this, Prisma issues a separate DB round trip per relation
      // (author, media, likes, comments, comment.author — ~6 sequential
      // queries) instead of one SQL join, which is where most of the
      // multi-second GET /posts latency was coming from.
      relationLoadStrategy: 'join',
    });
  }

  async reportPost(userId: string, postId: string, reason: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException(`Post with ID "${postId}" not found.`);

    // Idempotent — a user reporting the same post twice just confirms the
    // existing report rather than erroring or creating a duplicate.
    await this.prisma.postReport.upsert({
      where: { postId_reporterId: { postId, reporterId: userId } },
      update: {},
      create: { postId, reporterId: userId, reason: reason ?? '' },
    });

    return { reported: true };
  }

  async markNotInterested(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException(`Post with ID "${postId}" not found.`);

    await this.prisma.postNotInterested.upsert({
      where: { postId_userId: { postId, userId } },
      update: {},
      create: { postId, userId },
    });

    return { notInterested: true };
  }

  async listSaved(userId: string) {
    const saved = await this.prisma.savedPost.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        post: {
          include: {
            media: true,
            author: true,
            likes: true,
            comments: { include: { author: true } },
          },
        },
      },
    });

    return saved.map((entry) => entry.post);
  }

  async toggleSave(userId: string, postId: string) {
    const existing = await this.prisma.savedPost.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existing) {
      await this.prisma.savedPost.delete({ where: { id: existing.id } });
      return { saved: false };
    }

    await this.prisma.savedPost.create({ data: { userId, postId } });
    return { saved: true };
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
      comments: { include: { author: true } },
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
  mediaMetadata: MediaMetadataDto[],
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
      const meta: Partial<MediaMetadataDto> =
        mediaMetadata.find(
          (m) => m.index === i,
        ) ?? {};
        
      await this.prisma.postMedia.create({
        data: { 
          postId: post.id,

          url: upload.url,

          type: file.mimetype.startsWith("video/")
            ? MediaType.VIDEO
            : MediaType.IMAGE,

          order: i,

          width: meta.width ?? null,

          height: meta.height ?? null,

          duration: meta.duration ?? null,

              // orientation is required by Prisma's PostMediaUncheckedCreateInput
              orientation: meta.orientation ?? null,

          mimeType: meta.mimeType ?? null,

          fileSize: meta.fileSize ?? null,
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
      comments: { include: { author: true } },
    },
  });
}
  
  
  async update(id: string, userId: string, dto: UpdatePostDto) {
    const post = await this.prisma.post.findUnique({ where: { id } });

    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" does not exist.`);
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('You are not authorized to edit this post.');
    }

    try {
      return await this.prisma.post.update({
        where: { id },
        data: {
          ...(dto.content !== undefined ? { content: dto.content } : {}),
          ...(dto.category ? { category: dto.category as PostCategory } : {}),
          ...(dto.linkUrl !== undefined ? { linkUrl: dto.linkUrl } : {}),
        },
        include: {
          media: true,
          author: true,
          likes: true,
          comments: { include: { author: true } },
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
