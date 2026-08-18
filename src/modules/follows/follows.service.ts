import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FollowsService {
  constructor(private prisma: PrismaService) {}

  // 1. Find profiles following this user
  async getFollowers(profileId: string) {
    const connections = await this.prisma.connection.findMany({
      where: { followingId: profileId },
      include: {
        follower: true, // Returns the full Profile model
      },
    });
    return connections.map((c) => c.follower);
  }

  // 2. Find profiles this user is following
  async getFollowing(profileId: string) {
    const connections = await this.prisma.connection.findMany({
      where: { followerId: profileId },
      include: {
        following: true, // Returns the full Profile model
      },
    });
    return connections.map((c) => c.following);
  }

  // 2b. Count followers/following without fetching full profile lists
  async getCounts(profileId: string) {
    const [followers, following] = await Promise.all([
      this.prisma.connection.count({ where: { followingId: profileId } }),
      this.prisma.connection.count({ where: { followerId: profileId } }),
    ]);

    return { followers, following };
  }

  // 3. Check follow status between two profiles
  async getStatus(currentProfileId: string, targetProfileId: string) {
    const record = await this.prisma.connection.findUnique({
      where: {
        followerId_followingId: {
          followerId: currentProfileId,
          followingId: targetProfileId,
        },
      },
    });
    return { isFollowing: !!record };
  }

  // 4. Create a follow connection
  async follow(currentProfileId: string, targetProfileId: string) {
    if (currentProfileId === targetProfileId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    // Verify target profile exists
    const targetProfile = await this.prisma.profile.findUnique({ where: { id: targetProfileId } });
    if (!targetProfile) throw new NotFoundException('Profile not found');

    return this.prisma.connection.upsert({
      where: {
        followerId_followingId: {
          followerId: currentProfileId,
          followingId: targetProfileId,
        },
      },
      update: {}, 
      create: {
        followerId: currentProfileId,
        followingId: targetProfileId,
      },
    });
  }

  // 5. Delete a follow connection
  async unfollow(currentProfileId: string, targetProfileId: string) {
    try {
      return await this.prisma.connection.delete({
        where: {
          followerId_followingId: {
            followerId: currentProfileId,
            followingId: targetProfileId,
          },
        },
      });
    } catch (error) {
      throw new BadRequestException('You are not following this profile');
    }
  }
}
