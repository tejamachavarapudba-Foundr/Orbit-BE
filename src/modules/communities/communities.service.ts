import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommunityDto } from './dto/create-community.dto';

const memberSelect = {
  include: {
    user: {
      select: { id: true, fullName: true, avatarUrl: true, headline: true },
    },
  },
  orderBy: { joinedAt: 'asc' as const },
};

@Injectable()
export class CommunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateCommunityDto) {
    const community = await this.prisma.community.create({
      data: { name: dto.name, description: dto.description ?? '', ownerId },
    });

    const memberIds = new Set(dto.memberIds ?? []);
    memberIds.delete(ownerId);

    await this.prisma.communityMember.create({
      data: { communityId: community.id, userId: ownerId, role: 'owner' },
    });

    if (memberIds.size > 0) {
      await this.prisma.communityMember.createMany({
        data: Array.from(memberIds).map((userId) => ({ communityId: community.id, userId, role: 'member' })),
        skipDuplicates: true,
      });
    }

    return this.get(community.id, ownerId);
  }

  async listMine(userId: string) {
    return this.prisma.community.findMany({
      where: { members: { some: { userId } } },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, userId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id },
      include: { members: memberSelect, _count: { select: { members: true } } },
    });
    if (!community) throw new NotFoundException('Community not found');

    const isMember = community.members.some((member) => member.userId === userId);
    if (!isMember) throw new ForbiddenException('You are not a member of this community');

    return community;
  }

  async addMembers(id: string, requesterId: string, userIds: string[]) {
    const community = await this.get(id, requesterId);
    const existing = new Set(community.members.map((member) => member.userId));
    const toAdd = userIds.filter((userId) => !existing.has(userId));

    if (toAdd.length > 0) {
      await this.prisma.communityMember.createMany({
        data: toAdd.map((userId) => ({ communityId: id, userId, role: 'member' })),
        skipDuplicates: true,
      });
    }

    return this.get(id, requesterId);
  }
}
